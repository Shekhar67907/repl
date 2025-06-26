import React, { useState, useEffect } from 'react';
import { contactLensService } from '../../Services/contactLensService';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { getTodayDate } from '../../utils/helpers';
import ContactLensPersonalInfo from './ContactLensPersonalInfo';
import ContactLensPrescriptionSection from './ContactLensPrescriptionSection';
import ContactLensManualForm from './ContactLensManualForm';
import ContactLensItemTable from './ContactLensItemTable';
import ContactLensOrderStatus from './ContactLensOrderStatus';
import ContactLensPayment from './ContactLensPayment';
import { ContactLensFormData, ContactLensItem } from './ContactLensTypes';
import ToastNotification from '../ui/ToastNotification';
import ContactLensSearch from './ContactLensSearch';
import { useNavigate } from 'react-router-dom';
import { logInfo, logError, logDebug, logDev, logWarn } from '../../utils/logger';
// No direct imports from src folder to avoid path issues


// Generate prescription number on component initialization to avoid regenerating it on rerenders
const generatedPrescriptionNo = contactLensService.generateContactLensPrescriptionNo();

const initialContactLensForm: ContactLensFormData = {
  prescriptionNo: generatedPrescriptionNo,
  reference_no: generatedPrescriptionNo, // Set reference number equal to prescription number by default
  date: toDateTimeLocalValue(getTodayDate()),
  time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  dvDate: toDateTimeLocalValue(getTodayDate()),
  dvTime: '18:30:00',
  class: '',
  bookingBy: '',
  title: 'Mr.',
  name: '',
  gender: 'Male',
  age: '',
  address: '',
  city: '',
  state: '',
  pin: '',
  phoneLandline: '',
  mobile: '',
  email: '',
  customerCode: '',
  birthDay: '',
  marriageAnniversary: '',
  prescBy: '',
  billed: false,
  billNumber: '',
  rightEye: {
    dv: {
      sph: '',
      cyl: '',
      ax: '',
      add: '',
      vn: '6/'
    },
    nv: {
      sph: '',
      cyl: '',
      ax: '',
      add: '',
      vn: '6/'
    }
  },
  leftEye: {
    dv: {
      sph: '',
      cyl: '',
      ax: '',
      add: '',
      vn: '6/'
    },
    nv: {
      sph: '',
      cyl: '',
      ax: '',
      add: '',
      vn: '6/'
    }
  },
  ipd: '',
  balanceLens: false,
  contactLensItems: [],
  remarks: '',
  orderStatus: 'Processing',
  orderStatusDate: getTodayDate(),
  retestAfter: getTodayDate(),
  expiryDate: getTodayDate(),
  payment: '0.00',
  estimate: '0.00',
  schAmt: '0.00',
  advance: '0.00',
  balance: '0.00',
  cashAdv: '0.00',
  ccUpiAdv: '0.00',
  chequeAdv: '0.00',
  cashAdv2: '0.00',
  advDate: getTodayDate(),
  paymentMethod: 'Cash',
  sourceType: 'INITIAL', // Default source type for empty forms
};

// Update the toDateInputValue function in ContactLensPage.tsx
function toDateInputValue(dateStr: string | null | undefined): string {
  logDebug('toDateInputValue called', { dateStr, type: typeof dateStr });
  
  if (!dateStr || dateStr === 'null' || dateStr === 'undefined' || dateStr === 'Invalid Date') return '';
  
  // If it's already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Try to parse the date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    logWarn('Invalid date string in toDateInputValue', { dateStr });
    return '';
  }
  
  // Format as YYYY-MM-DD (local time)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Utility to format date as yyyy-MM-ddTHH:mm for <input type='datetime-local' />
function toDateTimeLocalValue(dateStr: string): string {
  if (!dateStr) return '';
  
  logDebug('toDateTimeLocalValue called', { dateStr });
  
  // If it's already in the correct format, return as is
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateStr)) return dateStr.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr + 'T00:00';
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('-');
    return `${y}-${m}-${d}T00:00`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 16);
  }
  return '';
}

// Utility to convert yyyy-MM-dd to dd-MM-yyyy
function toDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  }
  if (dateStr.includes('T')) return toDDMMYYYY(dateStr.split('T')[0]);
  return dateStr;
}

// Utility to convert dd-MM-yyyy to yyyy-MM-dd
function toYYYYMMDD(dateStr: string): string {
  if (!dateStr) return '';
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('-');
    return `${y}-${m}-${d}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return dateStr;
}

const ContactLensPage: React.FC = () => {
  const [formData, setFormData] = useState<ContactLensFormData>(initialContactLensForm);
  const [showManualForm, setShowManualForm] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState<string>('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; visible: boolean }>({ message: '', type: 'success', visible: false });
  const [isSaving, setIsSaving] = useState(false);
  const [showSearchSection, setShowSearchSection] = useState<boolean>(true);
  
  // Add a flag to prevent calculations while loading from DB
  // This is critical to prevent unwanted recalculations
  const [isLoadingFromDB, setIsLoadingFromDB] = useState<boolean>(false);
  
  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState<string | null>(null);
  
  const navigate = useNavigate();
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    
    // Debug log for date fields
    if (name === 'birthDay' || name === 'marriageAnniversary') {
      logDebug('DATE CHANGE', { field: name, value, type });
    }
    
    // Early return if the target is undefined or the name is missing
    if (!e.target || !name) return;
    
    // Log issues but continue processing to avoid UI breaks
    if (!name) {
      logError('Event target name is undefined in handleChange', undefined, { event: e });
      return;
    }
    
    setFormData((prevState) => {
      // IMPORTANT: Mark as user input to allow recalculations
      // This will ensure any database-loaded values can now be recalculated
      const updatedState = { 
        ...prevState, 
        sourceType: 'USER_INPUT' as 'USER_INPUT' // Use correct type literal
      };
      
      // Handle nested properties using dot notation (e.g., "rightEye.dv.sph")
      if (name.includes('.')) {
        try {
          const keys = name.split('.');
          const obj = { ...updatedState };
          
          let current: any = obj;
          for (let i = 0; i < keys.length - 1; i++) {
            if (current[keys[i]] === undefined) {
              // Initialize missing objects in the path
              current[keys[i]] = {};
            }
            current = current[keys[i]];
          }
          
          current[keys[keys.length - 1]] = value;
          return obj;
        } catch (error: any) {
          logError('Error updating nested state in handleChange', error);
          return updatedState; // Return state with sourceType on error
        }
      }
      
      // Handle simple properties
      return { ...updatedState, [name]: value };
    });
    
    // Handle date inputs specially to ensure proper formatting
    if (type === 'date') {
      setFormData(prev => ({
        ...prev,
        [name]: value || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    // Mark as user input to allow recalculations
    setFormData({ 
      ...formData, 
      sourceType: 'USER_INPUT' as 'USER_INPUT',
      [name]: checked 
    });
  };

  const handleNumericInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Skip processing if name is undefined (though it should be present here)
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
         } else if (numValue < 0) { // Ensure non-negative, though regex handles non-digits
            processedValue = '0';
         }
      } else {
        processedValue = ''; // Clear if not a valid number after cleaning
      }
    } else { // Existing logic for other numeric fields
      // Allow only numbers, decimal point, and negative sign
      processedValue = value.replace(/[^0-9.-]/g, '');
    }
    
    // Create a properly structured synthetic event with explicitly set name and formatted value
    const syntheticEvent = {
      ...e,
      target: {
        // Copy necessary properties from original target
        ...e.target,
        name: name,  // Explicitly set the original name
        value: processedValue, // Use the processed value
      }
    } as React.ChangeEvent<HTMLInputElement>;
    
    // Call the main handleChange with the properly structured synthetic event
    handleChange(syntheticEvent);
  };

  // We already have the isLoadingFromDB state declared above

  // Consolidated function to calculate and update payment totals
  const calculateTotal = (items: ContactLensItem[], isManualCalculation: boolean = true) => {
    // IMPORTANT DEBUG - Log current state to diagnose issues
    logDebug('calculateTotal called', {
      isManualCalculation,
      currentPaymentValue: formData.payment,
      currentAdvanceValue: formData.advance,
      currentBalanceValue: formData.balance,
      itemCount: items?.length || 0,
      sourceType: formData.sourceType || 'UNKNOWN'
    });
    
    // IMPORTANT: We need special handling for newly added items
    const hasNewItems = items.length > 0;

    // Always calculate new totals when manually adding items or when explicitly forced
    const forceRecalculation = isManualCalculation || hasNewItems;
    
    // Only block recalculation if we're loading from DB AND not forcing recalculation
    if (formData.sourceType === 'DATABASE_VALUES' && !forceRecalculation) {
      logDebug('Blocked automatic recalculation: Payment data came from DATABASE_VALUES', {
        payment: formData.payment,
        advance: formData.advance,
        balance: formData.balance
      });
      return; // Exit immediately - do not recalculate or update state
    }
    
    // If we have new items or manual calculation, we need to update payment
    if (forceRecalculation) {
      logDebug('Allowing recalculation: Manual update or new items added');
      // When adding new items with database values loaded, we switch to user input mode
      if (formData.sourceType === 'DATABASE_VALUES') {
        setFormData(prev => ({
          ...prev,
          sourceType: 'USER_INPUT' as 'USER_INPUT'
        }));
      }
    }
    
    // If we're loading from DB, NEVER calculate regardless of other conditions
    if (isLoadingFromDB) {
      logDebug('Blocked: Currently loading from DB - all calculations blocked');
      return; // Block ALL calculations during DB load
    }
    
    // Skip calculations entirely if they are not manual and we already have data
    // IMPORTANT: This is the main guard that prevents recalculation on data load
    if (!isManualCalculation && formData.payment && parseFloat(formData.payment) > 0) {
      logDebug('Skipping calculation completely - using existing DB values', {
        payment: formData.payment,
        advance: formData.advance,
        balance: formData.balance
      });
      return; // Exit early - do not calculate or update state
    }
    
    logDebug('Calculating totals', { isManualCalculation });
    
    // Calculate base total (before discount)
    const baseTotal = items.reduce((sum, item) => {
      const qty = parseFloat(item.qty?.toString() || '1');
      const rate = parseFloat(item.rate?.toString() || '0');
      return sum + (qty * rate);
    }, 0);
    
    // Calculate total after discounts (final amount)
    const finalTotal = items.reduce((sum, item) => {
      // Make sure we're using the amount field which is the final amount after discount
      const itemAmount = parseFloat(item.amount?.toString() || '0');
      return sum + itemAmount;
    }, 0);
    
    // Calculate total discount amount
    const totalDiscount = items.reduce((sum, item) => {
      const discountAmount = parseFloat(item.discountAmount?.toString() || '0');
      return sum + discountAmount;
    }, 0);
    
    // Calculate advance amount
    const cashAdv = parseFloat(formData.cashAdv || '0');
    const ccUpiAdv = parseFloat(formData.ccUpiAdv || '0');
    const chequeAdv = parseFloat(formData.chequeAdv || '0');
    const totalAdvance = cashAdv + ccUpiAdv + chequeAdv;
    
    // Format values with 2 decimal places
    const formattedBaseTotal = baseTotal.toFixed(2);
    const formattedFinalTotal = finalTotal.toFixed(2);
    const formattedDiscount = totalDiscount.toFixed(2);
    const formattedAdvance = totalAdvance.toFixed(2);
    
    // Calculate balance (final amount - advances) 
    const balance = Math.max(0, finalTotal - totalAdvance);
    const formattedBalance = balance.toFixed(2);
    
    logDebug('Payment calculation results', {
      baseTotal,
      finalTotal,
      totalDiscount,
      totalAdvance,
      balance,
      isManualCalculation
    });

    // Update form state with calculated values
    setFormData(prev => {
      // If this is not a manual calculation (e.g., loading from DB)
      // and we already have values, don't override them
      if (!isManualCalculation) {
        const hasExistingValues = prev.payment && parseFloat(prev.payment) > 0;
        if (hasExistingValues) {
          logDebug('Preserving existing payment fields from database', {
            payment: prev.payment,
            schAmt: prev.schAmt,
            estimate: prev.estimate,
            advance: prev.advance,
            balance: prev.balance
          });
          return prev; // Keep existing values
        }
      }
      
      logDebug('Setting payment fields', {
        payment: formattedFinalTotal,     // This is after discount (e.g. 900)
        schAmt: formattedDiscount,        // Total discount amount (e.g. 100)
        estimate: formattedBaseTotal,     // Original total before discount (e.g. 1000)
        advance: formattedAdvance,        // Total advance payments
        balance: formattedBalance         // Payment total minus advances (e.g. 900)
      });
      
      return {
        ...prev,
        payment: formattedFinalTotal,     // Total after discounts
        schAmt: formattedDiscount,        // Total discount amount
        estimate: formattedBaseTotal,     // Total before discounts (ORIGINAL amount)
        advance: formattedAdvance,        // Total advance
        balance: formattedBalance         // Balance after discounts and advance
      };
    });
  };

  const handleApplyDiscount = () => {
    logInfo('Manual discount requested - user clicked Apply Discount button');
    logDebug('Applying discount', { discountPercentage, sourceType: formData.sourceType });
    
    // Validate the discount percentage first
    const discount = parseFloat(discountPercentage);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      // Show error notification for invalid input
      setNotification({ 
        message: 'Please enter a valid discount percentage between 0 and 100.', 
        type: 'error', 
        visible: true 
      });
      return;
    }
    
    // CRITICAL PROTECTION: If data was loaded from database, confirm with user before modifying
    if (formData.sourceType === 'DATABASE_VALUES') {
      const proceed = window.confirm(
        'You are about to modify payment values that were loaded from the database. ' +
        'This will recalculate all payment fields. Are you sure you want to proceed?'
      );
      
      if (!proceed) {
        logInfo('User canceled discount application to preserve DB values');
        return;
      }
    }
    
    // Get current total amount
    const total = parseFloat(formData.payment) || 0;
    
    // Calculate discount amount
    const discountAmount = (total * discount) / 100;
    
    // Update the form with the discount and mark as user input
    setFormData(prevState => ({
      ...prevState,
      sourceType: 'USER_INPUT' as 'USER_INPUT', // Mark as user modified
      schAmt: discountAmount.toFixed(2)
    }));
    
    // Recalculate totals with the new discount
    if (formData.contactLensItems.length > 0) {
      // This is an explicit user action, so it's safe to recalculate
      calculateTotal(formData.contactLensItems);
    }

    logDebug('Applying discount of', discount);
  
    const updatedItems = formData.contactLensItems.map(item => {
      // Calculate base amount without discount
      const baseAmount = item.qty * item.rate;
      // Calculate discount amount (using the same formula as OrderCard system)
      const discountAmt = baseAmount * (discount / 100);
      // Calculate final amount after discount
      const finalAmount = baseAmount - discountAmt;
      
      logDebug('Item discount calculation', {
        baseAmount,
        discount, 
        discountAmt,
        finalAmount
      });
      
      return {
        ...item,
        discountPercent: discount,
        discountAmount: parseFloat(discountAmt.toFixed(2)), // Format to 2 decimal places for consistency
        amount: parseFloat(finalAmount.toFixed(2)) // Format to 2 decimal places for consistency
      };
    });

    setFormData(prev => ({
      ...prev,
      contactLensItems: updatedItems
    }));
  
    // Explicitly mark that this is a manual calculation, not from loading
    logDebug('Manual discount - recalculating totals after user applied discount');
    calculateTotal(updatedItems, true); // true = manual calculation

    // Add success notification
    setNotification({ message: 'Discount applied successfully!', type: 'success', visible: true });
  };

  // Update totals when any relevant payment fields change - BUT CAREFULLY
  useEffect(() => {
    // CRITICAL: Check if we have database values that need to be preserved
    if (formData.sourceType === 'DATABASE_VALUES') {
      // If DB value is missing or 0, recalculate from items
      if (!formData.payment || parseFloat(formData.payment) === 0) {
        logDebug('DB value is 0 or missing, recalculating from items');
        calculateTotal(formData.contactLensItems, true);
      } else {
        logDebug('Preserving database values - skipping auto recalculation', {
          payment: formData.payment,
          advance: formData.advance,
          balance: formData.balance
        });
      }
      return; // Exit early to protect DB values (unless recalculated above)
    }
    // Only for user input or new items, recalculate
    if (formData.sourceType === 'USER_INPUT' || formData.contactLensItems.length > 0) {
      logDebug('Auto-recalculating due to payment field or item changes');
      calculateTotal(formData.contactLensItems, true); // Force as manual calculation
    }
  }, [
    formData.contactLensItems, 
    formData.cashAdv, 
    formData.ccUpiAdv, 
    formData.chequeAdv, 
    formData.schAmt,
    formData.sourceType // Add sourceType to dependencies to react to changes
  ]);

  // Effect to calculate IPD from RPD and LPD
  useEffect(() => {
    const rpd = formData.rightEye.dv.rpd;
    const lpd = formData.leftEye.dv.lpd;
    
    if (rpd && lpd) {
      const rpdValue = parseFloat(rpd);
      const lpdValue = parseFloat(lpd);
      
      if (!isNaN(rpdValue) && !isNaN(lpdValue)) {
        const calculatedIPD = (rpdValue + lpdValue).toFixed(1);
        setFormData(prev => ({
          ...prev,
          ipd: calculatedIPD
        }));
      }
    } else if (!rpd && !lpd) {
         setFormData(prev => ({
          ...prev,
          ipd: '' // Clear IPD if both RPD and LPD are empty
        }));
    }
  }, [formData.rightEye.dv.rpd, formData.leftEye.dv.lpd, setFormData]);

  // Helper function to convert database eye side values (lowercase) to UI values (titlecase)
  const convertEyeSideToUIFormat = (eyeSide: string): 'Right' | 'Left' | 'Both' => {
    // Log the raw input for debugging
    logDebug('convertEyeSideToUIFormat - raw input', { eyeSide });
    
    if (!eyeSide) {
      logDebug('No eye side provided, defaulting to Both');
      return 'Both';
    }
    
    // Trim whitespace and convert to lowercase for comparison
    const normalized = eyeSide.toString().trim().toLowerCase();
    
    // Log the normalized value for debugging
    logDebug('Normalized eye side', { normalized });
    
    // Check for variations of 'right'
    if (['right', 'r', 're', 'od'].includes(normalized)) {
      return 'Right';
    }
    
    // Check for variations of 'left'
    if (['left', 'l', 'le', 'os'].includes(normalized)) {
      return 'Left';
    }
    
    // Default to 'Both' for any other case
    logDebug('No matching eye side found, defaulting to Both');
    return 'Both';
  };

  const handleAddContactLens = (item: ContactLensItem) => {
    logInfo('Adding new contact lens item', { item });
    
    // Check if we need to apply global discount to this item
    const globalDiscount = parseFloat(discountPercentage) || 0;
    let processedItem = { ...item };
    
    // Make sure the item has an amount field
    if (!processedItem.amount) {
      processedItem.amount = processedItem.qty * processedItem.rate;
    }
    
    // Calculate and apply discount to the item if global discount exists
    if (globalDiscount > 0) {
      // Calculate base amount (qty * rate)
      const baseAmount = processedItem.qty * processedItem.rate;
      
      // Calculate discount amount based on global discount percentage
      const discountAmount = baseAmount * (globalDiscount / 100);
      
      // Calculate final amount after discount
      const finalAmount = baseAmount - discountAmount;
      
      // Update the item with discount values
      processedItem = {
        ...processedItem,
        discountPercent: globalDiscount,
        discountAmount: parseFloat(discountAmount.toFixed(2)),
        amount: parseFloat(finalAmount.toFixed(2))
      };
      
      logDebug('Applied global discount to new item', {
        item: processedItem.side || 'Both',
        baseAmount,
        globalDiscount,
        discountAmount: processedItem.discountAmount,
        finalAmount: processedItem.amount
      });
    } else {
      // If no global discount, ensure the amount is calculated correctly
      processedItem.amount = processedItem.qty * processedItem.rate;
      processedItem.discountPercent = 0;
      processedItem.discountAmount = 0;
    }
    
    // Force recalculation regardless of source type when adding new items
    const updatedItems = [...formData.contactLensItems, processedItem];
    
    // Calculate new payment total from all items
    const totalPayment = updatedItems.reduce((sum, item) => {
      return sum + (parseFloat(item.amount?.toString()) || 0);
    }, 0);
    
    // Calculate new estimate total from all items
    const totalEstimate = updatedItems.reduce((sum, item) => {
      const qty = parseFloat(item.qty?.toString() || '1');
      const rate = parseFloat(item.rate?.toString() || '0');
      return sum + (qty * rate);
    }, 0);
    
    // Calculate total discount
    const totalDiscount = updatedItems.reduce((sum, item) => {
      return sum + (parseFloat(item.discountAmount?.toString()) || 0);
    }, 0);
    
    // Force directly updating payment fields
    setFormData(prevState => {
      // When adding new items, we should always switch to user input mode
      return {
        ...prevState,
        sourceType: 'USER_INPUT' as 'USER_INPUT',
        contactLensItems: updatedItems,
        payment: totalPayment.toFixed(2),
        estimate: totalEstimate.toFixed(2),
        schAmt: totalDiscount.toFixed(2),
        // Recalculate balance based on new payment total
        balance: (totalPayment - parseFloat(prevState.advance)).toFixed(2)
      };
    });
    
    // Close the manual form
    setShowManualForm(false);
  };

// Function to handle patient selection from search results
const handlePatientSelect = (patientData: any) => {
  try {
    setIsLoadingFromDB(true);
    logInfo('DB load started - all calculations blocked until data load completes');

    // Copy merged fields from top-level to prescription if present
    if (patientData.birth_day) {
      patientData.prescription.birth_day = patientData.birth_day;
    }
    if (patientData.marriage_anniversary) {
      patientData.prescription.marriage_anniversary = patientData.marriage_anniversary;
    }

    // Log values from database to help debugging
    logDebug('Database values', {
      prescribed_by: patientData.prescription.prescribed_by,
      class: patientData.prescription.class,
      date: patientData.prescription.date,
      delivery_date: patientData.prescription.delivery_date
    });
    
    // Show a notification that data is being loaded
    setNotification({
      message: 'Loading patient data...',
      type: 'success',
      visible: true
    });
        
    // In handlePatientSelect, before constructing newFormData, add detailed debug logs
    // Add detailed debug logging for date fields
    logDebug('DATE DEBUG - Raw patient data', {
      birth_day: patientData.prescription.birth_day,
      marriage_anniversary: patientData.prescription.marriage_anniversary,
      delivery_date: patientData.prescription.delivery_date,
      retest_date: patientData.prescription.retest_date,
      expiry_date: patientData.prescription.expiry_date
    });
    
    const rawBirthDay = patientData.prescription.birth_day;
    const convertedBirthDay = toDateInputValue(rawBirthDay);
    logDebug('BIRTHDAY DEBUG', { rawBirthDay, convertedBirthDay });
    
    const rawMarriageAnniv = patientData.prescription.marriage_anniversary;
    const convertedMarriageAnniv = toDateInputValue(rawMarriageAnniv);
    logDebug('MARRIAGE ANNIV DEBUG', { rawMarriageAnniv, convertedMarriageAnniv });

    // Log before setting form data
    logDebug('Setting form data with', {
      birthDay: patientData.prescription?.birth_day,
      marriageAnniversary: patientData.prescription?.marriage_anniversary,
      birthDayConverted: toDateInputValue(patientData.prescription?.birth_day),
      marriageAnniversaryConverted: toDateInputValue(patientData.prescription?.marriage_anniversary)
    });

    // Create a new form data object based on the patient data
    const newFormData: ContactLensFormData = {
      ...initialContactLensForm,
      contactLensId: patientData.prescription.id, // Store the contact_lens_prescriptions.id for update
          
      // Set the prescription fields
      prescriptionNo: patientData.prescription.prescription_no || '',
      reference_no: patientData.prescription.reference_no || patientData.prescription.ref_no || '',
      name: patientData.prescription.name || '',
      gender: patientData.prescription.gender || 'Male',
          
      // Fix for Age field
      age: patientData.prescription.age || '',
          
      address: patientData.prescription.address || '',
      city: patientData.prescription.city || '',
      state: patientData.prescription.state || '',
          
      // Fix for PIN field
      pin: patientData.prescription.pin || '',
          
      // Fix for Phone Landline field
      phoneLandline: patientData.prescription.phone_landline || '',
          
      mobile: patientData.prescription.mobile_no || patientData.prescription.mobile || '',
      email: patientData.prescription.email || '',
      remarks: patientData.prescription.remarks || '',
          
      // Fix for Birth Day field
      birthDay: convertedBirthDay,
          
      // Fix for Marriage Anniversary field
      marriageAnniversary: convertedMarriageAnniv,
          
      // Fix for Customer Code field
      customerCode: patientData.prescription.customer_code || '',
          
      // Fix for Prescribed By field - ensure correct mapping from database to form field
      prescBy: patientData.prescription.prescribed_by || '',
          
      // Fix for Class field - ensure correct mapping from database to form field
      class: patientData.prescription.class || '',
             
      // Add debug logging outside the form data object
      /* Debug logging */
      // Console log right before this to track values in debug console
      // console.log('Debug - Class:', patientData.prescription.class, 'Prescribed By:', patientData.prescription.prescribed_by);
      
      // Keep existing Booking By functionality
      bookingBy: patientData.contactLensData?.booked_by || 
                patientData.prescription.booked_by || 
                '',
      
      // Keep existing Order Status functionality
      orderStatus: (patientData.prescription?.status || patientData.contactLensData?.status || 'Processing'),
      
      // Fix for Date field (datetime-local)
      date: toDateTimeLocalValue(patientData.prescription.date),
      
      // Fix for Delivery Date field (datetime-local)
      dvDate: toDateTimeLocalValue(patientData.prescription.delivery_date),
      // Fix for Order Status Date (date)
      orderStatusDate: toDateInputValue(patientData.prescription.order_status_date),
      // Fix for Retest After (date)
      retestAfter: toDateInputValue(patientData.prescription.retest_date),
      // Fix for Expiry Date (date)
      expiryDate: toDateInputValue(patientData.prescription.expiry_date),
      // Fix for Advance Date (date)
      advDate: toDateInputValue(patientData.payment?.payment_date || patientData.prescription.adv_date),
      };
          
      // If we have eye data, map it to the form structure
      if (patientData.eyes && patientData.eyes.length > 0) {
        // Robustly map DV and NV for each eye
        const rightDv = patientData.eyes.find((eye: any) => eye.eye_side === 'Right' && (eye.vision_type === 'dv' || eye.vision_type === 'DV'));
        const rightNv = patientData.eyes.find((eye: any) => eye.eye_side === 'Right' && (eye.vision_type === 'nv' || eye.vision_type === 'NV'));
        const leftDv  = patientData.eyes.find((eye: any) => eye.eye_side === 'Left'  && (eye.vision_type === 'dv' || eye.vision_type === 'DV'));
        const leftNv  = patientData.eyes.find((eye: any) => eye.eye_side === 'Left'  && (eye.vision_type === 'nv' || eye.vision_type === 'NV'));

        newFormData.rightEye = {
          dv: {
            sph: rightDv?.sph || '',
            cyl: rightDv?.cyl || '',
            ax: rightDv?.axis || '',
            add: rightDv?.add_power || '',
            vn: rightDv?.vn || '6/',
            rpd: rightDv?.rpd || ''
          },
          nv: {
            sph: rightNv?.sph || '',
            cyl: rightNv?.cyl || '',
            ax: rightNv?.axis || '',
            add: rightNv?.add_power || '',
            vn: rightNv?.vn || 'N',
            rpd: rightNv?.rpd || ''
          }
        };
        newFormData.leftEye = {
          dv: {
            sph: leftDv?.sph || '',
            cyl: leftDv?.cyl || '',
            ax: leftDv?.axis || '',
            add: leftDv?.add_power || '',
            vn: leftDv?.vn || '6/',
            lpd: leftDv?.lpd || ''
          },
          nv: {
            sph: leftNv?.sph || '',
            cyl: leftNv?.cyl || '',
            ax: leftNv?.axis || '',
            add: leftNv?.add_power || '',
            vn: leftNv?.vn || 'N',
            lpd: leftNv?.lpd || ''
          }
        };
        // Set IPD by combining RPD and LPD if available
        if (rightDv?.rpd && leftDv?.lpd) {
          try {
            const rpd = parseFloat(rightDv.rpd) || 0;
            const lpd = parseFloat(leftDv.lpd) || 0;
            if (rpd > 0 && lpd > 0) {
              const ipd = (rpd + lpd).toFixed(1);
              newFormData.ipd = ipd;
            }
          } catch (e) {
            logError('Error calculating IPD in handlePatientSelect', e);
          }
        }
      }
      
      // If we have contact lens items, add them to the form
      if (patientData.items && patientData.items.length > 0) {
        logDebug('Loading items from database', { items: patientData.items });
        const mappedItems = patientData.items.map((item: any, index: number) => {
          // Parse quantity and rate ensuring they are numbers
          const qty = parseFloat(item.quantity ?? item.qty ?? '1') || 1; // Try all possible keys
          const rate = parseFloat(item.rate ?? '0') || 0;
          const baseAmount = qty * rate;

          // Defensive fallback for discount percent/amount
          const getNumberValue = (obj: any, ...possibleKeys: string[]) => {
            for (const key of possibleKeys) {
              if (obj[key] !== undefined && obj[key] !== null) {
                const value = parseFloat(obj[key].toString());
                if (!isNaN(value)) return value;
              }
            }
            return 0;
          };

          let discountPercent = getNumberValue(item, 'discount_percent', 'discount_percentage', 'discountPercent', 'disc_percent', 'discPercent');
          let discountAmount = getNumberValue(item, 'discount_amount', 'discountAmount', 'disc_amount', 'discAmount');

          // Defensive fallback for axis, base curve, lens code
          const ax = item.ax ?? item.axis ?? '';
          const bc = item.bc ?? item.base_curve ?? '';
          const lensCode = item.lensCode ?? item.lens_code ?? '';

          // Defensive logging for missing fields
          if (!ax) logWarn(`Item ${index + 1} missing axis (ax/axis) field`, item);
          if (!bc) logWarn(`Item ${index + 1} missing base curve (bc/base_curve) field`, item);
          if (!lensCode) logWarn(`Item ${index + 1} missing lens code (lensCode/lens_code) field`, item);

          // Defensive recalculation for amount
          let finalAmount = 0;
          if (item.amount !== undefined && item.amount !== null && !isNaN(parseFloat(item.amount))) {
            finalAmount = parseFloat(item.amount);
          } else if (item.final_amount !== undefined && item.final_amount !== null && !isNaN(parseFloat(item.final_amount))) {
            finalAmount = parseFloat(item.final_amount);
          } else if (baseAmount > 0) {
            if (discountPercent > 0) {
              finalAmount = parseFloat((baseAmount * (1 - discountPercent / 100)).toFixed(2));
              discountAmount = parseFloat((baseAmount * discountPercent / 100).toFixed(2));
            } else if (discountAmount > 0) {
              finalAmount = parseFloat((baseAmount - discountAmount).toFixed(2));
            } else {
              finalAmount = baseAmount;
            }
          }

          // Defensive: If still 0, log a warning
          if (!finalAmount && baseAmount > 0) {
            logWarn(`Item ${index + 1} amount could not be determined, defaulting to baseAmount`, item);
            finalAmount = baseAmount;
          }

          const mappedItem = {
            id: item.id,
            si: index + 1,
            side: convertEyeSideToUIFormat(item.side || item.eye_side || 'both'),
            raw_side_fields: {
              side_field: item.side,
              eye_side_field: item.eye_side
            },
            bc,
            power: item.power || '',
            material: item.material || '',
            dispose: item.dispose || '',
            brand: item.brand || '',
            diameter: item.diameter || '',
            qty,
            rate,
            discountPercent,
            discountAmount,
            discount_percent: discountPercent,
            discount_amount: discountAmount,
            disc_percent: discountPercent,
            disc_amount: discountAmount,
            amount: finalAmount,
            sph: item.sph || '',
            cyl: item.cyl || '',
            ax,
            lensCode
          };

          // Log the final mapped item for verification
          logDebug(`Final mapped item ${index + 1} COMPLETE`, mappedItem);
          return mappedItem;
        });
        newFormData.contactLensItems = mappedItems;
      }
      
      // We're in DB load mode - values should be preserved
      // isLoadingFromDB flag is already set at the start of handlePatientSelect
      
      // If we have payment data, map it to the form
      if (patientData.payment) {
        // CRITICAL: Set sourceType to DATABASE_VALUES to prevent recalculation
        // This will ensure payment values from DB are preserved exactly as loaded
        newFormData.sourceType = 'DATABASE_VALUES' as 'DATABASE_VALUES';
        
        // Initialize payment fields directly from database without any calculations
        if (patientData.payment) {
          logDebug('Using payment data directly from database', { payment: patientData.payment });
          
          // CRITICAL: Ensure we're using the exact values from the database
          // Convert all values to strings to match the form data type
          newFormData.payment = patientData.payment.payment_total?.toString() || '0';
          newFormData.estimate = patientData.payment.estimate_amount?.toString() || '0';
          newFormData.schAmt = patientData.payment.discount_amount?.toString() || '0';
          newFormData.advance = patientData.payment.advance?.toString() || '0';
          newFormData.balance = patientData.payment.balance?.toString() || '0';
          
          // Also set the individual advance fields if they exist
          if (patientData.payment.cash_advance) {
            newFormData.cashAdv = patientData.payment.cash_advance.toString();
          }
          if (patientData.payment.card_upi_advance) {
            newFormData.ccUpiAdv = patientData.payment.card_upi_advance.toString();
          }
          if (patientData.payment.cheque_advance) {
            newFormData.chequeAdv = patientData.payment.cheque_advance.toString();
          }
          
          logDebug('PAYMENT VALUES SET DIRECTLY FROM DATABASE (NO CALCULATIONS)', {
            payment: newFormData.payment,
            estimate: newFormData.estimate,
            schAmt: newFormData.schAmt,
            advance: newFormData.advance,
            balance: newFormData.balance
          });
          
          logDebug('PAYMENT VALUES FROM DATABASE (NO RECALCULATIONS)', {
            payment: newFormData.payment,
            advance: newFormData.advance,
            balance: newFormData.balance
          });
        }
        
        // Map payment fields from database to UI
        logDebug('DETAILED DEBUG - Payment data from database', {
          database_values: {
            payment_total: patientData.payment.payment_total,
            estimate: patientData.payment.estimate,
            discount_amount: patientData.payment.discount_amount,
            discount_percent: patientData.payment.discount_percent,
            advance: patientData.payment.advance,
            balance: patientData.payment.balance,
            cash_advance: patientData.payment.cash_advance,
            card_upi_advance: patientData.payment.card_upi_advance,
            cheque_advance: patientData.payment.cheque_advance
          },
          sourceType: 'DATABASE_VALUES'
        });
        
        // CRITICAL: Make sure we're using proper string conversion for numeric fields
        // NEVER assign boolean values to numeric fields to avoid browser errors
        
        // For the UI's Total field, use payment_total if available, otherwise fallback to estimate
        // Ensure we're converting to string numbers properly
        let paymentTotalValue = '0.00';
        if (typeof patientData.payment.payment_total === 'boolean') {
          paymentTotalValue = patientData.payment.payment_total ? '1' : '0';
        } else {
          paymentTotalValue = (patientData.payment.payment_total || patientData.payment.final_amount)?.toString() || '0.00';
        }
        newFormData.payment = paymentTotalValue;
        
        // Other payment fields - ensure proper type conversion
        newFormData.estimate = typeof patientData.payment.estimate === 'boolean' ? 
                              (patientData.payment.estimate ? '1' : '0') : 
                              patientData.payment.estimate?.toString() || '0.00';
                              
        newFormData.schAmt = typeof patientData.payment.discount_amount === 'boolean' ? 
                            (patientData.payment.discount_amount ? '1' : '0') : 
                            patientData.payment.discount_amount?.toString() || '0.00';
                            
        newFormData.advance = typeof patientData.payment.advance === 'boolean' ? 
                             (patientData.payment.advance ? '1' : '0') : 
                             patientData.payment.advance?.toString() || '0.00';
        
        // CRITICAL FIX: Use the database balance value directly without recalculation
        // We want to preserve the database balance value exactly as stored
        if (patientData.payment.balance !== undefined && patientData.payment.balance !== null) {
          // Use the database balance value directly
          newFormData.balance = patientData.payment.balance.toString();
          logDebug('Using exact database balance', { balance: patientData.payment.balance });
        } else {
          // Only if balance is not in database, calculate it
          const paymentTotal = parseFloat(paymentTotalValue);
          const advance = parseFloat(newFormData.advance);
          newFormData.balance = Math.max(0, paymentTotal - advance).toFixed(2);
          logDebug('DATABASE BALANCE NOT FOUND - Using calculated balance', { balance: newFormData.balance });
        }
        
        // Individual advance fields - ensure proper type conversion
        newFormData.cashAdv = typeof patientData.payment.cash_advance === 'boolean' ? 
                              (patientData.payment.cash_advance ? '1' : '0') : 
                              patientData.payment.cash_advance?.toString() || '0.00';
                              
        newFormData.cashAdv2 = '0.00'; // This field isn't in the database, but exists in UI
        
        newFormData.ccUpiAdv = typeof patientData.payment.card_upi_advance === 'boolean' ? 
                               (patientData.payment.card_upi_advance ? '1' : '0') : 
                               patientData.payment.card_upi_advance?.toString() || '0.00';
                               
        newFormData.chequeAdv = typeof patientData.payment.cheque_advance === 'boolean' ? 
                                (patientData.payment.cheque_advance ? '1' : '0') : 
                                patientData.payment.cheque_advance?.toString() || '0.00';
        
        // Do NOT recalculate when loading - display database values directly
        logDebug('Using database values directly without recalculation');
        
        // Payment method and date
        newFormData.paymentMethod = patientData.payment.payment_mode || 'Cash';
        newFormData.advDate = patientData.payment.payment_date || getTodayDate();
        
        // IMPORTANT DEBUG: Log the final values after type conversion
        logDebug('AFTER CONVERSION - Final payment values', {
          payment: newFormData.payment,
          estimate: newFormData.estimate,
          schAmt: newFormData.schAmt,
          advance: newFormData.advance,
          balance: newFormData.balance,
          cashAdv: newFormData.cashAdv,
          ccUpiAdv: newFormData.ccUpiAdv,
          chequeAdv: newFormData.chequeAdv
        });
      }
      
      // Add extra debug to check contact lens items
      if (newFormData.contactLensItems && newFormData.contactLensItems.length > 0) {
        logDebug('DETAILED ITEM DEBUG - Final mapped items with discount values', { 
          items: newFormData.contactLensItems.map(item => ({
            qty: item.qty,
            rate: item.rate, 
            discountPercent: item.discountPercent,
            discountAmount: item.discountAmount,
            amount: item.amount
          }))
        });
        
        // CRITICAL FIX: Ensure the payment data from database includes the discount values
        if (patientData.payment) {
          const discountPercent = parseFloat(patientData.payment.discount_percent || '0');
          const discountAmount = parseFloat(patientData.payment.discount_amount || patientData.payment.scheme_discount || '0');
          
          logDebug('FOUND PAYMENT DISCOUNT VALUES FROM DB', { discountPercent, discountAmount });
          
          // If we have any discount values in the payment but not in the items, apply them to all items
          if ((discountPercent > 0 || discountAmount > 0) && 
              newFormData.contactLensItems.every(item => !item.discountPercent && !item.discountAmount)) {
            
            logDebug('APPLYING PAYMENT DISCOUNT TO ITEMS - Items had no discount values but payment did');
            
            // Calculate correct discount values for each item based on payment totals
            newFormData.contactLensItems = newFormData.contactLensItems.map(item => {
              const baseAmount = item.qty * item.rate;
              let itemDiscountPercent = discountPercent;
              let itemDiscountAmount = 0;
              
              if (discountPercent > 0) {
                // Calculate discount amount based on percentage
                const calculatedAmount = baseAmount * discountPercent / 100;
                itemDiscountAmount = parseFloat(calculatedAmount.toFixed(2));
              } else if (discountAmount > 0) {
                // Calculate percentage based on total discount amount and item proportion
                const totalBeforeDiscount = newFormData.contactLensItems.reduce(
                  (sum, i) => sum + (i.qty * i.rate), 0
                );
                const itemProportion = baseAmount / totalBeforeDiscount;
                itemDiscountAmount = parseFloat((discountAmount * itemProportion).toFixed(2));
                itemDiscountPercent = parseFloat(((itemDiscountAmount / baseAmount) * 100).toFixed(2));
              }
              // Calculate final amount after discount
              // CRITICAL: Handle the zero quantity edge case
              const finalAmount = baseAmount > 0 ? 
                parseFloat((baseAmount - itemDiscountAmount).toFixed(2)) : 
                parseFloat((item.rate - (item.rate * itemDiscountPercent / 100)).toFixed(2)); // Use item.rate directly if qty is 0
              // Debug calculation
              logDebug('Calculating discount amount', { baseAmount, itemDiscountPercent, itemDiscountAmount, finalAmount });
              
              return {
                ...item,
                discountPercent: itemDiscountPercent,
                discountAmount: itemDiscountAmount,
                discount_percent: itemDiscountPercent,
                discount_amount: itemDiscountAmount,
                disc_percent: itemDiscountPercent,
                disc_amount: itemDiscountAmount,
                amount: finalAmount
              };
            });
          }
        }
      }
      
      // Update the form with the new data - SINGLE SOURCE OF TRUTH for payment data
      // We'll use ONLY the newFormData we've already prepared to avoid recalculations
      setFormData(prevState => {
        // Keep a record of the loaded database values for debugging
        logDebug('FINAL DB LOAD - Payment data from database', {
          payment_total: patientData.payment?.payment_total || 0,
          scheme_discount: patientData.payment?.scheme_discount || 0,
          estimate_amount: patientData.payment?.estimate_amount || 0,
          advance: patientData.payment?.advance || 0,
          balance: patientData.payment?.balance || 0,
          newFormData_payment: newFormData.payment,
          newFormData_advance: newFormData.advance,
          newFormData_balance: newFormData.balance
        });
        
        // IMPORTANT: We're NOT recalculating anything here - just using the values
        // that were already converted and prepared in the previous step
        return {
          ...prevState,
          ...newFormData  // Use the newFormData object exactly as prepared above
        };
      });
      
      // CRITICAL: With DB values loaded, we should NEVER recalculate totals
      // Only in the rare case of no payment data at all, we might need initial calculation
      if (!patientData.payment && newFormData.contactLensItems && newFormData.contactLensItems.length > 0) {
        logDebug('No payment data from database, calculating initial totals from items');
        // Specify this is NOT a manual calculation (loading from DB)
        calculateTotal(newFormData.contactLensItems, false); 
      } else {
        logDebug('SKIPPING CALCULATION - Using exact database values without any recalculation');
        // Explicit log to confirm we're NOT calling calculateTotal() here
        logDebug('DB LOAD: Payment values preserved exactly as loaded from database');
      }
      
      // Set flag to indicate DB loading is complete - this allows future UI interactions
      // to calculate values as needed
      setTimeout(() => {
        logDebug('DB LOAD COMPLETED - Calculations no longer blocked');
        setIsLoadingFromDB(false);
        
        // FINAL VALIDATION: Verify the discount values are properly loaded in the UI
        logDebug('VALIDATION CHECK - Final state of contact lens items',
          newFormData.contactLensItems.map(item => ({
            qty: item.qty,
            rate: item.rate,
            baseAmount: item.qty * item.rate,
            discountPercent: item.discountPercent,
            discountAmount: item.discountAmount,
            calculatedDiscountAmount: (item.qty * item.rate * item.discountPercent / 100).toFixed(2),
            amount: item.amount
          }))
        );
      }, 500);
      
      // Hide the search section to give more focus to the populated form
      setShowSearchSection(false);
      
      // Show success notification
      setNotification({
        message: 'Patient data loaded successfully!',
        type: 'success',
        visible: true
      });
      
      // IMPORTANT: Reset the loading flag now that all data is loaded successfully
      setIsLoadingFromDB(false);
      logDebug('DB LOAD COMPLETED - Calculations no longer blocked');
      
    } catch (error) {
      logError('Error mapping patient data to form', error);
      setNotification({
        message: 'Error loading patient data',
        type: 'error',
        visible: true
      });
      
      // IMPORTANT: Reset the loading flag in case of error too
      setIsLoadingFromDB(false);
      logDebug('DB LOAD FAILED - Calculations no longer blocked');
    }
  };  

  // Track current updated_at for navigation
  useEffect(() => {
    // Try to get updated_at from the most recent hydrated data
    if ((formData as any)?.updated_at) {
      setCurrentUpdatedAt((formData as any).updated_at);
    } else if ((formData as any)?.contactLensData?.updated_at) {
      setCurrentUpdatedAt((formData as any).contactLensData.updated_at);
    } else {
      setCurrentUpdatedAt(null);
    }
  }, [formData]);

  // Navigation handlers
  const handleFirst = async () => {
    setIsNavigating(true);
    try {
      const result = await contactLensService.getFirstContactLens();
      if (result.success && result.data) {
        handlePatientSelect(result.data);
        setNotification({ message: 'Loaded first (oldest) contact lens record.', type: 'success', visible: true });
      } else {
        setNotification({ message: result.message || 'No records found.', type: 'error', visible: true });
      }
    } catch (e) {
      setNotification({ message: 'Error loading first contact lens record.', type: 'error', visible: true });
    } finally {
      setIsNavigating(false);
    }
  };

  const handleLast = async () => {
    setIsNavigating(true);
    try {
      const result = await contactLensService.getLastContactLens();
      if (result.success && result.data) {
        handlePatientSelect(result.data);
        setNotification({ message: 'Loaded last (most recent) contact lens record.', type: 'success', visible: true });
      } else {
        setNotification({ message: result.message || 'No records found.', type: 'error', visible: true });
      }
    } catch (e) {
      setNotification({ message: 'Error loading last contact lens record.', type: 'error', visible: true });
    } finally {
      setIsNavigating(false);
    }
  };

  const handlePrev = async () => {
    setIsNavigating(true);
    try {
      let result;
      if (!currentUpdatedAt) {
        result = await contactLensService.getLastContactLens();
      } else {
        result = await contactLensService.getPrevContactLens(currentUpdatedAt);
      }
      if (result.success && result.data) {
        handlePatientSelect(result.data);
        setNotification({ message: 'Loaded previous contact lens record.', type: 'success', visible: true });
      } else {
        setNotification({ message: result.message || 'No previous record found.', type: 'error', visible: true });
      }
    } catch (e) {
      setNotification({ message: 'Error loading previous contact lens record.', type: 'error', visible: true });
    } finally {
      setIsNavigating(false);
    }
  };

  const handleNext = async () => {
    setIsNavigating(true);
    try {
      let result;
      if (!currentUpdatedAt) {
        result = await contactLensService.getFirstContactLens();
      } else {
        result = await contactLensService.getNextContactLens(currentUpdatedAt);
      }
      if (result.success && result.data) {
        handlePatientSelect(result.data);
        setNotification({ message: 'Loaded next contact lens record.', type: 'success', visible: true });
      } else {
        setNotification({ message: result.message || 'No next record found.', type: 'error', visible: true });
      }
    } catch (e) {
      setNotification({ message: 'Error loading next contact lens record.', type: 'error', visible: true });
    } finally {
      setIsNavigating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setNotification({ message: 'Saving...', type: 'success', visible: true });

    try {
      // Prepare the data payload in the format expected by the service
      const payload = {
        prescription: {
          prescription_id: formData.prescriptionNo,
          name: formData.name,
          mobile: formData.mobile,
          age: formData.age,
          gender: formData.gender,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pin: formData.pin,
          prescribed_by: formData.prescBy,
          remarks: formData.remarks,
          status: formData.orderStatus,
          retest_date: toYYYYMMDD(formData.retestAfter),
          expiry_date: toYYYYMMDD(formData.expiryDate),
          delivery_date: toYYYYMMDD(formData.date.split('T')[0]),
          delivery_time: formData.date.split('T')[1],
          booked_by: formData.bookingBy,
          reference_no: formData.reference_no,
          customer_code: formData.customerCode,
          birth_day: toYYYYMMDD(formData.birthDay),
          marriage_anniversary: toYYYYMMDD(formData.marriageAnniversary),
          phone_landline: formData.phoneLandline,
          class: formData.class,
        },
        eyes: [
          // Right Eye DV
          {
            eye_side: 'Right',
            vision_type: 'dv' as 'dv',
            sph: formData.rightEye.dv.sph,
            cyl: formData.rightEye.dv.cyl,
            axis: formData.rightEye.dv.ax,
            add_power: formData.rightEye.dv.add,
            vn: formData.rightEye.dv.vn,
            rpd: formData.rightEye.dv.rpd,
            lpd: '',
            ipd: formData.ipd,
          },
          // Right Eye NV
          {
            eye_side: 'Right',
            vision_type: 'nv' as 'nv',
            sph: formData.rightEye.nv.sph,
            cyl: formData.rightEye.nv.cyl,
            axis: formData.rightEye.nv.ax,
            add_power: formData.rightEye.nv.add,
            vn: formData.rightEye.nv.vn,
            rpd: '',
            lpd: '',
            ipd: formData.ipd,
          },
          // Left Eye DV
          {
            eye_side: 'Left',
            vision_type: 'dv' as 'dv',
            sph: formData.leftEye.dv.sph,
            cyl: formData.leftEye.dv.cyl,
            axis: formData.leftEye.dv.ax,
            add_power: formData.leftEye.dv.add,
            vn: formData.leftEye.dv.vn,
            rpd: '',
            lpd: formData.leftEye.dv.lpd,
            ipd: formData.ipd,
          },
          // Left Eye NV
          {
            eye_side: 'Left',
            vision_type: 'nv' as 'nv',
            sph: formData.leftEye.nv.sph,
            cyl: formData.leftEye.nv.cyl,
            axis: formData.leftEye.nv.ax,
            add_power: formData.leftEye.nv.add,
            vn: formData.leftEye.nv.vn,
            rpd: '',
            lpd: '',
            ipd: formData.ipd,
          },
        ],
        items: formData.contactLensItems.map(item => ({
          ...item,
          eye_side: item.side || 'Both', // Ensure eye_side is present
          base_curve: item.bc ?? item.base_curve ?? '',
          axis: item.ax ?? item.axis ?? '',
          lens_code: item.lensCode ?? item.lens_code ?? ''
        })),
        payment: {
          payment_total: parseFloat(formData.payment) || 0,
          estimate: parseFloat(formData.estimate) || 0,
          advance: parseFloat(formData.advance) || 0,
          balance: parseFloat(formData.balance) || 0,
          payment_mode: formData.paymentMethod,
          cash_advance: parseFloat(formData.cashAdv) || 0,
          card_upi_advance: parseFloat(formData.ccUpiAdv) || 0,
          scheme_discount: !!(parseFloat(formData.schAmt) > 0),
          discount_amount: (parseFloat(formData.estimate) || 0) - (parseFloat(formData.payment) || 0),
        },
      };

      // Use the new upsert function
      const result = await contactLensService.saveOrUpdateContactLensData(payload, formData.contactLensId);

      if (result.success) {
        setNotification({ message: 'Data saved successfully!', type: 'success', visible: true });
        // If it was a new record, update the form with the new ID
        if (result.id && !formData.id) {
          setFormData(prev => ({ ...prev, id: result.id }));
        }
      } else {
        setNotification({ message: `Error: ${result.message}`, type: 'error', visible: true });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logError('Failed to save contact lens data', error);
      setNotification({ message: `Failed to save data: ${errorMessage}`, type: 'error', visible: true });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAll = () => {
    setFormData(initialContactLensForm);
    setShowSearchSection(true);
  };

  return (
    <div className="p-2 sm:p-4 bg-gray-50 min-h-screen">
      <div className="max-w-screen-xl mx-auto">
        <Card className="p-4 sm:p-6">
          <div className="border-b pb-4 mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <h1 className="text-2xl font-bold text-gray-800">Contact Lens</h1>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                <button className="text-sm text-blue-600 hover:underline" onClick={handleFirst} disabled={isNavigating}>&lt;&lt; First</button>
                <button className="text-sm text-blue-600 hover:underline" onClick={handlePrev} disabled={isNavigating}>&lt; Prev</button>
                <button className="text-sm text-blue-600 hover:underline" onClick={handleNext} disabled={isNavigating}>Next &gt;</button>
                <button className="text-sm text-blue-600 hover:underline" onClick={handleLast} disabled={isNavigating}>Last &gt;&gt;</button>
                <button className="text-sm text-blue-600 hover:underline">&lt;&lt; Display Prescription History &gt;&gt;</button>
              </div>
            </div>
            
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Contact Lens Card</h2>
            
            {/* Search Section */}
            {showSearchSection && (
              <div className="mb-6 pb-4 border-b border-gray-200">
                <ContactLensSearch onSelectPatient={handlePatientSelect} />
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Prescription No."
                  name="prescriptionNo"
                  value={formData.prescriptionNo}
                  onChange={handleChange}
                />
                <Input
                  label="Ref No."
                  name="reference_no"
                  value={formData.reference_no}
                  onChange={handleChange}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Input
                    type="datetime-local"
                    label="Date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <Input
                    type="time"
                    label="Time"
                    name="time"
                    value={formData.time}
                    onChange={handleChange}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Input
                    type="datetime-local"
                    label="Dlv. Date"
                    name="dvDate"
                    value={formData.dvDate}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <Input
                    type="time"
                    label="Dlv. Time"
                    name="dvTime"
                    value={formData.dvTime}
                    onChange={handleChange}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Select
                  label="Class"
                  name="class"
                  value={formData.class}
                  onChange={handleChange}
                  options={[
                    { label: 'Select Class', value: '' },
                    { label: 'Business', value: 'Business' },
                    { label: 'Class 1', value: 'Class 1' },
                    { label: 'Class 2', value: 'Class 2' }
                  ]}
                />
                <Select
                  label="Booking By"
                  name="bookingBy"
                  value={formData.bookingBy}
                  onChange={handleChange}
                  options={[
                    { label: 'Select Booking By', value: '' },
                    { label: 'Staff 1', value: 'Staff 1' },
                    { label: 'Staff 2', value: 'Staff 2' }
                  ]}
                />
              </div>
              
              {/* Eye Prescription Section */}
              <ContactLensPrescriptionSection 
                formData={formData}
                handleChange={handleChange}
                handleNumericInputChange={handleNumericInputChange}
                handleCheckboxChange={handleCheckboxChange}
              />
            </div>
            
            {/* Right Column - Personal Information */}
            <ContactLensPersonalInfo
              formData={formData}
              handleChange={handleChange}
              handleCheckboxChange={handleCheckboxChange}
            />
          </div>
          
          {/* Contact Lens Details Table */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-medium">Selected Contact Lens Details</h2>
              <button 
                onClick={() => setShowManualForm(true)}
                className="text-blue-600 hover:underline"
              >
                &lt;&lt; Add Contact Lens Manually &gt;&gt;
              </button>
            </div>
            
            <ContactLensItemTable 
              items={formData.contactLensItems}
              setItems={(items) => {
                setFormData({ ...formData, contactLensItems: items });
                calculateTotal(items);
              }}
            />
          </div>
          
          {/* Bottom Section */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            {/* Remarks and Order Status */}
            <ContactLensOrderStatus
              formData={formData}
              handleChange={handleChange}
            />
            
            {/* Payment Section */}
            <ContactLensPayment
              formData={formData}
              handleChange={handleChange}
              handleNumericInputChange={handleNumericInputChange}
              discountPercentage={discountPercentage}
              setDiscountPercentage={setDiscountPercentage}
              handleApplyDiscount={handleApplyDiscount}
            />
          </div>
          
          {/* SAVE DATA Button - Prominent Placement */}
          {/* Removed green SAVE DATA button and moved save logic to Add Contact Lenses button below */}
          
          {/* Bottom Buttons */}
          <div className="mt-6 flex justify-end space-x-4">
            <Button
              onClick={handleSave}
            >
              &lt;&lt; Add Contact Lenses &gt;&gt;
            </Button>
            <Button 
              onClick={() => setShowSearchSection(!showSearchSection)}
            >
              {showSearchSection ? '« Hide Search »' : '« Show Search »'}
            </Button>
            <Button>&lt;&lt; Print Contact Lenses &gt;&gt;</Button>
            <Button 
              onClick={handleClearAll}
            >
              &lt;&lt; Clear All &gt;&gt;
            </Button>
            <Button
              onClick={() => navigate('/')}
            >
              &lt;&lt; Exit &gt;&gt;
            </Button>
          </div>
        </Card>

        {/* Render the Toast Notification */}
        {notification.visible && (
          <ToastNotification 
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification({ ...notification, visible: false })}
          />
        )}
        
        {/* Manual Entry Form Popup */}
        {showManualForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <ContactLensManualForm 
              onAdd={handleAddContactLens}
              onClose={() => setShowManualForm(false)}
            />
          </div>
        )}

        {isSaving && (
          <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow">
            Saving...
          </div>
        )}

        {isNavigating && (
          <div className="fixed bottom-4 left-4 bg-gray-700 text-white px-4 py-2 rounded shadow">
            Loading contact lens record...
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactLensPage;
