import React, { useState, useEffect, useRef } from 'react';
import { orderService } from '../../Services/orderService';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Checkbox from '../ui/Checkbox';
import RadioGroup from '../ui/RadioGroup';
import Button from "../ui/Button";
// Assuming helper functions like getTodayDate, getNextMonthDate, etc. exist in utils
import { getTodayDate, getNextMonthDate, titleOptions, classOptions, prescribedByOptions, formatNumericInput } from '../../utils/helpers';
import CustomerInfoSection from './CustomerInfoSection';
import PrescriptionSection from './PrescriptionSection';
import RemarksAndStatusSection from './RemarksAndStatusSection';
import PaymentSection from './PaymentSection';
import { PrescriptionFormData, PrescriptionData, SelectedItem } from '../types';
import ToastNotification from '../ui/ToastNotification';
// Import Supabase client
import { supabase } from '../../Services/supabaseService';
import { useNavigate } from 'react-router-dom';
import { printOrderCard } from '../../utils/printOrderService';
// Import logger utility
import { logInfo, logError, logDebug, logDev, logWarn } from '../../utils/logger';
import { prescriptionService } from '../../Services/supabaseService';

// Interface for the structure of a search suggestion (based on API response which is a full Prescription object)
interface SearchSuggestion extends PrescriptionFormData {
  id: string; // Assuming an ID field exists in your DB schema and API response
  status: string; // Make status required to match PrescriptionFormData
}

// Use the service function for generating prescription numbers
const generateUniquePrescriptionNumber = orderService.generateUniquePrescriptionNumber;

// Helper function to generate a reference number
// By default, it uses the prescription number but can be edited separately
const generateReferenceNumber = (prescriptionNumber: string): string => {
  return prescriptionNumber; // Simply return the prescription number as the default reference number
};

// Helper function to format date for input fields
const formatDateForInput = (date: string | null | undefined, format: 'date' | 'datetime-local' = 'date'): string => {
  if (!date) return '';
  // Ensure date is a string before proceeding
  if (typeof date !== 'string') return '';
  
  // Extract just the date part if there's a time component
  const datePart = date.includes('T') ? date.split('T')[0] : date;
  
  // Return appropriate format based on the format parameter
  if (format === 'datetime-local') {
    // For datetime-local inputs, append time if not already present
    return date.includes('T') ? date : `${datePart}T00:00`;
  } else {
    // For date inputs, return just the date part
    return datePart;
  }
};

// Initial form state with proper nested structure and default datetime-local format
// We'll initialize with a temporary prescription number and update it in useEffect
const initialFormState: PrescriptionFormData = {
  // Common/Customer fields
  // Initialize with a temporary value that will be replaced in useEffect
  prescriptionNo: 'P000000-0000', // Temporary value
  referenceNo: 'REF0000-00000', // Temporary value, will be updated in useEffect
  currentDateTime: formatDateForInput(getTodayDate(), 'datetime-local'),
  deliveryDateTime: formatDateForInput(getNextMonthDate(), 'datetime-local'),
  date: formatDateForInput(getTodayDate()), // Using date format
  class: '',
  bookingBy: '',
  namePrefix: 'Mr.',
  name: '',
  gender: 'Male',
  age: '',
  customerCode: '',
  birthDay: '',
  marriageAnniversary: '',
  address: '',
  city: '',
  state: '',
  pinCode: '',
  phoneLandline: '',
  mobileNo: '',
  email: '',
  ipd: '',
  prescribedBy: '',
  billed: false,
  rightEye: {
    dv: { sph: '', cyl: '', ax: '', add: '', vn: '6/', rpd: '' },
    nv: { sph: '', cyl: '', ax: '', add: '', vn: 'N' }
  },
  leftEye: {
    dv: { sph: '', cyl: '', ax: '', add: '', vn: '6/', lpd: '' },
    nv: { sph: '', cyl: '', ax: '', add: '', vn: 'N' }
  },
  balanceLens: false,
  selectedItems: [],
  remarks: { // Initialize remarks as an object with boolean flags based on PrescriptionForm.tsx
    forConstantUse: false,
    forDistanceVisionOnly: false,
    forNearVisionOnly: false,
    separateGlasses: false,
    biFocalLenses: false,
    progressiveLenses: false,
    antiReflectionLenses: false,
    antiRadiationLenses: false,
    underCorrected: false
  },
  orderStatus: 'Processing',
  orderStatusDate: formatDateForInput(getTodayDate(), 'datetime-local'),
  retestAfter: '',
  billNo: '',
  paymentEstimate: '0.00',
  schAmt: '0.00',
  advance: '0.00',
  balance: '0.00',
  // Added missing payment fields based on linter error and likely PaymentSection requirements
  cashAdv1: '0.00',
  ccUpiAdv: '0.00',
  chequeAdv: '0.00',
  advanceOther: '0.00',
  taxAmount: '0.00',
  cashAdv2: '0.00',
  cashAdv2Date: formatDateForInput(getTodayDate(), 'datetime-local'),

  // Keep discount fields, although their usage needs confirmation
  applyDiscount: '',
  discountType: 'percentage',
  discountValue: '', // Value for the discount (either % or fixed amount)
  discountReason: '',

  // Manual entry fields
  manualEntryType: 'Frames',
  manualEntryItemName: '',
  manualEntryRate: '',
  manualEntryQty: 1,
  manualEntryItemAmount: 0,

  // Assuming these are also part of PrescriptionFormData based on your initial state
  others: '',
  status: '', // Required field in PrescriptionFormData interface
  title: 'Mr.' // Required field separate from namePrefix
};

// Helper to format money fields as string with two decimals
function formatMoney(val: any) {
  const num = Number(val);
  return isNaN(num) ? '0.00' : num.toFixed(2);
}

// Utility to map order data to full form state
const mapOrderToFormData = async (order: any, prevFormData: any) => {
  if (!order) return prevFormData;
  // Fetch the related prescription and eye data
  const prescriptionId = order.prescription_id;
  const prescriptionData = prescriptionId ? await prescriptionService.getPrescription(prescriptionId) : null;
  // Fallbacks for missing prescription/eye data
  const rightEye = prescriptionData?.rightEye || prevFormData.rightEye;
  const leftEye = prescriptionData?.leftEye || prevFormData.leftEye;
  const remarks = prescriptionData?.remarks || prevFormData.remarks;
  // --- Enhanced mapping for order_items to selectedItems ---
  const orderItems = (order.order_items || []).map((item: any) => ({
    si: item.si ?? 0,
    itemCode: item.item_code || '',
    itemName: item.item_name || '',
    taxPercent: item.tax_percent !== undefined ? Number(item.tax_percent) : 0,
    rate: item.rate !== undefined ? Number(item.rate) : 0,
    amount: item.amount !== undefined ? Number(item.amount) : 0,
    qty: item.qty !== undefined ? Number(item.qty) : 1,
    discountAmount: item.discount_amount !== undefined ? Number(item.discount_amount) : 0,
    discountPercent: item.discount_percent !== undefined ? Number(item.discount_percent) : 0,
    brandName: item.brand_name || '',
    index: item.index || '',
    coating: item.coating || '',
    itemType: item.item_type || '',
    unit: item.unit || '',
  }));

  // --- Robust payment fetching and mapping ---
  let payment = (order.order_payments && order.order_payments[0]) || null;
  // If payment is missing or incomplete, fetch from DB
  if (!payment || payment.advance_cash === undefined || payment.advance_card_upi === undefined || payment.advance_other === undefined) {
    if (order.id) {
      try {
        const { data: paymentData, error: paymentError } = await supabase
          .from('order_payments')
          .select('*')
          .eq('order_id', order.id)
          .maybeSingle();
        if (paymentError) {
          logError('[mapOrderToFormData] Error fetching payment from DB:', paymentError);
        } else if (paymentData) {
          logDebug('[mapOrderToFormData] Payment fetched from DB:', paymentData);
          payment = paymentData;
        } else {
          logWarn('[mapOrderToFormData] No payment record found in DB for order:', order.id);
        }
      } catch (err) {
        logError('[mapOrderToFormData] Exception fetching payment from DB:', err);
      }
    } else {
      logWarn('[mapOrderToFormData] No order.id present to fetch payment from DB.');
    }
  } else {
    logDebug('[mapOrderToFormData] Using joined payment data:', payment);
  }

  // Log the payment data being mapped
  logDebug('[mapOrderToFormData] Final payment data used for mapping:', payment);

  // Compose the full form state
  return {
    ...prevFormData,
    // Prescription fields
    prescriptionNo: prescriptionData?.prescriptionNo || '',
    referenceNo: prescriptionData?.referenceNo || '',
    class: prescriptionData?.class || '',
    prescribedBy: prescriptionData?.prescribedBy || '',
    date: prescriptionData?.date || '',
    name: prescriptionData?.name || '',
    title: prescriptionData?.title || 'Mr.',
    age: prescriptionData?.age || '',
    gender: prescriptionData?.gender || 'Male',
    customerCode: prescriptionData?.customerCode || '',
    birthDay: prescriptionData?.birthDay || '',
    marriageAnniversary: prescriptionData?.marriageAnniversary || '',
    address: prescriptionData?.address || '',
    city: prescriptionData?.city || '',
    state: prescriptionData?.state || '',
    pinCode: prescriptionData?.pinCode || '',
    phoneLandline: prescriptionData?.phoneLandline || '',
    mobileNo: prescriptionData?.mobileNo || '',
    email: prescriptionData?.email || '',
    ipd: prescriptionData?.ipd || '',
    bookingBy: order.booking_by || prescriptionData?.bookingBy || '',
    rightEye,
    leftEye,
    balanceLens: prescriptionData?.balanceLens || false,
    remarks,
    retestAfter: prescriptionData?.retestAfter || '',
    others: prescriptionData?.others || '',
    // Order fields
    billNo: order.bill_no || '',
    orderStatus: order.status || '',
    orderStatusDate: order.order_date || '',
    selectedItems: orderItems,
    // --- Payment fields autopopulated from DB, always formatted ---
    paymentEstimate: formatMoney(payment?.payment_estimate),
    schAmt: formatMoney(payment?.schedule_amount),
    advance: formatMoney(payment?.total_advance),
    balance: formatMoney(payment?.balance),
    cashAdv1: formatMoney(payment?.advance_cash),
    ccUpiAdv: formatMoney(payment?.advance_card_upi),
    advanceOther: formatMoney(payment?.advance_other),
    chequeAdv: formatMoney(payment?.advance_other),
    taxAmount: formatMoney(payment?.tax_amount),
    cashAdv2: prevFormData.cashAdv2,
    cashAdv2Date: prevFormData.cashAdv2Date,
    applyDiscount: prevFormData.applyDiscount,
    discountType: prevFormData.discountType,
    discountValue: prevFormData.discountValue,
    discountReason: prevFormData.discountReason,
    manualEntryType: prevFormData.manualEntryType,
    manualEntryItemName: prevFormData.manualEntryItemName,
    manualEntryRate: prevFormData.manualEntryRate,
    manualEntryQty: prevFormData.manualEntryQty,
    manualEntryItemAmount: prevFormData.manualEntryItemAmount,
    currentDateTime: prevFormData.currentDateTime,
    deliveryDateTime: prevFormData.deliveryDateTime,
    isFromDatabase: true,
    status: order.status || '',
    updated_at: order.updated_at || new Date().toISOString(),
    id: prescriptionData?.id || prevFormData.id
  };
};

const OrderCardForm: React.FC = () => {
  // Generate and set a unique prescription number when the component mounts
  useEffect(() => {
    const setInitialPrescriptionNumber = async () => {
      try {
        const newPrescriptionNo = await generateUniquePrescriptionNumber();
        setFormData(prev => ({
          ...prev,
          prescriptionNo: newPrescriptionNo,
          referenceNo: generateReferenceNumber(newPrescriptionNo) // Set reference same as prescription by default
        }));
        logInfo('Generated initial prescription number', { prescriptionNo: newPrescriptionNo });
      } catch (error) {
        logError('Failed to generate initial prescription number', error);
        // Fallback to a timestamp-based number if generation fails
        const fallback = `P${new Date().getTime().toString().slice(-10)}`;
        setFormData(prev => ({
          ...prev,
          prescriptionNo: fallback,
          referenceNo: fallback
        }));
        logWarn('Fallback to timestamp-based prescription number', { fallback });
      }
    };
    
    setInitialPrescriptionNumber();
  }, []);
  // Use the imported PrescriptionFormData type for state
  const [formData, setFormData] = useState<PrescriptionFormData>(initialFormState);

  const [showManualEntryPopup, setShowManualEntryPopup] = useState(false);
  const [showLensEntryPopup, setShowLensEntryPopup] = useState(false);
  const [lensEntry, setLensEntry] = useState({ brandName: '', itemName: '', index: '', coating: '', rate: '', qty: '', itemAmount: '' });
  const [retestAfterChecked, setRetestAfterChecked] = useState(false);
  const [showItemSelectionPopup, setShowItemSelectionPopup] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState<'Frames' | 'Sun Glasses'>('Frames');
  // Ensure notification type aligns with ToastNotification props
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; visible: boolean }>({ message: '', type: 'success', visible: false });

  // States for search suggestions
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  // Track current order's updated_at for navigation
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Update currentUpdatedAt whenever formData changes (if it has an updated_at)
  useEffect(() => {
    if ((formData as any)?.updated_at) {
      setCurrentUpdatedAt((formData as any).updated_at);
    }
  }, [formData]);

  // Navigation handlers
  const handleFirstOrder = async () => {
    setIsNavigating(true);
    try {
      const data = await orderService.getFirstOrder();
      if (data) {
        const mapped = await mapOrderToFormData(data, initialFormState);
        setFormData(mapped);
        setNotification({ message: 'Loaded first (oldest) order.', type: 'success', visible: true });
      } else {
        setNotification({ message: 'No order records found.', type: 'error', visible: true });
      }
    } catch (e) {
      setNotification({ message: 'Error loading first order.', type: 'error', visible: true });
    } finally {
      setIsNavigating(false);
    }
  };

  const handleLastOrder = async () => {
    setIsNavigating(true);
    try {
      const data = await orderService.getLastOrder();
      if (data) {
        const mapped = await mapOrderToFormData(data, initialFormState);
        setFormData(mapped);
        setNotification({ message: 'Loaded last (most recent) order.', type: 'success', visible: true });
      } else {
        setNotification({ message: 'No order records found.', type: 'error', visible: true });
      }
    } catch (e) {
      setNotification({ message: 'Error loading last order.', type: 'error', visible: true });
    } finally {
      setIsNavigating(false);
    }
  };

  const handlePrevOrder = async () => {
    setIsNavigating(true);
    try {
      let data = null;
      if (!currentUpdatedAt) {
        data = await orderService.getLastOrder();
      } else {
        data = await orderService.getPrevOrder(currentUpdatedAt);
      }
      if (data) {
        const mapped = await mapOrderToFormData(data, initialFormState);
        setFormData(mapped);
        setNotification({ message: 'Loaded previous order.', type: 'success', visible: true });
      } else {
        setNotification({ message: 'No previous order found.', type: 'error', visible: true });
      }
    } catch (e) {
      setNotification({ message: 'Error loading previous order.', type: 'error', visible: true });
    } finally {
      setIsNavigating(false);
    }
  };

  const handleNextOrder = async () => {
    setIsNavigating(true);
    try {
      let data = null;
      if (!currentUpdatedAt) {
        data = await orderService.getFirstOrder();
      } else {
        data = await orderService.getNextOrder(currentUpdatedAt);
      }
      if (data) {
        const mapped = await mapOrderToFormData(data, initialFormState);
        setFormData(mapped);
        setNotification({ message: 'Loaded next order.', type: 'success', visible: true });
      } else {
        setNotification({ message: 'No next order found.', type: 'error', visible: true });
      }
    } catch (e) {
      setNotification({ message: 'Error loading next order.', type: 'error', visible: true });
    } finally {
      setIsNavigating(false);
    }
  };

  // Handler for Exit button
  const handleExit = () => {
    navigate('/');
  };

  // Handle click outside suggestions to close them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the clicked element is within the suggestions dropdown or the input field
      const clickedInsideSuggestions = suggestionsRef.current && suggestionsRef.current.contains(event.target as Node);
      const clickedOnInput = activeField && (event.target as Element).closest(`input[name='${activeField}']`);

      if (!clickedInsideSuggestions && !clickedOnInput) {
        setActiveField(null);
        setSuggestions([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeField]); // Add activeField to dependency array

  // Effect to calculate Item Amount in manual entry popup
  useEffect(() => {
    const rate = parseFloat(formData.manualEntryRate || '0');
    const qty = formData.manualEntryQty || 0;
    setFormData(prev => ({ ...prev, manualEntryItemAmount: rate * qty }));
  }, [formData.manualEntryRate, formData.manualEntryQty]);

  // Effect to calculate taxes, total advance, and balance in Payment Section
  useEffect(() => {
    // CRITICAL FIX: Skip recalculation when data is from database
    // This ensures we don't override the database values with calculated ones
    if (formData.isFromDatabase) {
      logDebug('Skipping payment recalculation because data is from database', { isFromDatabase: true });
      return; // Exit early - don't recalculate when data is from database
    }
    
    try {
      // Calculate total base amount for items
      const totalBaseAmount = formData.selectedItems.reduce((sum, item) => {
        const rate = parseFloat(item.rate?.toString() || '0');
        const qty = parseFloat(item.qty?.toString() || '1');
        return sum + (rate * qty);
      }, 0);
      
      // Calculate total tax amount
      const totalTaxAmount = formData.selectedItems.reduce((sum, item) => {
        const rate = parseFloat(item.rate?.toString() || '0');
        const qty = parseFloat(item.qty?.toString() || '1');
        const baseTotal = rate * qty;
        const taxPercent = parseFloat(item.taxPercent?.toString() || '0');
        const taxAmount = (baseTotal * taxPercent) / 100;
        return sum + taxAmount;
      }, 0);
      
      // Calculate total discount amount
      const totalDiscountAmount = formData.selectedItems.reduce((sum, item) => {
        return sum + (parseFloat(item.discountAmount?.toString() || '0'));
      }, 0);

      // Payment estimate = base amount + tax (before discount)
      const paymentEstimate = totalBaseAmount + totalTaxAmount;
      
      // Calculate total advance payments (directly from form inputs, not derived values)
      const cashAdv1 = parseFloat(formData.cashAdv1?.toString() || '0') || 0;
      const ccUpiAdv = parseFloat(formData.ccUpiAdv?.toString() || '0') || 0;
      const advanceOther = parseFloat(formData.advanceOther?.toString() || '0') || 0; // FIXED: was using advance instead of advanceOther
      
      // Do not set the advance field in state - this was causing the recursive loop
      const totalAdvance = cashAdv1 + ccUpiAdv + advanceOther;

      // Calculate final amount after discount (base + tax - discount)
      const finalAmount = paymentEstimate - totalDiscountAmount;
      
      // Balance = final amount - total advance (ensuring it's not negative)
      const balance = Math.max(0, finalAmount - totalAdvance);
      
      logDebug('Payment Calculation Debug (NEW VALUES)', {
        totalBaseAmount,
        totalTaxAmount,
        totalDiscountAmount,
        paymentEstimate,
        cashAdv1,
        ccUpiAdv,
        advanceOther,
        totalAdvance,
        finalAmount,
        balance
      });
      
      // Update state, but DON'T update the advance field itself to avoid recursion
      setFormData(prev => ({
        ...prev,
        paymentEstimate: paymentEstimate.toFixed(2),
        balance: balance.toFixed(2),
        chequeAdv: totalTaxAmount.toFixed(2),
        schAmt: totalDiscountAmount.toFixed(2)
        // Removed advance: totalAdvance.toFixed(2) to prevent the loop
      }));
    } catch (error) {
      logError('Error in payment calculation:', error);
    }
  }, [
    formData.selectedItems,
    formData.cashAdv1,
    formData.ccUpiAdv,
    formData.cashAdv2,
    formData.paymentEstimate,
    formData.balance,
    formData.chequeAdv,
    formData.schAmt,
    formData.advance
  ]);

  // Effect to handle prescription logic (IPD calculation)
  useEffect(() => {
    // Calculate IPD from RPD and LPD
    const rpdValue = parseFloat(formData.rightEye.dv.rpd || '0');
    const lpdValue = parseFloat(formData.leftEye.dv.lpd || '0');

    if (!isNaN(rpdValue) && !isNaN(lpdValue) && (rpdValue > 0 || lpdValue > 0)) {
        const calculatedIPD = (rpdValue + lpdValue).toFixed(1);
        setFormData(prev => ({ ...prev, ipd: calculatedIPD }));
        logDebug('Calculated IPD from RPD and LPD', { rpdValue, lpdValue, calculatedIPD });
    } else {
         setFormData(prev => ({ ...prev, ipd: '' }));
      }
  }, [formData.rightEye.dv.rpd, formData.leftEye.dv.lpd]);

  // Payment Section: Auto-calculate Payment Estimate, Tax Amount, and Sch Amt from selectedItems
  useEffect(() => {
    // Calculate base amount: sum of (rate * qty) for all items
    const baseAmount = formData.selectedItems.reduce((sum, item) => sum + (item.rate * item.qty), 0);
    
    // Calculate total tax amount from all items
    const totalTaxAmount = formData.selectedItems.reduce((sum, item) => {
      const itemBaseAmount = item.rate * item.qty;
      const taxAmount = (itemBaseAmount * (item.taxPercent || 0)) / 100;
      return sum + taxAmount;
    }, 0);
    
    // Payment Estimate: base amount + tax amount
    const paymentEstimate = baseAmount + totalTaxAmount;
    
    // Sch Amt: sum of all discountAmount fields
    const schAmt = formData.selectedItems.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    
    // Advance: user input, default to 0 if empty
    const advance = formData.advance === '' ? 0 : parseFloat(formData.advance);
    
    // Balance: Payment Estimate - Sch Amt - Advance
    const balance = paymentEstimate - schAmt - advance;
    
    setFormData(prev => ({
      ...prev,
      paymentEstimate: paymentEstimate.toFixed(2),
      taxAmount: totalTaxAmount.toFixed(2),
      schAmt: schAmt.toFixed(2),
      balance: balance.toFixed(2)
    }));
  }, [formData.selectedItems, formData.advance]);

  // Auto-suggestion search function
  const searchPrescriptions = (query: string, field: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    // Clear previous timeout if it exists
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Define the column to search based on the field
        let column = '';
        switch (field) {
          case 'prescriptionNo': column = 'prescription_no'; break;
          case 'referenceNo': column = 'reference_no'; break;
          case 'name': column = 'name'; break;
          case 'mobileNo': column = 'mobile_no'; break;
          default: return; // Don't search for other fields
        }

        logDebug(`Searching for ${column} containing: ${query}`);
        
        // Use Supabase to query the database with join to eye_prescriptions, prescription_remarks, orders, order_items, and order_payments
        logDebug(`Executing query for ${column}=${query}`);
        let { data, error } = await supabase
          .from('prescriptions')
          .select(`
            *,
            eye_prescriptions(id, prescription_id, eye_type, vision_type, sph, cyl, ax, add_power, vn, rpd, lpd),
            prescription_remarks(*),
            orders(*, order_items(*), order_payments(*))
          `)
          .eq(column, query) // For exact match
          .limit(5);
          
        // If no exact matches, try partial match for name/mobile
        if ((!data || data.length === 0) && (column === 'name' || column === 'mobile_no')) {
          const result = await supabase
            .from('prescriptions')
            .select(`
              *,
              eye_prescriptions(id, prescription_id, eye_type, vision_type, sph, cyl, ax, add_power, vn, rpd, lpd),
              prescription_remarks(*),
              orders(*, order_items(*), order_payments(*))
            `)
            .ilike(column, `%${query}%`) // For partial match
            .limit(5);
            
          data = result.data;
          error = result.error;
        }
          
        if (error) {
          logError('Supabase search error:', error);
          setNotification({
            message: `Search failed: ${error.message}`,
            type: 'error',
            visible: true
          });
          setSuggestions([]);
          return;
        }
        
        if (!data || data.length === 0) {
          logDebug('No search results found');
          setSuggestions([]);
          return;
        }
          
        logDebug('Search results:', data);
        logDebug('Raw data with eye_prescriptions:', data);
      
      logDebug('Raw data from API before transformation:', data);
      logDebug('Sample item from database:', data[0]);
      logDebug('Title from database:', data[0]?.title);
      logDebug('Gender from database:', data[0]?.gender);
      
      // Transformation of database results to match your interface including eye prescriptions
      const transformedData: SearchSuggestion[] = data.map((item: any) => {
        // When we select this suggestion, we want to preserve the original prescription number and reference number
        // rather than generating new ones
        // Check if eye_prescriptions, prescription_remarks, and orders arrays exist
        const eyePrescriptions = item.eye_prescriptions || [];
        const prescriptionRemarks = item.prescription_remarks || [];
        const orders = item.orders || [];
        
        // Get the most recent order (if any)
        const latestOrder = orders.length > 0 ? orders[0] : null;
        
        // Get order items and payments from the latest order
        const orderItems = latestOrder?.order_items || [];
        const orderPayment = latestOrder?.order_payments?.[0] || null;
        
        // Log the raw order payment object to inspect all available fields
        logDebug('RAW ORDER PAYMENT OBJECT WITH ALL FIELDS:', {
          orderPayment,
          allKeys: orderPayment ? Object.keys(orderPayment) : [],
          allValues: orderPayment ? Object.values(orderPayment) : []
        });
        
        logDebug('RAW ORDER PAYMENT DATA FROM DB:', orderPayment);
        
        // Extract payment values for easier access
        const paymentEstimate = orderPayment?.payment_estimate || 0;
        const taxAmount = orderPayment?.tax_amount || 0;
        const scheduleAmount = orderPayment?.schedule_amount || 0;
        const advanceCash = orderPayment?.advance_cash || 0;
        const advanceCardUpi = orderPayment?.advance_card_upi || 0;
        const advanceOther = orderPayment?.advance_other || 0;
        
        // Use stored database values for total_advance and balance instead of recalculating
        const totalAdvance = orderPayment?.total_advance || 0;
        const balance = orderPayment?.balance || 0;
        
        // Log the order payment data to identify the issue
        logDebug('DETAILED ORDER PAYMENT VALUES FROM DATABASE:', {
          raw: orderPayment,
          rawFields: {
            payment_estimate: orderPayment?.payment_estimate,
            tax_amount: orderPayment?.tax_amount,
            schedule_amount: orderPayment?.schedule_amount,
            advance_cash: orderPayment?.advance_cash,
            advance_card_upi: orderPayment?.advance_card_upi,
            advance_other: orderPayment?.advance_other,
            total_advance: orderPayment?.total_advance,  // This should be 100.00 based on your screenshot
            balance: orderPayment?.balance,  // This should be 1000.00 based on your screenshot
          },
          
          // Extracted values
          extractedValues: {
            paymentEstimate,
            taxAmount,
            scheduleAmount,
            advanceCash,
            advanceCardUpi,
            advanceOther,
            totalAdvance,
            balance
          }
        });
        
        // Add these payment values to the suggestion object so they can be used when populating the form
        // IMPORTANT: Use the ACTUAL database values directly without any modification
        item = {
          ...item,
          // Add an explicit flag to mark this as data from database
          isFromDatabase: true,
          // Payment calculation fields - preserve EXACT database values without any transformation
          paymentEstimate: orderPayment?.payment_estimate?.toString() || '0',
          taxAmount: orderPayment?.tax_amount?.toString() || '0',
          schAmt: orderPayment?.schedule_amount?.toString() || '0',
          // Individual advance payment fields - preserve EXACT database values
          cashAdv1: orderPayment?.advance_cash?.toString() || '0',
          ccUpiAdv: orderPayment?.advance_card_upi?.toString() || '0',
          advanceOther: orderPayment?.advance_other?.toString() || '0',
          chequeAdv: orderPayment?.advance_other?.toString() || '0', // Fix: use advance_other, not tax_amount
          // Database generated calculated fields - preserve EXACT database values
          // This is critical for ensuring we display what's actually in the database
          advance: orderPayment?.total_advance?.toString() || '0',
          balance: orderPayment?.balance?.toString() || '0',
          // Add all required fields for SearchSuggestion/PrescriptionFormData
          others: item.others || '',
          cashAdv2: item.cashAdv2 || '0.00',
          cashAdv2Date: item.cashAdv2Date || '',
          applyDiscount: item.applyDiscount || '',
          discountType: item.discountType || 'percentage',
          discountValue: item.discountValue || '',
          discountReason: item.discountReason || '',
          manualEntryType: item.manualEntryType || 'Frames',
          manualEntryItemName: item.manualEntryItemName || '',
          manualEntryRate: item.manualEntryRate || '',
          manualEntryQty: item.manualEntryQty || 1,
          manualEntryItemAmount: item.manualEntryItemAmount || 0,
          currentDateTime: item.currentDateTime || '',
          deliveryDateTime: item.deliveryDateTime || '',
          billed: item.billed || false,
          namePrefix: item.namePrefix || 'Mr.'
        };
        
        // Log the full structure of the payment data for debugging
        logDebug('Found order data:', { 
          latestOrder, 
          orderItems, 
          orderPayment,
          paymentDetails: {
            paymentEstimate,
            scheduleAmount,
            advanceCash,
            advanceCardUpi,
            advanceOther,
            totalAdvance,
            balance
          }
        });
        
        // Helper function to find eye prescription data
        const findEyeData = (eyeType: string, visionType: string, field: string, defaultValue: string = '') => {
          // Log the eyePrescriptions array for debugging
          if (eyeType === 'right' && visionType === 'distance' && field === 'sph') {
            logDebug('Eye Prescriptions array:', eyePrescriptions);
            logDebug('Looking for records with eye_type:', eyeType);
            logDebug('Looking for records with vision_type:', visionType);
            // Detailed inspection of the first record to see field names
            if (eyePrescriptions.length > 0) {
              logDebug('First record details', {
                fieldNames: Object.keys(eyePrescriptions[0]),
                eyeTypeValue: eyePrescriptions[0].eye_type,
                visionTypeValue: eyePrescriptions[0].vision_type
              });
            }
          }
          
          // Convert to lowercase and handle potential differences in field naming
          const prescription = eyePrescriptions.find((ep: any) => {
            // Check for various field name possibilities
            const recordEyeType = ep.eye_type || ep.eyeType || ep.eye;
            const recordVisionType = ep.vision_type || ep.visionType || ep.type;
            
            // Log each record for debugging
            if (eyeType === 'right' && visionType === 'distance' && field === 'sph') {
              logDebug(`Checking record:`, ep);
              logDebug(`Record eye type: ${recordEyeType}, Record vision type: ${recordVisionType}`);
              logDebug(`Comparing with: ${eyeType}, ${visionType}`);
            }
            
            // Map vision types from UI format to database format
            const visionTypeMap: {[key: string]: string[]} = {
              'distance': ['distance', 'dv', 'distance_vision'],
              'near': ['near', 'nv', 'near_vision']
            };
            
            // Check if eye type matches
            const eyeTypeMatches = String(recordEyeType).toLowerCase() === eyeType.toLowerCase();
            
            // Check if vision type matches any of the possible formats
            let visionTypeMatches = false;
            if (visionType in visionTypeMap) {
              visionTypeMatches = visionTypeMap[visionType].includes(String(recordVisionType).toLowerCase());
            } else {
              visionTypeMatches = String(recordVisionType).toLowerCase() === visionType.toLowerCase();
            }
            
            return eyeTypeMatches && visionTypeMatches;
          });
          
          // Log the found prescription for debugging
          if (eyeType === 'right' && visionType === 'distance' && field === 'sph') {
            logDebug(`Found prescription for ${eyeType} eye, ${visionType} vision:`, prescription);
          }
          
          // If we found a matching prescription, extract the requested field
          if (prescription) {
            // Handle field name variations
            let fieldValue = null;
            
            // Map UI field names to possible database field names
            const fieldMappings: {[key: string]: string[]} = {
              'sph': ['sph', 'sphere'],
              'cyl': ['cyl', 'cylinder'],
              'ax': ['ax', 'axis'],
              'add_power': ['add_power', 'add', 'addition'],
              'vn': ['vn', 'visual_acuity', 'va'],
              'rpd': ['rpd', 'right_pd', 'pupillary_distance_right'],
              'lpd': ['lpd', 'left_pd', 'pupillary_distance_left']
            };
            
            // Try all possible field name variations
            if (field in fieldMappings) {
              for (const possibleField of fieldMappings[field]) {
                if (prescription[possibleField] !== undefined) {
                  fieldValue = prescription[possibleField];
                  break;
                }
              }
            } else {
              // If not in our mappings, try direct access
              fieldValue = prescription[field];
            }
            
            // Special case for add_power
            if (field === 'add_power') {
              logDebug(`Found possible add values:`, {
                add_power: prescription.add_power,
                add: prescription.add,
                addition: prescription.addition
              });
            }
            
            return fieldValue || defaultValue;
          }
          
          return defaultValue;
        };
        
        // Helper function to check if a remark type exists
        const hasRemarkType = (remarkType: string) => {
          // Ensure prescriptionRemarks is an array before calling some()
          return Array.isArray(prescriptionRemarks) && 
                 prescriptionRemarks.some((r: any) => r.remark_type === remarkType);
        };
        
        return {
          id: item.id,
          prescriptionNo: item.prescription_no || '',
          referenceNo: item.reference_no || '',
          name: item.name || '',
          title: item.title || 'Mr.',
          age: item.age ? String(item.age) : '',
          gender: item.gender || 'Male',
          customerCode: item.customer_code || '',
          mobileNo: item.mobile_no || '',
          status: item.status || '',
          date: item.date || '',
          class: item.class || '',
          prescribedBy: item.prescribed_by || '',
          birthDay: item.birth_day ? formatDateForInput(item.birth_day) : '',
          marriageAnniversary: item.marriage_anniversary ? formatDateForInput(item.marriage_anniversary) : '',
          address: item.address || '',
          city: item.city || '',
          state: item.state || '',
          pinCode: item.pin_code || '',
          phoneLandline: item.phone_landline || '',
          email: item.email || '',
          ipd: item.ipd || '',
          bookingBy: item.booking_by || '',
          namePrefix: item.title || 'Mr.',
          billed: false,
          balanceLens: item.balance_lens || false,
          rightEye: {
            dv: {
              sph: findEyeData('right', 'distance', 'sph'),
              cyl: findEyeData('right', 'distance', 'cyl'),
              ax: findEyeData('right', 'distance', 'ax'),
              add: findEyeData('right', 'distance', 'add_power'),
              vn: findEyeData('right', 'distance', 'vn', '6/'),
              rpd: findEyeData('right', 'distance', 'rpd')
            },
            nv: {
              sph: findEyeData('right', 'near', 'sph'),
              cyl: findEyeData('right', 'near', 'cyl'),
              ax: findEyeData('right', 'near', 'ax'),
              add: findEyeData('right', 'near', 'add_power'),
              vn: findEyeData('right', 'near', 'vn', 'N')
            }
          },
          leftEye: {
            dv: {
              sph: findEyeData('left', 'distance', 'sph'),
              cyl: findEyeData('left', 'distance', 'cyl'),
              ax: findEyeData('left', 'distance', 'ax'),
              add: findEyeData('left', 'distance', 'add_power'),
              vn: findEyeData('left', 'distance', 'vn', '6/'),
              lpd: findEyeData('left', 'distance', 'lpd')
            },
            nv: {
              sph: findEyeData('left', 'near', 'sph'),
              cyl: findEyeData('left', 'near', 'cyl'),
              ax: findEyeData('left', 'near', 'ax'),
              add: findEyeData('left', 'near', 'add_power'),
              vn: findEyeData('left', 'near', 'vn', 'N')
            }
          },
          remarks: {
            forConstantUse: hasRemarkType('for_constant_use'),
            forDistanceVisionOnly: hasRemarkType('for_distance_vision_only'),
            forNearVisionOnly: hasRemarkType('for_near_vision_only'),
            separateGlasses: hasRemarkType('separate_glasses'),
            biFocalLenses: hasRemarkType('bifocal_lenses'),
            progressiveLenses: hasRemarkType('progressive_lenses'),
            antiReflectionLenses: hasRemarkType('anti_reflection_lenses'),
            antiRadiationLenses: hasRemarkType('anti_radiation_lenses'),
            underCorrected: hasRemarkType('under_corrected')
          },
          selectedItems: orderItems.map((item: any) => ({
            si: item.si || 0,
            itemCode: item.item_code || '',
            itemName: item.item_name || '',
            unit: 'PCS',
            taxPercent: item.tax_percent || 0,
            rate: item.rate || 0,
            qty: item.qty || 1,
            amount: item.amount || 0,
            discountAmount: item.discount_amount || 0,
            discountPercent: item.discount_percent || 0,
            brandName: item.brand_name || '',
            index: item.index || '',
            coating: item.coating || ''
          })) || [],
          orderStatus: latestOrder?.status || 'Processing',
          orderStatusDate: latestOrder?.order_date || '',
          retestAfter: item.retest_after || '',
          billNo: latestOrder?.bill_no || '',
          paymentEstimate: orderPayment?.payment_estimate?.toString() || '0.00',
          schAmt: orderPayment?.schedule_amount?.toString() || '0.00',
          advance: orderPayment?.total_advance?.toString() || '0.00',
          balance: orderPayment?.balance?.toString() || '0.00',
          cashAdv1: orderPayment?.advance_cash?.toString() || '0.00',
          ccUpiAdv: orderPayment?.advance_card_upi?.toString() || '0.00',
          advanceOther: orderPayment?.advance_other?.toString() || '0.00',
          chequeAdv: orderPayment?.advance_other?.toString() || '0.00',
          taxAmount: orderItems.reduce((total: number, item: any) => {
            const itemTaxAmount = (item.amount || 0) * (item.tax_percent || 0) / 100;
            return total + itemTaxAmount;
          }, 0).toString() || '0.00',
          // Add all required fields with defaults if missing
          others: item.others || '',
          cashAdv2: item.cashAdv2 || '0.00',
          cashAdv2Date: item.cashAdv2Date || '',
          applyDiscount: item.applyDiscount || '',
          discountType: item.discountType || 'percentage',
          discountValue: item.discountValue || '',
          discountReason: item.discountReason || '',
          manualEntryType: item.manualEntryType || 'Frames',
          manualEntryItemName: item.manualEntryItemName || '',
          manualEntryRate: item.manualEntryRate || '',
          manualEntryQty: item.manualEntryQty || 1,
          manualEntryItemAmount: item.manualEntryItemAmount || 0,
          currentDateTime: item.currentDateTime || '',
          deliveryDateTime: item.deliveryDateTime || ''
        };
      });
          
        setSuggestions(transformedData);
      } catch (error) {
        logError('Search error:', error);
        setNotification({
          message: error instanceof Error ? `Search error: ${error.message}` : 'An unknown error occurred during search',
          type: 'error',
          visible: true
        });
        setSuggestions([]);
      }
    }, 300);
  };

  // Handle input change for search fields
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Update the form data immediately
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Set the active field and trigger search
    setActiveField(name);
    searchPrescriptions(value, name);
  };
  
  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestion: SearchSuggestion) => {
    logDebug('Selected suggestion:', suggestion);
    logDebug('Title from suggestion:', suggestion.title);
    logDebug('Gender from suggestion:', suggestion.gender);
    
    // Get the prescription ID from the suggestion
    const prescriptionId = suggestion.id;
    let prescriptionNumber = suggestion.prescriptionNo;
    let referenceNumber = suggestion.referenceNo;
    
    // For existing prescriptions, fetch the latest order and payment data directly from database
    let latestOrder: any = null;
    let orderPayment: any = null;
    
    try {
      // Determine if this is a new order or loading an existing prescription
      const isNewOrder = !suggestion.id; // If no ID, it's a new order
      
      // If we have a prescription ID, directly fetch the latest order and payment data
      if (!isNewOrder && prescriptionId) {
        logDebug(`Fetching latest order data for prescription ID: ${prescriptionId}`);
        
        // 1. First get the latest order for this prescription
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('prescription_id', prescriptionId)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (orderError) {
          logError('Error fetching order data:', orderError);
          throw new Error(`Failed to fetch order data: ${orderError.message}`);
        }
        
        if (orderData && orderData.length > 0) {
          latestOrder = orderData[0];
          logDebug('Latest order found:', latestOrder);
          
          // 2. Now fetch the payment data for this order
          const orderId = latestOrder.id;
          const { data: paymentData, error: paymentError } = await supabase
            .from('order_payments')
            .select('*')
            .eq('order_id', orderId)
            .maybeSingle();
            
          if (paymentError) {
            logError('Error fetching payment data:', paymentError);
            throw new Error(`Failed to fetch payment data: ${paymentError.message}`);
          }
          
          if (paymentData) {
            orderPayment = paymentData;
            logDebug('DIRECT DATABASE ORDER PAYMENT DATA:', {
              raw: orderPayment,
              critical_values: {
                payment_estimate: orderPayment.payment_estimate,
                final_amount: orderPayment.final_amount,
                advance_cash: orderPayment.advance_cash,
                advance_card_upi: orderPayment.advance_card_upi,
                advance_other: orderPayment.advance_other,
                total_advance: orderPayment.total_advance,
                balance: orderPayment.balance,
                schedule_amount: orderPayment.schedule_amount
              },
              stringified: {
                payment_estimate: orderPayment.payment_estimate?.toString(),
                balance: orderPayment.balance?.toString()
              }
            });
          } else {
            logDebug('No payment data found for this order');
          }
        } else {
          logDebug('No orders found for this prescription');
        }
      }
      
      // For prescription number and reference number:
      // 1. If it's an existing prescription (has ID), use the original values
      // 2. If it's a new order, generate a new prescription number
      prescriptionNumber = isNewOrder ? await generateUniquePrescriptionNumber() : suggestion.prescriptionNo;
      
      // By default, use prescription number as reference number unless an explicit reference number exists
      if (isNewOrder) {
        // For new orders, default to using prescription number as reference
        referenceNumber = prescriptionNumber;
      } else if (suggestion.referenceNo && suggestion.referenceNo !== suggestion.prescriptionNo) {
        // If there's an existing reference number that's different from prescription number, use it
        referenceNumber = suggestion.referenceNo;
      } else {
        // Otherwise default to using prescription number
        referenceNumber = prescriptionNumber;
      }
      
      // Enhanced payment data debugging
      logDebug('DIRECT PAYMENT DATA FROM DATABASE:', {
        orderPayment: orderPayment ? {
          payment_estimate: orderPayment.payment_estimate,
          tax_amount: orderPayment.tax_amount,
          discount_amount: orderPayment.discount_amount,
          final_amount: orderPayment.final_amount,
          advance_cash: orderPayment.advance_cash,
          advance_card_upi: orderPayment.advance_card_upi,
          advance_other: orderPayment.advance_other,
          total_advance: orderPayment.total_advance,
          balance: orderPayment.balance,
          schedule_amount: orderPayment.schedule_amount
        } : 'No direct payment data available',
        
        suggestionPaymentData: {
          paymentEstimate: suggestion.paymentEstimate,
          schAmt: suggestion.schAmt,
          advance: suggestion.advance,
          balance: suggestion.balance,
          cashAdv1: suggestion.cashAdv1,
          ccUpiAdv: suggestion.ccUpiAdv,
          advanceOther: suggestion.advanceOther
        },
        
        // Show which values will be used in the form
        paymentValuesBeingUsed: {
          paymentEstimate: orderPayment?.payment_estimate?.toString() || suggestion.paymentEstimate || '0.00',
          taxAmount: orderPayment?.tax_amount?.toString() || suggestion.taxAmount || '0.00',
          schAmt: orderPayment?.schedule_amount?.toString() || suggestion.schAmt || '0.00',
          cashAdv1: orderPayment?.advance_cash?.toString() || suggestion.cashAdv1 || '0.00',
          ccUpiAdv: orderPayment?.advance_card_upi?.toString() || suggestion.ccUpiAdv || '0.00',
          advanceOther: orderPayment?.advance_other?.toString() || suggestion.advanceOther || '0.00',
          advance: orderPayment?.total_advance?.toString() || suggestion.advance || '0.00',
          balance: orderPayment?.balance?.toString() || suggestion.balance || '0.00'
        }
      });
      
      logDebug('Order details:', {
        isNewOrder,
        prescriptionNumber,
        referenceNumber,
        suggestionId: suggestion.id
      });
    } catch (error) {
      logError('Error in handleSuggestionSelect:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Populate form data with the selected suggestion's data
    setFormData(prevData => {
      // Get order items from the suggestion (if any)
      const orderItems = suggestion.selectedItems || [];
      
      // Create a new object with all the essential data
      const updatedData = {
        ...prevData,
        id: suggestion.id, // Ensure id is always set from the suggestion
        // Override with the generated prescription number and reference number
        prescriptionNo: prescriptionNumber,
        referenceNo: referenceNumber,
        // Personal Info
        name: suggestion.name || '',
        // Add the missing title and gender fields
        title: suggestion.title || 'Mr.',
        gender: suggestion.gender || 'Male',
        // Ensure age is treated as string for the input value
        age: suggestion.age?.toString() || '',
        mobileNo: suggestion.mobileNo || '',
        email: suggestion.email || '',
        address: suggestion.address || '',
        // CustomerCode is critical for detecting existing database records
        customerCode: suggestion.customerCode || '',
        // Format dates for datetime-local input if necessary
        birthDay: formatDateForInput(suggestion.birthDay), // Assuming birthDay is a date string
        marriageAnniversary: formatDateForInput(suggestion.marriageAnniversary), // Assuming marriageAnniversary is a date string
        city: suggestion.city || '',
        state: suggestion.state || '',
        pinCode: suggestion.pinCode || '',
        phoneLandline: suggestion.phoneLandline || '',
        ipd: suggestion.ipd || '',
        prescribedBy: suggestion.prescribedBy || '', // Assuming prescribedBy is on the Prescription object
        
        // Populate the order items (frames/sun glasses)
        selectedItems: orderItems,
        
        // CRITICAL: Do NOT format or transform any payment values from database
        // Use the raw string values directly to maintain data integrity
        
        // EXTREMELY IMPORTANT: Set isFromDatabase flag to true
        // This tells PaymentSection to use the database values directly without recalculation
        isFromDatabase: true,
        
        // PAYMENT DATA: Use values directly from the database fetch if available
        // Otherwise fall back to the suggestion data
        // This ensures we're using the most up-to-date and accurate payment data
        
        // Payment calculation fields
        paymentEstimate: orderPayment?.payment_estimate?.toString() || suggestion.paymentEstimate || '0.00',
        taxAmount: orderPayment?.tax_amount?.toString() || suggestion.taxAmount || '0.00',
        schAmt: orderPayment?.schedule_amount?.toString() || suggestion.schAmt || '0.00',
        
        // Individual advance payments
        cashAdv1: orderPayment?.advance_cash?.toString() || suggestion.cashAdv1 || '0.00',
        ccUpiAdv: orderPayment?.advance_card_upi?.toString() || suggestion.ccUpiAdv || '0.00',
        advanceOther: orderPayment?.advance_other?.toString() || suggestion.advanceOther || '0.00',
        chequeAdv: orderPayment?.advance_other?.toString() || suggestion.advanceOther || '0.00',
        
        // Database generated columns - use exact number formats
        // IMPORTANT FIX: Ensure we're capturing the exact numeric values from the database
        // The previous implementation may have had formatting issues with the balance
        advance: orderPayment?.total_advance ? parseFloat(orderPayment.total_advance).toFixed(2) : suggestion.advance || '0.00',
        balance: orderPayment?.balance ? parseFloat(orderPayment.balance).toFixed(2) : suggestion.balance || '0.00',
        
        // Log which data source is being used
        // This helps with debugging
        __paymentDataSource: orderPayment ? 'DIRECT_DB_FETCH' : (suggestion.id ? 'SUGGESTION_DATA' : 'NEW_RECORD'),
        
        // Note: currentDateTime and deliveryDateTime are not part of the search result typically,
        // so we keep the existing values or generate new ones as per initial state logic.
        currentDateTime: prevData.currentDateTime, // Keep existing
        deliveryDateTime: prevData.deliveryDateTime, // Keep existing
        class: suggestion.class || '', // Assuming class is on the Prescription object
        bookingBy: latestOrder?.booking_by || suggestion.bookingBy || '', // Use order booking_by first, then prescription bookingBy
        billed: suggestion.billed || false, // Assuming billed is on the Prescription object

        // Prescription Data (Ensure nested structure is handled)
        rightEye: {
          ...prevData.rightEye, // Preserve other rightEye properties if any
          dv: {
            ...prevData.rightEye.dv, // Preserve other rightEye DV properties if any
            sph: suggestion.rightEye?.dv?.sph || '',
            cyl: suggestion.rightEye?.dv?.cyl || '',
            ax: suggestion.rightEye?.dv?.ax || '',
            add: suggestion.rightEye?.dv?.add || '', // maps to add_power in the database
            vn: suggestion.rightEye?.dv?.vn || '6/', // Default if empty
            rpd: suggestion.rightEye?.dv?.rpd || ''
          },
          nv: {
            ...prevData.rightEye.nv, // Preserve other rightEye NV properties if any
            sph: suggestion.rightEye?.nv?.sph || '',
            cyl: suggestion.rightEye?.nv?.cyl || '',
            ax: suggestion.rightEye?.nv?.ax || '',
            add: suggestion.rightEye?.nv?.add || '', // maps to add_power in the database
            vn: suggestion.rightEye?.nv?.vn || 'N' // Default if empty
          }
        },
        leftEye: {
          ...prevData.leftEye, // Preserve other leftEye properties if any
          dv: {
            ...prevData.leftEye.dv, // Preserve other leftEye DV properties if any
            sph: suggestion.leftEye?.dv?.sph || '',
            cyl: suggestion.leftEye?.dv?.cyl || '',
            ax: suggestion.leftEye?.dv?.ax || '',
            add: suggestion.leftEye?.dv?.add || '', // maps to add_power in the database
            vn: suggestion.leftEye?.dv?.vn || '6/', // Default if empty
            lpd: suggestion.leftEye?.dv?.lpd || ''
          },
          nv: {
            ...prevData.leftEye.nv, // Preserve other leftEye NV properties if any
            sph: suggestion.leftEye?.nv?.sph || '',
            cyl: suggestion.leftEye?.nv?.cyl || '',
            ax: suggestion.leftEye?.nv?.ax || '',
            add: suggestion.leftEye?.nv?.add || '', // maps to add_power in the database
            vn: suggestion.leftEye?.nv?.vn || 'N' // Default if empty
          }
        },
        balanceLens: suggestion.balanceLens || false, // Assuming balanceLens is on the Prescription object
        remarks: {
          ...prevData.remarks, // Preserve other remark properties if any
          // Map remarks from the suggestion or use existing values
          forConstantUse: suggestion.remarks?.forConstantUse || prevData.remarks.forConstantUse || false,
          forDistanceVisionOnly: suggestion.remarks?.forDistanceVisionOnly || prevData.remarks.forDistanceVisionOnly || false,
          forNearVisionOnly: suggestion.remarks?.forNearVisionOnly || prevData.remarks.forNearVisionOnly || false,
          separateGlasses: suggestion.remarks?.separateGlasses || prevData.remarks.separateGlasses || false,
          biFocalLenses: suggestion.remarks?.biFocalLenses || prevData.remarks.biFocalLenses || false,
          progressiveLenses: suggestion.remarks?.progressiveLenses || prevData.remarks.progressiveLenses || false,
          antiReflectionLenses: suggestion.remarks?.antiReflectionLenses || prevData.remarks.antiReflectionLenses || false,
          antiRadiationLenses: suggestion.remarks?.antiRadiationLenses || prevData.remarks.antiRadiationLenses || false,
          underCorrected: suggestion.remarks?.underCorrected || prevData.remarks.underCorrected || false
        },
        
        // For form elements that are not directly populated from the API, preserve existing values
        orderStatus: suggestion.orderStatus || prevData.orderStatus,
        orderStatusDate: suggestion.orderStatusDate || prevData.orderStatusDate,
        retestAfter: suggestion.retestAfter || prevData.retestAfter,
        billNo: suggestion.billNo || prevData.billNo,
        // Discount fields
        applyDiscount: prevData.applyDiscount,
        discountType: prevData.discountType, // Corrected field name
        discountReason: prevData.discountReason,
        manualEntryType: prevData.manualEntryType,
        manualEntryItemName: prevData.manualEntryItemName,
        manualEntryRate: prevData.manualEntryRate,
        manualEntryQty: prevData.manualEntryQty,
        manualEntryItemAmount: prevData.manualEntryItemAmount,
        others: suggestion.others || '', // Assuming others is on the Prescription object
        status: suggestion.status || '' // Assuming status is on the Prescription object
      };
      
      if (formData.age) updatedData.age = formData.age.toString();
      if (formData.gender) updatedData.gender = formData.gender;
      (updatedData as any).updated_at = new Date().toISOString();
      return updatedData;
    });
    setActiveField(null);
    setSuggestions([]);
     setNotification({
       message: 'Prescription data loaded from search',
       type: 'success',
       visible: true
     });
  };

  // Keep existing handleChange for non-search fields and nested updates
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
    const { name, value } = e.target;

    // If the changed field is one of the search fields, use the dedicated handler
    if (['prescriptionNo', 'referenceNo', 'name', 'mobileNo'].includes(name)) {
        // Ensure value is a string before passing to handleSearchInputChange
        handleSearchInputChange(e as React.ChangeEvent<HTMLInputElement>);
        return;
    }

    // Handle date inputs to ensure datetime-local format
    if (name === 'currentDateTime' || name === 'deliveryDateTime' ||
        name === 'orderStatusDate' || name === 'retestAfter' ||
        name === 'cashAdv2Date') {
      setFormData(prev => ({
        ...prev,
        [name]: formatDateForInput(value)
      }));
      return;
    }

    // Handle nested properties (e.g., "rightEye.dv.sph")
    if (name.includes('.')) {
      const parts = name.split('.');
      setFormData(prev => {
        const newData: any = { ...prev }; // Use any temporarily for nested updates
        let current = newData;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
             current[parts[i]] = {}; // Initialize if undefined
          }
          current[parts[i]] = { ...current[parts[i]] };
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
        return newData as PrescriptionFormData; // Cast back to the correct type
      });
    } else {
      // Handle top-level properties
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle checkbox changes including balanceLens with special handling
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    
    // Updated: Match Prescription page logic for balanceLens
    if (name === 'balanceLens') {
      setFormData(prev => {
        const newState = {
          ...prev,
          balanceLens: checked
        };
        if (checked) {
          newState.leftEye = {
            ...prev.leftEye,
            dv: {
              ...prev.rightEye.dv,
              lpd: prev.leftEye.dv.lpd // Keep original LPD
            },
            nv: { ...prev.rightEye.nv }
          };
        }
        return newState;
      });
      return;
    }
    
    if (name.includes('.')) {
      // Handle nested checkbox properties
      const parts = name.split('.');
      setFormData(prev => {
        const newData: any = { ...prev };
        let current = newData;
        for (let i = 0; i < parts.length - 1; i++) {
           if (!current[parts[i]]) {
             current[parts[i]] = {};
          }
          current[parts[i]] = { ...current[parts[i]] };
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = checked;
        return newData as PrescriptionFormData;
      });
    } else {
      // Handle top-level checkbox properties
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    }
  };

  // Keep existing handleNumericInputChange
  const handleNumericInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Skip processing if name is undefined
    if (!name) {
      logError('Input name is undefined in handleNumericInputChange');
      return;
    }

    let processedValue = value;

    // For RPD and LPD fields, allow direct input without formatting
    if (name.includes('rpd') || name.includes('lpd')) {
      processedValue = value;
    } else if (name.includes('ax')) {
      // For axial, ensure integer between 0-180
      processedValue = value.replace(/[^0-9]/g, '');
      const numValue = parseInt(processedValue, 10);
      if (!isNaN(numValue)) {
         if (numValue > 180) {
           processedValue = '180';
         } else if (numValue < 0) {
            processedValue = '0';
         }
      } else {
        processedValue = '';
      }
    } else {
      // For other numeric fields, allow numbers, decimal point, and negative sign
      processedValue = value.replace(/[^0-9.-]/g, '');
    }

    // Create a synthetic event with the processed value
    const syntheticEvent = {
      ...e,
      target: {
        ...e.target,
        name: name,
        value: processedValue,
      }
    } as React.ChangeEvent<HTMLInputElement>;

    // Call the main handleChange with the synthetic event (this will now route back to handleSearchInputChange for search fields if applicable)
    handleChange(syntheticEvent);
    
    // After handling the change, check if this is a payment field and recalculate balance if needed
    if (['paymentEstimate', 'cashAdv1', 'ccUpiAdv', 'advanceOther'].includes(name)) {
      updateBalanceAfterPaymentChange();
      logDebug('Payment field changed, recalculated balance', { name, value: processedValue });
    }
  };
  
  // Function to recalculate advance and balance whenever payment fields change
  const updateBalanceAfterPaymentChange = () => {
    // CRITICAL: This function should only be used for NEW users
    // For existing database records, we should never modify balance/advance directly
    setFormData(prev => {
      // First check for the explicit isFromDatabase flag added during data loading
      // This is the most reliable way to detect records from database
      const isExistingRecord = 
        // First priority: explicit flag set during data loading
        prev.isFromDatabase === true || 
        // Second priority: has prescription number and reference number
        ((prev.prescriptionNo && prev.prescriptionNo !== '') && 
         (prev.referenceNo && prev.referenceNo !== '')) || 
        // Third priority: has database-populated payment values
        (prev.advance && prev.advance !== '0' && prev.advance !== '0.00');
      
      // Get current payment values - ensure empty strings are treated as 0
      const paymentEstimate = prev.paymentEstimate === '' ? 0 : parseFloat(prev.paymentEstimate || '0');
      const cashAdv1 = prev.cashAdv1 === '' ? 0 : parseFloat(prev.cashAdv1 || '0');
      const ccUpiAdv = prev.ccUpiAdv === '' ? 0 : parseFloat(prev.ccUpiAdv || '0');
      const advanceOther = prev.advanceOther === '' ? 0 : parseFloat(prev.advanceOther || '0');
      
      // Calculate total advance correctly using the three advance payment types
      // Per the database design: total_advance = advance_cash + advance_card_upi + advance_other
      const totalAdvance = cashAdv1 + ccUpiAdv + advanceOther;
      
      // Calculate balance - payment estimate minus total advance
      const balance = Math.max(0, paymentEstimate - totalAdvance);
      
      logDebug('Payment calculation:', {
        isExistingRecord,
        inputs: {
          paymentEstimate,
          cashAdv1, 
          ccUpiAdv,
          advanceOther,
          existingAdvance: prev.advance,
          existingBalance: prev.balance
        },
        calculated: {
          totalAdvance,
          balance
        }
      });
      
      // CRITICAL: For existing records from database, preserve their values
      // Only update payment fields for new records
      if (isExistingRecord) {
        // For existing records, only update the input fields and leave the database-calculated
        // fields (advance, balance) alone
        return prev;
      } else {
        // For new records, update the calculated fields
        return {
          ...prev,
          advance: totalAdvance.toFixed(2),
          balance: balance.toFixed(2)
        };
      }
    });
  };

   // Helper functions for manual entry (Keep these)
  const handleManualEntryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target; // Removed unused 'type' variable

    const processedValue = (name === 'manualEntryQty') ? parseInt(value) || 0 : (name === 'manualEntryRate' || name === 'manualEntryItemAmount') ? parseFloat(value) || 0 : value;

    setFormData(prev => ({
      ...prev,
      [name]: processedValue,
    }));
  };

  const handleAddManualEntry = (type: 'Frames' | 'Sun Glasses') => {
    setSelectedItemType(type);
    setShowItemSelectionPopup(true);
  };

  const handleAddItemClick = (type: 'Frames' | 'Sun Glasses') => {
    setFormData(prev => ({
      ...prev,
      manualEntryType: type,
      manualEntryItemName: '',
      manualEntryRate: '',
      manualEntryQty: 1,
      manualEntryItemAmount: 0.00
    }));
    setShowItemSelectionPopup(false);
    setShowManualEntryPopup(true);
  };

  const handleAddManualEntryItem = () => {
    if (!formData.manualEntryItemName || !formData.manualEntryRate) {
      setNotification({
        message: 'Please enter both item name and rate',
        type: 'error',
        visible: true,
      });
      return;
    }

    const newItem: SelectedItem = {
      si: formData.selectedItems.length + 1,
      itemCode: generateItemCode(formData.manualEntryType), // Assuming generateItemCode exists
      itemName: formData.manualEntryItemName,
      unit: 'PCS',
      taxPercent: 0,
      rate: parseFloat(formData.manualEntryRate),
      qty: formData.manualEntryQty || 1,
      amount: parseFloat(formData.manualEntryRate) * (formData.manualEntryQty || 1),
      discountAmount: 0,
      discountPercent: 0
    };

    setFormData(prev => ({
      ...prev,
      selectedItems: [...prev.selectedItems, newItem],
      manualEntryItemName: '',
      manualEntryRate: '',
      manualEntryQty: 1,
      manualEntryItemAmount: 0
    }));
    setShowManualEntryPopup(false);
     setNotification({
       message: 'Manual item added',
       type: 'success',
       visible: true
     });
  };

  const handleDeleteItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      selectedItems: prev.selectedItems.filter((_, i) => i !== index)
    }));
    setNotification({
      message: 'Item deleted',
      type: 'success',
      visible: true
    });
  };
  
  // Form submission handler
  const handleOrderCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Recalculate advance and balance before submitting to ensure they're up-to-date
    updateBalanceAfterPaymentChange();
    
    // Add a small delay to ensure the state update completes before submission
    setTimeout(() => {
      logInfo('Order Card Form Submitted', { prescriptionNo: formData.prescriptionNo, referenceNo: formData.referenceNo, user: formData.name });
      
      // Call the function to save the order to the database
      saveOrderToDatabase();
    }, 100);
  };
  
  // Function to save order data to the database
  // Check if reference number is unique before saving
  const validateReferenceNumber = async (referenceNo: string, currentPrescriptionId?: string): Promise<boolean> => {
    if (!referenceNo || referenceNo === formData.prescriptionNo) {
      return true; // Empty or same as prescription number is valid
    }
    
    try {
      let query = supabase
        .from('prescriptions')
        .select('id')
        .eq('reference_no', referenceNo);

      // Only add .neq if currentPrescriptionId is present and non-empty
      if (currentPrescriptionId) {
        query = query.neq('id', currentPrescriptionId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      
      if (data) {
        setNotification({
          message: 'This reference number is already in use. Please use a different one.',
          type: 'error',
          visible: true
        });
        return false;
      }
      return true;
    } catch (error) {
      logError('Error validating reference number:', error);
      setNotification({
        message: 'Error validating reference number. Please try again.',
        type: 'error',
        visible: true
      });
      return false;
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  const saveOrderToDatabase = async () => {
    setIsSaving(true);
    try {
      logInfo('Starting to save order to database', { prescriptionNo: formData.prescriptionNo, referenceNo: formData.referenceNo });
      
      // 1. Generate a prescription number if it doesn't exist
      if (!formData.prescriptionNo) {
        logInfo('Generating new prescription number');
        const newPrescriptionNo = await generateUniquePrescriptionNumber();
        setFormData(prev => ({
          ...prev,
          prescriptionNo: newPrescriptionNo,
          // Only set referenceNo if it's empty or matches the old prescription number
          referenceNo: !prev.referenceNo || prev.referenceNo === prev.prescriptionNo 
            ? newPrescriptionNo 
            : prev.referenceNo
        }));
      }
      
      // 2. Validate reference number if it's different from prescription number
      if (formData.referenceNo && formData.referenceNo !== formData.prescriptionNo) {
        logInfo('Validating reference number');
        const isValid = await validateReferenceNumber(formData.referenceNo, formData.id);
        if (!isValid) {
          logInfo('Reference number validation failed');
          return;
        }
      } else if (!formData.referenceNo) {
        // If reference number is empty, set it to match prescription number
        logInfo('Setting reference number to match prescription number');
        setFormData(prev => ({
          ...prev,
          referenceNo: prev.prescriptionNo
        }));
        // Wait for state update to complete
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      logInfo('All validations passed, proceeding with save');
      
      // Validate required fields
      if (!formData.name || formData.name.trim() === '') {
        setNotification({
          message: 'Please enter customer name',
          type: 'error',
          visible: true
        });
        return;
      }
      
      if (!formData.prescriptionNo || formData.prescriptionNo.trim() === '') {
        setNotification({
          message: 'Please enter prescription number',
          type: 'error',
          visible: true
        });
        return;
      }
      
      if (!formData.mobileNo || formData.mobileNo.trim() === '') {
        setNotification({
          message: 'Please enter mobile number',
          type: 'error',
          visible: true
        });
        return;
      }
      
      // Basic mobile number validation (10 digits)
      const mobileRegex = /^\d{10}$/;
      if (!mobileRegex.test(formData.mobileNo.trim())) {
        setNotification({
          message: 'Please enter a valid 10-digit mobile number',
          type: 'error',
          visible: true
        });
        return;
      }
      
      // First, try to find an existing prescription by using multiple identifiers
      // This ensures we update existing records instead of creating duplicates
      let prescriptionId = ''; // Initialize with empty string to avoid TypeScript errors
      let isExistingRecord = false;
      
      try {
        logInfo('Checking for existing prescription with multiple identifiers');
        
        // Try to find by customer code first if available
        if (formData.customerCode && formData.customerCode !== '') {
          const { data: prescByCustomerCode, error: customerCodeError } = await supabase
            .from('prescriptions')
            .select('id')
            .eq('customer_code', formData.customerCode)
            .single();
            
          if (!customerCodeError && prescByCustomerCode) {
            prescriptionId = prescByCustomerCode.id;
            isExistingRecord = true;
            logInfo('Found existing prescription by customer code', { id: prescByCustomerCode.id });
          }
        }
        
        // Try by prescription number if not found by customer code
        if (!isExistingRecord && formData.prescriptionNo && formData.prescriptionNo !== '') {
          const { data: prescByNumber, error: prescNumError } = await supabase
            .from('prescriptions')
            .select('id')
            .eq('prescription_no', formData.prescriptionNo)
            .single();
          
          if (!prescNumError && prescByNumber) {
            // Found by prescription number
            prescriptionId = prescByNumber.id;
            isExistingRecord = true;
            logInfo('Found existing prescription by prescription number', { id: prescByNumber.id });
          }
        }
        
        // Try by reference number if still not found
        if (!isExistingRecord && formData.referenceNo && formData.referenceNo !== '') {
          const { data: prescByRef, error: prescRefError } = await supabase
            .from('prescriptions')
            .select('id')
            .eq('reference_no', formData.referenceNo)
            .single();
            
          if (!prescRefError && prescByRef) {
            // Found by reference number
            prescriptionId = prescByRef.id;
            isExistingRecord = true;
            logInfo('Found existing prescription by reference number', { id: prescByRef.id });
          }
        }
        
        // If still not found and mobile number exists, try by mobile
        if (!isExistingRecord && formData.mobileNo && formData.mobileNo !== '') {
          const { data: prescByMobile, error: prescMobileError } = await supabase
            .from('prescriptions')
            .select('id')
            .eq('mobile_no', formData.mobileNo)
            .single();
            
          if (!prescMobileError && prescByMobile) {
            // Found by mobile number
            prescriptionId = prescByMobile.id;
            isExistingRecord = true;
            logInfo('Found existing prescription by mobile number', { id: prescByMobile.id });
          }
        }
        
        // If no existing record was found, create a new one
        if (!isExistingRecord) {
          logInfo('No existing prescription found, creating new one');
          
          // Ensure we have valid prescription and reference numbers
          const prescriptionNoToSave = formData.prescriptionNo || await generateUniquePrescriptionNumber();
          const referenceNoToSave = formData.referenceNo || prescriptionNoToSave;
          
          // Check if there's a prescription with the same mobile_no and source 'OrderCard'
          let existingOrderCardPrescription = null;
          if (formData.mobileNo && formData.mobileNo.trim() !== '') {
            const { data: existingPrescription, error: findError } = await supabase
              .from('prescriptions')
              .select('id')
              .eq('mobile_no', formData.mobileNo)
              .eq('source', 'OrderCard')
              .maybeSingle();
              
            if (!findError && existingPrescription) {
              existingOrderCardPrescription = existingPrescription;
              logInfo('Found existing OrderCard prescription with same mobile number', { id: existingPrescription.id });
            }
          }
          
          if (existingOrderCardPrescription) {
            // Use existing OrderCard prescription
            prescriptionId = existingOrderCardPrescription.id;
            isExistingRecord = true;
            logInfo('Reusing existing OrderCard prescription ID', { id: prescriptionId });
            
            // Update the existing record with new data
            const { error: updateError } = await supabase
              .from('prescriptions')
              .update({
                prescription_no: prescriptionNoToSave,
                reference_no: referenceNoToSave,
                updated_at: new Date().toISOString()
                // Add other fields that should be updated
              })
              .eq('id', prescriptionId);
              
            if (updateError) {
              logError('Error updating existing prescription:', updateError);
              throw new Error(`Failed to update prescription: ${updateError.message}`);
            }
            logInfo('Updated existing prescription with new data');
          } else {
            // Create a new prescription with all available fields and source='OrderCard'
            const { data: newPrescription, error: createError } = await supabase
              .from('prescriptions')
              .insert({
                prescription_no: prescriptionNoToSave,
                reference_no: referenceNoToSave,
                name: formData.name || 'Unnamed', // Required field
                prescribed_by: formData.prescribedBy || 'Order Card System', // Default to Order Card System
                date: formData.date || new Date().toISOString().split('T')[0], // Required field
                mobile_no: formData.mobileNo,
                email: formData.email,
                address: formData.address,
                city: formData.city,
                state: formData.state,
                pin_code: formData.pinCode,
                source: 'OrderCard',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                age: formData.age,
                gender: formData.gender,
                customer_code: formData.customerCode
              })
              .select('id')
              .single();
              
            if (createError || !newPrescription) {
              throw new Error(`Failed to create prescription: ${createError?.message || 'Unknown error'}`);
            }
            
            prescriptionId = newPrescription.id;
            logInfo('Created new prescription with OrderCard source', { id: newPrescription.id });
          }
        } else {
          // If we found an existing record, make sure we update all relevant fields
          logInfo('Updating existing prescription', { id: prescriptionId });
          
          // Update the prescription with current form data to ensure all fields are current
          const updateData: Record<string, any> = {};
          
          // CRITICAL: Always include ALL required fields to avoid not-null constraint violations
          
          // name is a required field (NOT NULL)
          updateData.name = formData.name || 'Unnamed';
          
          // prescribed_by is a required field (NOT NULL)
          updateData.prescribed_by = formData.prescribedBy || 'Order Card System';
          
          // date is a required field (NOT NULL)
          updateData.date = formData.date || new Date().toISOString().split('T')[0];
          
          // prescription_no is a required field (NOT NULL) and must be unique
          updateData.prescription_no = formData.prescriptionNo || '';
          
          // Set source to 'OrderCard' for existing records that might not have it set
          updateData.source = 'OrderCard';
          
          // Optional fields - only update if they have values
          if (formData.mobileNo) updateData.mobile_no = formData.mobileNo;
          if (formData.email) updateData.email = formData.email;
          if (formData.address) updateData.address = formData.address;
          if (formData.city) updateData.city = formData.city;
          if (formData.state) updateData.state = formData.state;
          if (formData.pinCode) updateData.pin_code = formData.pinCode;
          if (formData.age) updateData.age = formData.age;
          if (formData.gender) updateData.gender = formData.gender;
          if (formData.customerCode) updateData.customer_code = formData.customerCode;
          if (formData.bookingBy) updateData.booking_by = formData.bookingBy;
          
          // Add updated_at timestamp
          updateData.updated_at = new Date().toISOString();
          
          // Only perform update if we have fields to update
          if (Object.keys(updateData).length > 1) { // > 1 because we always have updated_at
            // Include the ID in the update data to make this an upsert operation
            // This will use POST instead of PATCH behind the scenes, avoiding CORS issues
            const { error: updateError } = await supabase
              .from('prescriptions')
              .upsert({
                id: prescriptionId,
                ...updateData
              });
              
            if (updateError) {
              logError('Error updating prescription:', updateError);
            } else {
              logInfo('Successfully updated prescription data');
            }
          }
        }
      } catch (lookupError) {
        logError('Exception during prescription handling:', lookupError);
        setNotification({
          message: `Error with prescription: ${lookupError instanceof Error ? lookupError.message : 'Unknown error'}`,
          type: 'error',
          visible: true
        });
        return;
      }
      
      // prescriptionId is now set either from found prescription or newly created one
         // Save all eye prescription fields (DV/NV) to eye_prescriptions table
      try {
        // Ensure gender is 'Male' | 'Female' for PrescriptionData
        const formDataForSave = {
          ...formData,
          gender: (formData.gender === 'Male' || formData.gender === 'Female') ? formData.gender : 'Male',
        } as import('../../types').PrescriptionData;
        await prescriptionService.autoSavePrescription(formDataForSave, prescriptionId);
        logInfo('Successfully saved eye prescription (DV/NV) data');
      } catch (autoSaveError) {
        logError('Error saving eye prescription (DV/NV) data:', autoSaveError);
        setNotification({
          message: `Error saving lens prescription: ${autoSaveError instanceof Error ? autoSaveError.message : 'Unknown error'}`,
          type: 'error',
          visible: true
        });
        return;
      }

      // Use the existing order number or generate a new one
      const orderNumber = formData.referenceNo || `ORD-${Date.now()}`;
      
      // First check if an order with this prescription already exists
      // This is more reliable than checking by order number alone
      let existingOrder = null;
      let orderCheckError = null;
      
      try {
        logInfo('Looking for existing order with prescriptionId', { id: prescriptionId });
        const { data: orderByPrescription, error: prescOrderError } = await supabase
          .from('orders')
          .select('id')
          .eq('prescription_id', prescriptionId)
          .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no record found
        
        if (!prescOrderError && orderByPrescription) {
          existingOrder = orderByPrescription;
          logInfo('Found existing order by prescriptionId', { id: existingOrder.id });
        } else if (formData.referenceNo) {
          // If not found by prescription ID, try by order number/reference
          const { data: orderByNumber, error: orderNumError } = await supabase
            .from('orders')
            .select('id')
            .eq('order_no', orderNumber)
            .maybeSingle();
            
          if (!orderNumError && orderByNumber) {
            existingOrder = orderByNumber;
            logInfo('Found existing order by orderNumber', { id: existingOrder.id });
          } else {
            orderCheckError = orderNumError;
          }
        }
      } catch (lookupErr) {
        logError('Error looking up existing order:', lookupErr);
        orderCheckError = { message: lookupErr instanceof Error ? lookupErr.message : 'Unknown error' };
      }
        
      logInfo('Existing order check results', { existingOrder, orderCheckError: orderCheckError ? `Error: ${orderCheckError.message}` : '' });
      
      // Prepare order data
      const orderData = {
        // Fix the prescriptionId to pass the ID value, not an object
        prescriptionId: prescriptionId,
        orderNo: orderNumber,
        billNo: formData.billNo || '',
        orderDate: formData.date,
        deliveryDate: formData.deliveryDateTime?.split('T')[0] || new Date().toISOString().split('T')[0], // Added fallback
        status: formData.orderStatus || 'Processing',
        remarks: 'General notes for the order',
        bookingBy: formData.bookingBy || '', // Add bookingBy field
        
        // Map the items
        items: formData.selectedItems.map((item, index) => {
          // Determine the item type based on itemCode or itemName
          let itemType = 'Other';
          
          // Check if item code has prefixes that indicate type
          if (item.itemCode) {
            if (item.itemCode.startsWith('FRM')) {
              itemType = 'Frames';
            } else if (item.itemCode.startsWith('SUN')) {
              itemType = 'Sun Glasses';
            } else if (item.itemCode.startsWith('LEN')) {
              itemType = 'Lens';
            }
          }
          
          // Or check if item name contains type indicators
          if (itemType === 'Other' && item.itemName) {
            const nameLower = item.itemName.toLowerCase();
            if (nameLower.includes('frame')) {
              itemType = 'Frames';
            } else if (nameLower.includes('sun') || nameLower.includes('glass')) {
              itemType = 'Sun Glasses';
            } else if (nameLower.includes('lens')) {
              itemType = 'Lens';
            }
          }
          
          return {
            si: index + 1,
            itemType,
            itemCode: item.itemCode || '',
            itemName: item.itemName || '',
            rate: typeof item.rate === 'string' ? parseFloat(item.rate) : Number(item.rate),
            qty: item.qty,
            amount: typeof item.amount === 'string' ? parseFloat(item.amount) : Number(item.amount),
            taxPercent: item.taxPercent || 0,
            discountPercent: item.discountPercent || 0,
            discountAmount: item.discountAmount ? 
              (typeof item.discountAmount === 'string' ? parseFloat(item.discountAmount) : Number(item.discountAmount)) : 0,
            brandName: item.brandName || '',
            index: item.index || '',
            coating: item.coating || ''
          };
        }),
        
        // Map payment details - ensure empty strings are treated as 0
        payment: {
          paymentEstimate: formData.paymentEstimate === '' ? 0 : parseFloat(formData.paymentEstimate || '0'),
          taxAmount: formData.taxAmount === '' ? 0 : parseFloat(formData.taxAmount || '0'), // Use the new taxAmount field
          discountAmount: formData.schAmt === '' ? 0 : parseFloat(formData.schAmt || '0'), // Total discount
          // CRITICAL FIX: finalAmount must equal paymentEstimate
          // The database uses finalAmount to calculate the balance
          // This must be correctly set for the balance to update
          finalAmount: (formData.paymentEstimate === '' ? 0 : parseFloat(formData.paymentEstimate || '0')),
          advanceCash: formData.cashAdv1 === '' ? 0 : parseFloat(formData.cashAdv1 || '0'),
          advanceCardUpi: formData.ccUpiAdv === '' ? 0 : parseFloat(formData.ccUpiAdv || '0'),
          advanceOther: formData.advanceOther === '' ? 0 : parseFloat(formData.advanceOther || '0'), // Use advanceOther instead of chequeAdv
          scheduleAmount: formData.schAmt === '' ? 0 : parseFloat(formData.schAmt || '0')
          
          // IMPORTANT: Do NOT include total_advance and balance here
          // These are GENERATED columns in the database and will be automatically calculated
          // Including them here was causing double calculation and incorrect values
        }
      };
      
      logInfo('Prepared order data', { orderData });
      
      let result;
      if (existingOrder) {
        // If order exists, update it instead of recreating it
        logInfo('Updating existing order', { id: existingOrder.id });
        
        try {
          // 1. Update the main order record using upsert to avoid CORS PATCH issues
          // This uses POST instead of PATCH behind the scenes
          const { error: orderUpdateError } = await supabase
            .from('orders')
            .upsert({
              id: existingOrder.id, // Including ID makes this an update operation
              prescription_id: orderData.prescriptionId, // Must include this to satisfy not-null constraint
              order_no: orderData.orderNo, // Add order_no to satisfy not-null constraint
              bill_no: orderData.billNo,
              order_date: orderData.orderDate,
              delivery_date: orderData.deliveryDate,
              status: orderData.status,
              remarks: orderData.remarks,
              booking_by: formData.bookingBy || '', // Add booking_by field
              updated_at: new Date().toISOString()
            })
            .eq('id', existingOrder.id);
            
          if (orderUpdateError) {
            logError('Error updating order:', orderUpdateError);
            throw new Error(`Failed to update order: ${orderUpdateError.message}`);
          }
          
          // 2. Delete existing order items for this order
          const { error: itemsDeleteError } = await supabase
            .from('order_items')
            .delete()
            .eq('order_id', existingOrder.id);
            
          // Log the deletion for debugging
          logInfo('Deleted order items for order', { id: existingOrder.id });
            
          if (itemsDeleteError) {
            logError('Error deleting order items:', itemsDeleteError);
            throw new Error(`Failed to delete order items: ${itemsDeleteError.message}`);
          }
          
          // 3. Insert new order items
          const orderItems = orderData.items.map(item => {
            // The itemType field has already been determined in the orderData preparation stage
            return {
              order_id: existingOrder.id,
              si: item.si,
              item_type: item.itemType, // Already contains 'Frames', 'Sun Glasses', 'Lens', or 'Other'
              item_code: item.itemCode,
              item_name: item.itemName,
              rate: item.rate,
              qty: item.qty,
              amount: item.amount,
              tax_percent: item.taxPercent,
              discount_percent: item.discountPercent,
              discount_amount: item.discountAmount,
              brand_name: item.brandName,
              index: item.index,
              coating: item.coating
            };
          });
          
          const { error: itemsInsertError } = await supabase
            .from('order_items')
            .insert(orderItems);
            
          if (itemsInsertError) {
            logError('Error inserting order items:', itemsInsertError);
            throw new Error(`Failed to insert order items: ${itemsInsertError.message}`);
          }
          
          // 4. Check if payment record exists for this order
          const { data: existingPayment, error: paymentCheckError } = await supabase
            .from('order_payments')
            .select('*')
            .eq('order_id', existingOrder.id)
            .maybeSingle();
            
          if (paymentCheckError) {
            logError('Error checking payment record:', paymentCheckError);
            throw new Error(`Failed to check payment record: ${paymentCheckError.message}`);
          }
          
          // IMPORTANT: Use the EXACT values from the UI without recalculation
          // Just parse them to ensure they're proper numbers
          const advanceCash = parseFloat(formData.cashAdv1 || '0');
          const advanceCardUpi = parseFloat(formData.ccUpiAdv || '0');
          const advanceOther = parseFloat(formData.advanceOther || '0');
          
          // Use the EXACT payment estimate from the UI without modifying it
          const paymentEstimate = parseFloat(formData.paymentEstimate || '0');
          
          // Other values directly from UI
          const taxAmount = parseFloat(formData.taxAmount || '0');
          const discountAmount = parseFloat(formData.schAmt || '0');
          const scheduleAmount = parseFloat(formData.schAmt || '0');
          
          // CRITICAL: final_amount must be payment_estimate MINUS discount_amount
          // This is how the UI calculates it, and we need to match that for the database
          // Otherwise the database's balance calculation will be incorrect
          const finalAmount = paymentEstimate - discountAmount;
          
          // For logging purposes
          const calculatedTotalAdvance = advanceCash + advanceCardUpi + advanceOther;
          const calculatedBalance = Math.max(0, finalAmount - calculatedTotalAdvance);
          
          // Log the exact values being sent to the database and expected calculation results
          logDebug('PAYMENT VALUES BEING SAVED TO DATABASE:', {
            // Values being sent to database
            sentValues: {
              advanceCash,
              advanceCardUpi,
              advanceOther,
              paymentEstimate,
              finalAmount, // This is now correctly calculated as paymentEstimate - discountAmount
              taxAmount,
              discountAmount,
              scheduleAmount
            },
            // Raw input values from the form
            rawFormData: {
              cashAdv1: formData.cashAdv1,
              ccUpiAdv: formData.ccUpiAdv,
              advanceOther: formData.advanceOther,
              paymentEstimate: formData.paymentEstimate,
              taxAmount: formData.taxAmount,
              schAmt: formData.schAmt
            },
            // Expected database-generated values
            expectedGenerated: {
              total_advance: calculatedTotalAdvance.toFixed(2),
              balance: calculatedBalance.toFixed(2)
            },
            // Values shown in UI
            uiValues: {
              advance: formData.advance,
              balance: formData.balance
            }
          });
          
          // IMPORTANT: For updates, we use UPSERT pattern to handle both new and existing payment records
          // The order_payments table has GENERATED columns (total_advance, balance) that are calculated
          // from raw fields. We only update the raw fields and let the database calculate the generated fields.
          const paymentData = {
            order_id: existingOrder.id,
            payment_estimate: paymentEstimate,  // This is exactly what's shown in the UI (should be 1100)
            tax_amount: taxAmount,
            discount_amount: discountAmount,
            final_amount: finalAmount,       // This now equals paymentEstimate exactly as shown in the UI
            advance_cash: advanceCash,       // Raw field
            advance_card_upi: advanceCardUpi, // Raw field
            advance_other: advanceOther,     // Raw field
            schedule_amount: formData.schAmt, // Fixed reference to use formData.schAmt instead of undefined scheduleAmount
            updated_at: new Date().toISOString() 
          };
          
          // Use upsert for payment records to avoid CORS PATCH issues
          logInfo(existingPayment ? 'Updating existing payment record' : 'Creating new payment record for existing order');
          
          // If payment exists, include its ID to make this an update operation
          const paymentDataWithId = existingPayment 
            ? { ...paymentData, id: existingPayment.id } 
            : paymentData;
            
          // Upsert uses POST instead of PATCH behind the scenes
          const paymentUpdateResult = await supabase
            .from('order_payments')
            .upsert(paymentDataWithId);
            
          logInfo('Payment upsert result', { paymentUpdateResult });
          
          if (paymentUpdateResult.error) {
            logError('Error updating/inserting payment:', paymentUpdateResult.error);
            throw new Error(`Failed to update payment: ${paymentUpdateResult.error.message}`);
          }
          
          logInfo('Payment update/insert successful. Verifying database values...');
          
          // Directly verify and fix the database values if needed
          try {
            // First, get the current values from the database after our update
            const { data: currentPayment, error: fetchError } = await supabase
              .from('order_payments')
              .select('*')
              .eq('order_id', existingOrder.id)
              .single();
              
            if (fetchError) throw fetchError;
            
            logInfo('CURRENT DATABASE VALUES AFTER UPDATE:', currentPayment);
            
            // Verify that total_advance (generated column) equals sum of individual advances
            const expectedTotalAdvance = advanceCash + advanceCardUpi + advanceOther;
            const expectedBalance = Math.max(0, finalAmount - expectedTotalAdvance);
            
            logInfo('VERIFICATION:', {
              expectedTotalAdvance,
              actualTotalAdvance: currentPayment.total_advance,
              expectedBalance,
              actualBalance: currentPayment.balance,
              match: {
                totalAdvance: Math.abs(expectedTotalAdvance - currentPayment.total_advance) < 0.01,
                balance: Math.abs(expectedBalance - currentPayment.balance) < 0.01
              }
            });
            
            // Double-check with a direct SQL update only if necessary
            if (Math.abs(expectedTotalAdvance - currentPayment.total_advance) >= 0.01 || 
                Math.abs(expectedBalance - currentPayment.balance) >= 0.01) {
              
              logInfo('Mismatch detected. Attempting direct SQL update...');
              
              // As a fallback, try to update via a direct upsert with only the critical fields
              // This avoids CORS issues with RPC calls that might use PATCH
              logInfo('Attempting direct upsert with critical payment fields...');
              
              try {
                // First, get full current payment data
                const { data: fullPayment } = await supabase
                  .from('order_payments')
                  .select('*')
                  .eq('order_id', existingOrder.id)
                  .single();
                  
                if (fullPayment) {
                  // Create a complete update with just the modified advance fields
                  const criticalUpdate = {
                    id: fullPayment.id,
                    order_id: existingOrder.id,
                    advance_cash: advanceCash,
                    advance_card_upi: advanceCardUpi,
                    advance_other: advanceOther,
                    final_amount: finalAmount,  // Critical for balance calculation
                    updated_at: new Date().toISOString()
                  };
                  
                  const { data: updateResult, error: upsertError } = await supabase
                    .from('order_payments')
                    .upsert(criticalUpdate);
                    
                  if (upsertError) {
                    logError('Payment correction upsert error:', upsertError instanceof Error ? upsertError.message : 'Unknown error');
                  } else {
                    logInfo('Payment correction successful:', updateResult);
                  }
                } else {
                  logError('Could not find payment record for correction');
                }
              } catch (correctionError) {
                logError('Error during payment correction:', correctionError instanceof Error ? correctionError.message : 'Unknown error');
              }
            }
          } catch (verificationError) {
            logError('Error during verification:', verificationError);
          }
          
          logInfo('Successfully updated order and related records');
          result = { 
            success: true, 
            message: 'Order updated successfully', 
            orderId: existingOrder.id 
          };
        } catch (updateError) {
          logError('Error during order update process:', updateError);
          result = { 
            success: false, 
            message: updateError instanceof Error ? updateError.message : 'Unknown error during update' 
          };
        }
      } else {
        // If no existing order, create a new one
        logInfo('Creating new order');
        result = await orderService.saveOrder(orderData);
      }
      
      if (result && result.success) {
        logInfo('Order saved successfully', { orderId: result.orderId, prescriptionNo: formData.prescriptionNo });
        setNotification({
          message: isExistingRecord ? 'Order updated successfully!' : 'Order created successfully!',
          type: 'success',
          visible: true
        });
      } else {
        logError('Order save failed', result?.message);
        setNotification({
          message: result?.message || 'Order save failed',
          type: 'error',
          visible: true
        });
      }
    } catch (error) {
      logError('Error in saveOrderToDatabase:', error);
      setNotification({
        message: `An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error',
        visible: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    setFormData(initialFormState);
    setRetestAfterChecked(false);
    setNotification({
      message: 'Form cleared',
      type: 'success',
      visible: true
    });
  };

  const handleApplyDiscount = () => {
    const discountValue = parseFloat(formData.applyDiscount || '0');
    if (discountValue <= 0) {
      setNotification({
        message: 'Please enter a valid discount value (greater than 0)',
        type: 'error',
        visible: true
      });
      return;
    }
    
    // Calculate total base amount and tax amount
    let totalBaseAmount = 0;
    let totalTaxAmount = 0;
    
    formData.selectedItems.forEach(item => {
      const rate = parseFloat(item.rate?.toString() || '0');
      const qty = parseFloat(item.qty?.toString() || '1');
      const baseTotal = rate * qty;
      totalBaseAmount += baseTotal;
      
      const taxPercent = parseFloat(item.taxPercent?.toString() || '0');
      const taxAmount = (baseTotal * taxPercent) / 100;
      totalTaxAmount += taxAmount;
    });
    
    // Total including tax
    const totalWithTax = totalBaseAmount + totalTaxAmount;
    
    if (totalWithTax <= 0) {
      setNotification({
        message: 'No items to apply discount to',
        type: 'error',
        visible: true
      });
      return;
    }
    
    const discountType = formData.discountType || 'percentage';
    const discountAmount = discountType === 'percentage'
      ? (totalWithTax * discountValue) / 100
      : Math.min(discountValue, totalWithTax);
    
    logDebug('Discount calculation:', {
      totalBaseAmount,
      totalTaxAmount,
      totalWithTax,
      discountValue,
      discountType,
      discountAmount
    });
    
    // Apply discount proportionally to each item
    const updatedItems = formData.selectedItems.map(item => {
      const rate = parseFloat(item.rate?.toString() || '0');
      const qty = parseFloat(item.qty?.toString() || '1');
      const baseTotal = rate * qty;
      
      const taxPercent = parseFloat(item.taxPercent?.toString() || '0');
      const taxAmount = (baseTotal * taxPercent) / 100;
      
      const itemTotalWithTax = baseTotal + taxAmount;
      
      // Calculate this item's share of the total discount
      const ratio = itemTotalWithTax === 0 ? 0 : itemTotalWithTax / totalWithTax;
      const itemDiscount = discountAmount * ratio;
      
      // Apply the discount to the base amount (for display purposes only)
      const discountedBaseTotal = baseTotal - (itemDiscount * (baseTotal / itemTotalWithTax));
      
      return {
        ...item,
        amount: parseFloat(discountedBaseTotal.toFixed(2)),
        discountAmount: parseFloat(itemDiscount.toFixed(2)),
        discountPercent: itemTotalWithTax === 0 ? 0 : parseFloat(((itemDiscount / itemTotalWithTax) * 100).toFixed(2))
      };
    });
    
    setFormData(prev => ({
      ...prev,
      selectedItems: updatedItems,
      applyDiscount: '',
    }));
    
    setNotification({
      message: `Discount applied successfully!`,
      type: 'success',
      visible: true
    });
  };

  const handleItemDiscountChange = (index: number, type: 'percentage' | 'fixed', value: string) => {
    const numericValue = parseFloat(value) || 0;

    setFormData(prev => {
      const updatedItems = [...prev.selectedItems];
      const item = { ...updatedItems[index] };
      
      // Get base amount for the item
      const rate = parseFloat(item.rate?.toString() || '0');
      const qty = parseFloat(item.qty?.toString() || '1');
      const baseTotal = rate * qty;
      
      // Calculate tax for this item
      const taxPercent = parseFloat(item.taxPercent?.toString() || '0');
      const taxAmount = (baseTotal * taxPercent) / 100;
      
      // Total with tax
      const itemTotalWithTax = baseTotal + taxAmount;

      if (baseTotal === 0) return prev; // Prevent changes if item amount is 0
      
      logDebug('Item discount calculation:', {
        item, baseTotal, taxAmount, itemTotalWithTax, numericValue, type
      });

      if (type === 'percentage') {
        const percentage = Math.min(100, Math.max(0, numericValue));
        
        // Apply discount to the total with tax
        const discountAmount = (itemTotalWithTax * percentage) / 100;
        
        item.discountPercent = percentage;
        item.discountAmount = parseFloat(discountAmount.toFixed(2));
        
        // The amount shown is the base price after discount (for display only)
        const discountedBaseAmount = baseTotal - (discountAmount * (baseTotal / itemTotalWithTax));
        item.amount = parseFloat(discountedBaseAmount.toFixed(2));
      } else { // type === 'fixed'
        // Cap the fixed discount at the total amount with tax
        const discountAmount = Math.min(itemTotalWithTax, Math.max(0, numericValue));
        const discountPercentage = (discountAmount / itemTotalWithTax) * 100;
        
        item.discountAmount = parseFloat(discountAmount.toFixed(2));
        item.discountPercent = parseFloat(discountPercentage.toFixed(2));
        
        // The amount shown is the base price after discount (for display only)
        const discountedBaseAmount = baseTotal - (discountAmount * (baseTotal / itemTotalWithTax));
        item.amount = parseFloat(discountedBaseAmount.toFixed(2));
      }
      
      updatedItems[index] = item;

      // Calculate totals
      const baseAmount = updatedItems.reduce((sum, i) => {
        const itemRate = parseFloat(i.rate?.toString() || '0');
        const itemQty = parseFloat(i.qty?.toString() || '1');
        return sum + (itemRate * itemQty);
      }, 0);
      
      const taxTotal = updatedItems.reduce((sum, i) => {
        const itemRate = parseFloat(i.rate?.toString() || '0');
        const itemQty = parseFloat(i.qty?.toString() || '1');
        const itemBaseTotal = itemRate * itemQty;
        const itemTaxPercent = parseFloat(i.taxPercent?.toString() || '0');
        return sum + ((itemBaseTotal * itemTaxPercent) / 100);
      }, 0);
      
      const discountTotal = updatedItems.reduce((sum, i) => {
        return sum + (parseFloat(i.discountAmount?.toString() || '0'));
      }, 0);
      
      // Total = base + tax - discount
      const paymentEstimate = baseAmount + taxTotal;
      const finalAmount = paymentEstimate - discountTotal;
      
      // Calculate total advance
      const cashAdv1 = parseFloat(prev.cashAdv1?.toString() || '0') || 0;
      const ccUpiAdv = parseFloat(prev.ccUpiAdv?.toString() || '0') || 0;
      const advance = parseFloat(prev.advance?.toString() || '0') || 0;
      const totalAdvance = cashAdv1 + ccUpiAdv + advance;
      
      // Balance = finalAmount - totalAdvance
      const balance = Math.max(0, finalAmount - totalAdvance);
      
      logDebug('Updated payment calculation:', {
        baseAmount, taxTotal, discountTotal, paymentEstimate, finalAmount, totalAdvance, balance
      });

      return {
        ...prev,
        selectedItems: updatedItems,
        paymentEstimate: paymentEstimate.toFixed(2),
        chequeAdv: taxTotal.toFixed(2),
        schAmt: discountTotal.toFixed(2),
        balance: balance.toFixed(2)
      };
    });
  };

  // Function to generate item code
  function generateItemCode(type: string): string {
    // Generate item code based on type
    const prefix = type === 'Frames' ? 'FRM' : (type === 'Sun Glasses' ? 'SUN' : 'LEN');
    return `${prefix}${Date.now().toString().slice(-4)}`;
  }

  // Print handler for the Print Order Card button
  const handlePrintOrderCard = () => {
    // Prepare items for print (S.No., Item Name, Qty)
    const items = formData.selectedItems.map((item, idx) => ({
      description: item.itemName || item.itemCode || `Item ${idx + 1}`,
      qty: item.qty || 1,
      rate: item.rate || 0,
      amount: item.amount || 0
    }));
    printOrderCard({
      orderNumber: formData.referenceNo || formData.prescriptionNo || '',
      customerName: formData.name || '',
      bookingDate: formData.currentDateTime ? new Date(formData.currentDateTime) : new Date(),
      deliveryDate: formData.deliveryDateTime ? new Date(formData.deliveryDateTime) : new Date(),
      estimateAmount: parseFloat(formData.paymentEstimate || '0'),
      advanceAmount: parseFloat(formData.cashAdv1 || '0') + parseFloat(formData.ccUpiAdv || '0') + parseFloat(formData.advanceOther || '0'),
      balanceAmount: parseFloat(formData.balance || '0'),
      items,
      remarks: Object.entries(formData.remarks || {})
        .filter(([_, v]) => v)
        .map(([k]) => k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim())
        .join(', '),
      prescribedBy: formData.prescribedBy || '',
      bookedBy: formData.bookingBy || '',
      rpd: formData.rightEye?.dv?.rpd || '',
      lpd: formData.leftEye?.dv?.lpd || '',
      ipd: formData.ipd || '',
      rightDvSph: formData.rightEye?.dv?.sph || '',
      rightDvCyl: formData.rightEye?.dv?.cyl || '',
      rightDvAxis: formData.rightEye?.dv?.ax || '',
      rightDvAdd: formData.rightEye?.dv?.add || '',
      leftDvSph: formData.leftEye?.dv?.sph || '',
      leftDvCyl: formData.leftEye?.dv?.cyl || '',
      leftDvAxis: formData.leftEye?.dv?.ax || '',
      leftDvAdd: formData.leftEye?.dv?.add || '',
      rightNvSph: formData.rightEye?.nv?.sph || '',
      rightNvCyl: formData.rightEye?.nv?.cyl || '',
      rightNvAxis: formData.rightEye?.nv?.ax || '',
      rightNvAdd: formData.rightEye?.nv?.add || '',
      leftNvSph: formData.leftEye?.nv?.sph || '',
      leftNvCyl: formData.leftEye?.nv?.cyl || '',
      leftNvAxis: formData.leftEye?.nv?.ax || '',
      leftNvAdd: formData.leftEye?.nv?.add || '',
      schemeDiscount: formData.schAmt || '',
      rightDvVn: formData.rightEye?.dv?.vn || '',
      leftDvVn: formData.leftEye?.dv?.vn || '',
      rightNvVn: formData.rightEye?.nv?.vn || '',
      leftNvVn: formData.leftEye?.nv?.vn || '',
    });
  };

  return (
    <form onSubmit={handleOrderCardSubmit} className="w-full max-w-screen-xl mx-auto px-2 sm:px-3 md:px-4">
      <Card className="mb-4 p-4 shadow-lg rounded-md bg-white border border-gray-200">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 border-b pb-3 bg-blue-100 rounded-t-md px-4 py-2">
          <div className="flex space-x-1 mb-2 sm:mb-0">
            {/* Navigation Buttons - Keep these for now */} 
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={handleFirstOrder}>&#60;&#60; First</Button>
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={handlePrevOrder}>&#60; Prev</Button>
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={handleNextOrder}>Next &#62;</Button>
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={handleLastOrder}>Last &#62;&#62;</Button>
          </div>
          <Button type="button" variant="outline" size="sm" className="text-xs">&#60;&#60; Display Prescription History &#62;&#62;</Button>
        </div>

        {/* Order and Customer Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Order Info */}
          <div className="grid grid-cols-1 gap-3 text-gray-700 border p-4 rounded bg-blue-50 shadow-sm">
            {/* Prescription No. with Autocomplete */}
            <div className="relative">
              <Input
                label="Prescription No.:"
                name="prescriptionNo"
                value={formData.prescriptionNo}
                onChange={handleChange} // Use the main handleChange
                onFocus={() => setActiveField('prescriptionNo')}
                autoComplete="off" // Prevent browser autocomplete
              />
              {activeField === 'prescriptionNo' && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto"
                >
                  <ul className="divide-y divide-gray-200">
                    {suggestions.map((suggestion) => (
                      <li
                        key={suggestion.id} // Use unique ID from API
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                        {suggestion.prescriptionNo} - {suggestion.name} ({suggestion.mobileNo || suggestion.phoneLandline})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Reference No. with Autocomplete */}
            <div className="relative">
              <Input
                label="Reference No.:"
                name="referenceNo"
                value={formData.referenceNo}
                onChange={handleChange} // Use the main handleChange
                onFocus={() => setActiveField('referenceNo')}
                 autoComplete="off"
              />
               {activeField === 'referenceNo' && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto"
                >
                  <ul className="divide-y divide-gray-200">
                    {suggestions.map((suggestion) => (
                      <li
                        key={suggestion.id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                         {suggestion.referenceNo} - {suggestion.name} ({suggestion.mobileNo || suggestion.phoneLandline})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Input label="Current Date/Time:" value={formData.currentDateTime} name="currentDateTime" onChange={handleChange} type="datetime-local" readOnly />
            <Input label="Delivery Date/Time:" value={formData.deliveryDateTime} name="deliveryDateTime" onChange={handleChange} type="datetime-local"/>
            <Select label="Class:" options={classOptions} value={formData.class} name="class" onChange={handleChange} />
            <Input label="Booking By" value={formData.bookingBy} name="bookingBy" onChange={handleChange} />
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-1 gap-3 text-gray-700 border p-4 rounded bg-blue-50 shadow-sm">
            {/* Name with Autocomplete */}
            <div className="relative">
              <Input
                label="Name"
                value={formData.name}
                onChange={handleChange} // Use the main handleChange
                name="name"
                required
                onFocus={() => setActiveField('name')}
                 autoComplete="off"
              />
               {activeField === 'name' && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto"
                >
                  <ul className="divide-y divide-gray-200">
                    {suggestions.map((suggestion) => (
                      <li
                        key={suggestion.id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                         {suggestion.name} - {suggestion.mobileNo || suggestion.phoneLandline} ({suggestion.prescriptionNo || suggestion.referenceNo})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
             <Select
                label="Title"
                options={titleOptions}
                value={formData.title}
                onChange={handleChange}
                name="title"
                className="w-24"
                fullWidth={false}
              />
               {/* Reverted Gender to RadioGroup as per original code */} 
              <RadioGroup
                label="Gender"
                name="gender"
                options={[
                  { label: 'Male', value: 'Male' },
                  { label: 'Female', value: 'Female' }
                ]}
                value={formData.gender}
                onChange={handleChange}
              />
            <Input
              label="Age"
              type="number"
              value={formData.age}
              onChange={handleChange}
              name="age"
            />
             <Input
                label="Customer Code:"
                value={formData.customerCode}
                onChange={handleChange}
                name="customerCode"
              />
              <Input
                label="Birth Day:"
                type="date"
                value={formData.birthDay}
                onChange={handleChange}
                name="birthDay"
              />
              <Input
                label="Marr Anniv:"
                type="date"
                value={formData.marriageAnniversary}
                onChange={handleChange}
                name="marriageAnniversary"
              />
               <Input
                label="Address"
                value={formData.address}
                onChange={handleChange}
                name="address"
              />
              <Input
                label="City"
                value={formData.city}
                onChange={handleChange}
                name="city"
              />
              <Input
                label="State"
                value={formData.state}
                onChange={handleChange}
                name="state"
              />
              <Input
                label="Pin"
                value={formData.pinCode}
                onChange={handleChange}
                name="pinCode"
              />
            {/* Phone No. with Autocomplete */}
            <div className="relative">
              <Input
                label="Mobile No.:"
                value={formData.mobileNo}
                onChange={handleChange} // Use the main handleChange
                name="mobileNo"
                required
                onFocus={() => setActiveField('mobileNo')}
                 autoComplete="off"
              />
               {activeField === 'mobileNo' && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto"
                >
                  <ul className="divide-y divide-gray-200">
                    {suggestions.map((suggestion) => (
                      <li
                        key={suggestion.id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                         {suggestion.mobileNo || suggestion.phoneLandline} - {suggestion.name} ({suggestion.prescriptionNo || suggestion.referenceNo})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
             <Input
                label="Phone (L.L.)"
                value={formData.phoneLandline}
                onChange={handleChange}
                name="phoneLandline"
              />
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                name="email"
              />
            </div>
             <Input label="IPD:" value={formData.ipd} name="ipd" onChange={handleNumericInputChange} className="text-center" readOnly /> 
            <Input label="Prescribed By" value={formData.prescribedBy} name="prescribedBy" onChange={handleChange} />
            <Checkbox label="Billed" checked={formData.billed} onChange={handleCheckboxChange} name="billed" />
        </div>

        {/* Prescription Section */}
        {/* Re-using your existing PrescriptionSection component */} 
        <PrescriptionSection
          formData={{
            rightEye: formData.rightEye,
            leftEye: formData.leftEye,
            balanceLens: formData.balanceLens,
            age: formData.age, // Pass age as is (string | number)
            remarks: formData.remarks
          }}
          handleChange={handleChange}
          handleNumericInputChange={handleNumericInputChange}
          handleCheckboxChange={handleCheckboxChange}
        />

        {/* Spectacles Section */}
         {/* Re-integrating the Spectacles Section structure */} 
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="flex flex-col space-y-2">
                 <Button type="button" variant="action" className="text-xs">&#60;&#60; Add Spectacle &#62;&#62;</Button>
                 <Button 
                   type="button" 
                   variant="action" 
                   className="text-xs" 
                   onClick={() => handleAddManualEntry('Frames')}
                 >
                   &#60;&#60; Add Frame / Sun Glasses &#62;&#62;
                 </Button>
                 <Button type="button" variant="action" className="text-xs" onClick={() => setShowLensEntryPopup(true)}>&#60;&#60; Add Lenses &#62;&#62;</Button>
             </div>
             <div className="md:col-span-3 border p-4 rounded bg-white shadow-sm overflow-x-auto">
                <div className="min-w-[700px] md:min-w-[900px] lg:min-w-0">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1 text-blue-700">Selected Frames / Sun Glasses Details</h4>
                  {/* Add global style for number input arrows */}
                  <style dangerouslySetInnerHTML={{
                    __html: `
                      /* Hide arrows for number inputs */
                      input[type=number]::-webkit-inner-spin-button, 
                      input[type=number]::-webkit-outer-spin-button { 
                        -webkit-appearance: none; 
                        margin: 0; 
                      }
                      input[type=number] {
                        -moz-appearance: textfield;
                      }
                      
                      /* Ensure table cells show full content */
                      .full-content-cell input {
                        width: 100% !important;
                        min-width: 60px;
                        box-sizing: border-box;
                      }
                      
                      /* Ensure content is fully visible in cells */
                      .full-width-table td, .full-width-table th {
                        white-space: nowrap;
                        overflow: visible;
                      }
                    `
                  }} />
                  <table className="w-full border-collapse text-sm text-gray-700 full-width-table" style={{ tableLayout: 'fixed' }}>
                      <thead>
                          <tr className="bg-blue-50">
                              <th className="border border-gray-300 px-1 py-1 text-left text-xs" style={{ width: '40px' }}>S.I.</th>
                              <th className="border border-gray-300 px-1 py-1 text-left text-xs" style={{ width: '90px' }}>Item Code</th>
                              <th className="border border-gray-300 px-1 py-1 text-left text-xs" style={{ width: '150px' }}>Item Name</th>
                              <th className="border border-gray-300 px-1 py-1 text-right text-xs" style={{ width: '70px' }}>Tax (%)</th>
                              <th className="border border-gray-300 px-1 py-1 text-right text-xs" style={{ width: '80px' }}>Rate</th>
                              <th className="border border-gray-300 px-1 py-1 text-right text-xs" style={{ width: '90px' }}>Amount</th>
                              <th className="border border-gray-300 px-1 py-1 text-right text-xs" style={{ width: '60px' }}>Qty</th>
                              <th className="border border-gray-300 px-1 py-1 text-right text-xs" style={{ width: '90px' }}>Discount Amt</th>
                              <th className="border border-gray-300 px-1 py-1 text-right text-xs" style={{ width: '90px' }}>Discount %</th>
                              <th className="border border-gray-300 px-1 py-1 text-xs" style={{ width: '70px' }}>Action</th>
                          </tr>
                      </thead>
                      <tbody>
                          {formData.selectedItems.length === 0 ? (
                               <tr>
                                   <td colSpan={10} className="text-center border border-gray-300 py-4 text-gray-500">No items added yet.</td>
                               </tr>
                          ) : (
                              formData.selectedItems.map((item, index) => (
                                  <tr key={index}>
                                      <td className="border border-gray-300 px-1 py-1 text-xs text-left">{item.si}</td>
                                      <td className="border border-gray-300 px-1 py-1 text-xs text-left">{item.itemCode}</td>
                                      <td className="border border-gray-300 px-1 py-1 text-xs text-left">{item.itemName}</td>
                                      <td className="border border-gray-300 px-1 py-1 text-xs text-right">
                                        <Input
                                          value={item.taxPercent}
                                          name={`selectedItems.${index}.taxPercent`}
                                          onChange={e => {
                                            const value = parseFloat(e.target.value) || 0;
                                            setFormData(prev => {
                                              const updatedItems = [...prev.selectedItems];
                                              updatedItems[index].taxPercent = value;
                                              
                                              // Calculate base price (before tax)
                                              const baseRate = updatedItems[index].rate;
                                              const qty = updatedItems[index].qty;
                                              const baseTotal = baseRate * qty;
                                              
                                              // Calculate tax amount
                                              const taxAmount = (baseTotal * value) / 100;
                                              
                                              // Calculate total amount with tax
                                              const totalWithTax = baseTotal + taxAmount;
                                              
                                              // Apply any existing discount
                                              const discountAmount = updatedItems[index].discountAmount || 0;
                                              updatedItems[index].amount = parseFloat((totalWithTax - discountAmount).toFixed(2));
                                              
                                              // Update discount percentage if there's a discount
                                              if (discountAmount > 0) {
                                                updatedItems[index].discountPercent = totalWithTax === 0 ? 0 : 
                                                  parseFloat(((discountAmount / totalWithTax) * 100).toFixed(2));
                                              }
                                              
                                              return { ...prev, selectedItems: updatedItems };
                                            });
                                          }}
                                          type="number"
                                          step="0.01"
                                          className="w-12 text-right text-xs px-1 py-0.5"
                                          placeholder="0.00"
                                        />
                                      </td>
                                      <td className="border border-gray-300 px-1 py-1 text-xs text-right">
                                        <Input
                                          value={item.rate}
                                          name={`selectedItems.${index}.rate`}
                                          onChange={e => {
                                            const value = parseFloat(e.target.value) || 0;
                                            setFormData(prev => {
                                              const updatedItems = [...prev.selectedItems];
                                              updatedItems[index].rate = value;
                                              
                                              // Get quantity and tax percentage
                                              const qty = updatedItems[index].qty;
                                              const taxPercent = updatedItems[index].taxPercent || 0;
                                              
                                              // Calculate base total (without tax)
                                              const baseTotal = value * qty;
                                              
                                              // Calculate tax amount
                                              const taxAmount = (baseTotal * taxPercent) / 100;
                                              
                                              // Calculate total with tax
                                              const totalWithTax = baseTotal + taxAmount;
                                              
                                              // Apply any existing discount
                                              const discountAmount = updatedItems[index].discountAmount || 0;
                                              updatedItems[index].amount = parseFloat((totalWithTax - discountAmount).toFixed(2));
                                              
                                              // Recalculate discount % based on new rate and fixed discount amount
                                              updatedItems[index].discountPercent = totalWithTax === 0 ? 0 : 
                                                parseFloat(((discountAmount / totalWithTax) * 100).toFixed(2));

                                              return { ...prev, selectedItems: updatedItems };
                                            });
                                          }}
                                          type="number"
                                          step="0.01"
                                          className="w-14 text-right text-xs px-1 py-0.5"
                                          placeholder="0.00"
                                        />
                                      </td>
                                      <td className="border border-gray-300 px-1 py-1 text-xs text-right">
                                        {(() => {
                                          // Calculate base amount (rate * qty)
                                          const baseAmount = item.rate * item.qty;
                                          // Calculate tax amount if tax percent is set
                                          const taxAmount = item.taxPercent ? (baseAmount * item.taxPercent) / 100 : 0;
                                          // Calculate total with tax
                                          const totalWithTax = baseAmount + taxAmount;
                                          // Apply discount if any
                                          const finalAmount = totalWithTax - (item.discountAmount || 0);
                                          // Update the item's amount in state
                                          if (Math.abs(item.amount - finalAmount) > 0.01) { // Only update if there's a significant difference
                                            setTimeout(() => {
                                              setFormData(prev => {
                                                const updatedItems = [...prev.selectedItems];
                                                updatedItems[index].amount = parseFloat(finalAmount.toFixed(2));
                                                return { ...prev, selectedItems: updatedItems };
                                              });
                                            }, 0);
                                          }
                                          return finalAmount.toFixed(2);
                                        })()}
                                      </td>
                                      <td className="border border-gray-300 px-1 py-1 text-xs text-right">
                                        <Input
                                          value={item.qty}
                                          name={`selectedItems.${index}.qty`}
                                          onChange={e => {
                                            const value = parseInt(e.target.value) || 1;
                                            setFormData(prev => {
                                              const updatedItems = [...prev.selectedItems];
                                              updatedItems[index].qty = value;
                                              
                                              // Get rate and tax percentage
                                              const rate = updatedItems[index].rate;
                                              const taxPercent = updatedItems[index].taxPercent || 0;
                                              
                                              // Calculate base total (without tax)
                                              const baseTotal = rate * value;
                                              
                                              // Calculate tax amount
                                              const taxAmount = (baseTotal * taxPercent) / 100;
                                              
                                              // Calculate total with tax
                                              const totalWithTax = baseTotal + taxAmount;
                                              
                                              // Apply any existing discount
                                              const discountAmount = updatedItems[index].discountAmount || 0;
                                              updatedItems[index].amount = parseFloat((totalWithTax - discountAmount).toFixed(2));
                                              
                                              // Recalculate discount % based on new qty and fixed discount amount
                                              updatedItems[index].discountPercent = totalWithTax === 0 ? 0 : 
                                                parseFloat(((discountAmount / totalWithTax) * 100).toFixed(2));
                                              return { ...prev, selectedItems: updatedItems };
                                            });
                                          }}
                                          type="number"
                                          min="1"
                                          className="w-10 text-right text-xs px-1 py-0.5"
                                          placeholder="1"
                                        />
                                      </td>
                                      <td className="border border-gray-300 px-1 py-1 text-xs text-right">
                                        <Input
                                          value={item.discountAmount}
                                          name={`selectedItems.${index}.discountAmount`}
                                          onChange={e => handleItemDiscountChange(index, 'fixed', e.target.value)}
                                          type="number"
                                          step="0.01"
                                          className="w-14 text-right text-xs px-1 py-0.5"
                                          placeholder="0.00"
                                        />
                                      </td>
                                      <td className="border border-gray-300 px-1 py-1 text-xs text-right">
                                        <Input
                                          value={item.discountPercent}
                                          name={`selectedItems.${index}.discountPercent`}
                                          onChange={e => handleItemDiscountChange(index, 'percentage', e.target.value)}
                                          type="number"
                                          step="0.01"
                                          className="w-14 text-right text-xs px-1 py-0.5"
                                          placeholder="0.00"
                                        />
                                      </td>
                                      <td className="border border-gray-300 px-1 py-1 text-xs text-center">
                                          <Button variant="danger" size="sm" onClick={() => handleDeleteItem(index)}>Delete</Button>
                                      </td>
                                  </tr>
                              )))}
                      </tbody>
                  </table>
                  {/* Apply Discount Section */}
                  <div className="flex justify-between items-center mt-3 p-2 bg-gray-50 rounded border">
                    <div className="flex items-center space-x-4">
                      <span className="text-xs font-medium">Discount Type:</span>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="discountType"
                          value="percentage"
                          checked={formData.discountType === 'percentage'}
                              onChange={handleChange} // Use main handleChange
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-1 text-xs">%</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="discountType"
                          value="fixed"
                          checked={formData.discountType === 'fixed'}
                              onChange={handleChange} // Use main handleChange
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-1 text-xs">Fixed Amount</span>
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="text-xs font-medium">
                        {formData.discountType === 'percentage' ? 'Discount %:' : 'Discount Amount:'}
                      </label>
                      <Input
                        value={formData.applyDiscount}
                        name="applyDiscount"
                            onChange={handleChange} // Use main handleChange
                        className="w-16 text-right text-xs px-1 py-0.5"
                        placeholder={formData.discountType === 'percentage' ? '0.00%' : '0.00'}
                      />
                      <Button
                        type="button"
                        variant="action"
                        size="sm"
                        className="text-xs"
                        onClick={handleApplyDiscount}
                      >
                        Apply Disc
                      </Button>
                    </div>
                    </div>
                  </div>
             </div>
         </div>
        {/* Remarks and Payment Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Remarks and Status */}
            <RemarksAndStatusSection
                formData={formData}
                handleChange={handleChange}
            />
            {/* Payment Section */} 
            <PaymentSection
                formData={formData}
                handleNumericInputChange={handleNumericInputChange}
            />
        </div>

        {/* Bottom Buttons */}
        <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-4 mt-8">
          <Button type="submit" variant="action">&#60;&#60; Add Order Card &#62;&#62;</Button>
          {/* Removed Edit/Search Order Card Button */}
          <Button type="button" variant="action" onClick={handlePrintOrderCard}>&#60;&#60; Print Order Card &#62;&#62;</Button>
          <Button type="button" variant="action" onClick={handleClear}>&#60;&#60; Clear Order &#62;&#62;</Button>
          <Button type="button" variant="action" onClick={handleExit}>&#60;&#60; Exit &#62;&#62;</Button>
        </div>

      </Card>

      {/* Render the Toast Notification */}
      {(notification.visible || isSaving) && (
      <ToastNotification
        message={isSaving ? 'Saving...' : notification.message}
        type={isSaving ? 'success' : notification.type}
        onClose={() => setNotification({ ...notification, visible: false })}
      />
      )}

      {/* Item Selection Popup - NOW RESPONSIVE */}
      {showItemSelectionPopup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50 p-4">
          <div className="relative p-4 sm:p-6 border w-full max-w-md shadow-lg rounded-md bg-white">
            <h4 className="text-lg font-semibold mb-4 border-b pb-2 text-blue-700">Select Item Type</h4>
            <div className="space-y-4">
              <Button 
                type="button" 
                variant="action" 
                className="w-full text-left justify-start"
                onClick={() => handleAddItemClick('Frames')}
              >
                Add Frames
              </Button>
              <Button 
                type="button" 
                variant="action" 
                className="w-full text-left justify-start"
                onClick={() => handleAddItemClick('Sun Glasses')}
              >
                Add Sunglasses
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => setShowItemSelectionPopup(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Popup - NOW RESPONSIVE */}
      {showManualEntryPopup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50 p-4">
          <div className="relative p-4 sm:p-6 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <h4 className="text-lg font-semibold mb-4 border-b pb-2 text-blue-700">Manually Add {selectedItemType}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Item Name:"
                value={formData.manualEntryItemName}
                onChange={handleManualEntryChange}
                name="manualEntryItemName"
              />
              <Input
                label="Rate:"
                value={formData.manualEntryRate}
                onChange={handleManualEntryChange}
                name="manualEntryRate"
                type="number"
                step="0.01"
              />
              <Input
                label="Quantity:"
                value={formData.manualEntryQty}
                onChange={handleManualEntryChange}
                name="manualEntryQty"
                type="number"
                min="1"
              />
              <Input
                label="Item Amount:"
                value={formData.manualEntryItemAmount.toFixed(2)}
                name="manualEntryItemAmount"
                readOnly
              />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <Button type="button" variant="outline" onClick={() => setShowManualEntryPopup(false)}>Cancel</Button>
              <Button type="button" variant="action" onClick={() => {
                if (!formData.manualEntryItemName || !formData.manualEntryRate) {
                  setNotification({
                    message: 'Please enter both item name and rate',
                    type: 'error',
                    visible: true,
                  });
                  return;
                }
                const newItem: SelectedItem = {
                  si: formData.selectedItems.length + 1,
                  itemCode: generateItemCode(formData.manualEntryType), // Assuming generateItemCode exists
                  itemName: formData.manualEntryItemName,
                  unit: 'PCS',
                  taxPercent: 0,
                  rate: parseFloat(formData.manualEntryRate),
                  qty: formData.manualEntryQty || 1,
                  amount: parseFloat(formData.manualEntryRate) * (formData.manualEntryQty || 1),
                  discountAmount: 0,
                  discountPercent: 0
                };
                setFormData(prev => ({
                  ...prev,
                  selectedItems: [...prev.selectedItems, newItem],
                  manualEntryItemName: '',
                  manualEntryRate: '',
                  manualEntryQty: 1,
                  manualEntryItemAmount: 0
                }));
                setShowManualEntryPopup(false);
                 setNotification({
                   message: 'Manual item added',
                   type: 'success',
                   visible: true
                 });
              }}>Add</Button>
            </div>
          </div>
        </div>
      )}

      {/* Lens Entry Popup - NOW RESPONSIVE */}
      {showLensEntryPopup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50 p-4">
          <div className="relative p-4 sm:p-6 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <h4 className="text-lg font-semibold mb-4 border-b pb-2 text-blue-700">Add Lens Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Lens Entry Fields */}
              <Input label="Brand Name" value={lensEntry.brandName} onChange={e => setLensEntry({...lensEntry, brandName: e.target.value})} />
              <Input label="Item Name" value={lensEntry.itemName} onChange={e => setLensEntry({...lensEntry, itemName: e.target.value})} />
              <Input label="Index" value={lensEntry.index} onChange={e => setLensEntry({...lensEntry, index: e.target.value})} />
              <Input label="Coating" value={lensEntry.coating} onChange={e => setLensEntry({...lensEntry, coating: e.target.value})} />
              <Input label="Rate" value={lensEntry.rate} onChange={e => {
                const rate = e.target.value;
                const qty = lensEntry.qty === '' ? 1 : parseInt(lensEntry.qty);
                setLensEntry(le => ({ ...le, rate, itemAmount: rate && qty ? (parseFloat(rate) * qty).toString() : '' }));
              }} />
              <Input label="Qty" value={lensEntry.qty} onChange={e => {
                const qty = e.target.value;
                const rate = lensEntry.rate === '' ? 0 : parseFloat(lensEntry.rate);
                setLensEntry(le => ({ ...le, qty, itemAmount: qty && rate ? (rate * parseInt(qty)).toString() : '' }));
              }} />
              <Input label="Item Amount" value={lensEntry.itemAmount} name="itemAmount" readOnly />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <Button type="button" variant="outline" onClick={() => setShowLensEntryPopup(false)}>Cancel</Button>
              <Button type="button" variant="action" onClick={() => {
                if (!lensEntry.itemName || !lensEntry.rate) { setNotification({ message: 'Please enter item name and rate', type: 'error', visible: true }); return; }
                const newItem: SelectedItem = {
                  si: formData.selectedItems.length + 1,
                  itemCode: generateItemCode('Lens'), // Assuming generateItemCode exists
                  itemName: lensEntry.itemName,
                  unit: 'PCS',
                  taxPercent: 0,
                  rate: parseFloat(lensEntry.rate),
                  qty: lensEntry.qty ? parseInt(lensEntry.qty) : 1,
                  amount: lensEntry.itemAmount ? parseFloat(lensEntry.itemAmount) : 0,
                  discountAmount: 0,
                  discountPercent: 0,
                  brandName: lensEntry.brandName,
                  index: lensEntry.index,
                  coating: lensEntry.coating
                };
                setFormData(prev => ({ ...prev, selectedItems: [...prev.selectedItems, newItem] }));
                setLensEntry({ brandName: '', itemName: '', index: '', coating: '', rate: '', qty: '', itemAmount: '' });
                setShowLensEntryPopup(false);
                 setNotification({
                   message: 'Lens item added',
                   type: 'success',
                   visible: true
                 });
              }}>Add</Button>
            </div>
          </div>
        </div>
      )}
      {isNavigating && (
        <div className="fixed bottom-4 left-4 bg-gray-700 text-white px-4 py-2 rounded shadow">
          Loading order...
        </div>
      )}
    </form>
  );
};

export default OrderCardForm;