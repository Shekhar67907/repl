import React, { useState, useEffect } from 'react';
import { X, Minus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getTodayDate } from '../../utils/helpers';
import CustomerSearch from './CustomerSearch';
import { getCustomerPurchaseHistory, getCustomerDetails } from '../../Services/billingService';
import { getNormalizedMobile, getNormalizedName, getNormalizedNumber, getNormalizedPinCode } from '../../utils/dataNormalization';
import { logDebug, logError, logInfo } from '../../utils/logger';

interface PurchaseHistory {
  id: string;
  type: string;
  prescription_no?: string;
  order_no?: string;
  date: string;
  total_amount?: number;
}

// Define the interface for billing items
interface BillingItem {
  id: string;
  selected: boolean;
  itemCode: string;
  itemName: string;
  orderNo: string;
  rate: string;
  taxPercent: string;
  quantity: string;
  amount: string;
  discount: string;
  discountPercent: string;
  _originalPurchase?: any;
  [key: string]: any;
}

const BillingPage: React.FC = () => {
  const navigate = useNavigate();
  const [cashMemo, setCashMemo] = useState('B1920-030');
  const [referenceNo, setReferenceNo] = useState('B1920-030');
  const [currentDate, setCurrentDate] = useState(getTodayDate());
  // Format time in 24-hour format for HTML input[type="time"]
  const formatTimeForInput = (date: Date) => {
    return date.toTimeString().slice(0, 5); // Returns HH:MM
  };
  
  const [currentTime, setCurrentTime] = useState(formatTimeForInput(new Date()));
  const [jobType, setJobType] = useState('');
  const [bookingBy, setBookingBy] = useState('');
  const [itemName, setItemName] = useState('');
  const [prescBy, setPrescBy] = useState('');
  
  // Personal Information
  const [namePrefix, setNamePrefix] = useState('Mr.');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [ccode, setCcode] = useState('');
  const [isCash, setIsCash] = useState(false);
  
  // Customer data and purchase history
  const [customerPurchaseHistory, setCustomerPurchaseHistory] = useState<Array<PurchaseHistory & { [key: string]: any }>>([]);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  
  // Billing items state
  const [billingItems, setBillingItems] = useState<BillingItem[]>([]);
  
  // Start with an empty array - items will be loaded when a customer is selected
  useEffect(() => {
    setBillingItems([]);
  }, []);

  // Handle customer selection from search
  const handleCustomerSelect = async (customer: any) => {
    try {
      logDebug('Customer selected from search', customer);
      setIsLoadingCustomer(true);
      
      // Clear previous customer data
      setName('');
      setMobile('');
      setEmail('');
      setAddress('');
      setCity('');
      setState('');
      setPin('');
      setAge('');
      
      // Start with empty billing items
      setBillingItems([]);
      logDebug('Cleared previous billing items');
      
      // TEMP: Don't set any default billing items yet
      // setBillingItems([1, 2, 3].map(id => ({
      //   id: id.toString(),
      //   selected: false,
      //   itemCode: '',
      //   itemName: '',
      //   orderNo: '',
      //   rate: '0',
      //   taxPercent: '0',
      //   quantity: '1',
      //   amount: '0',
      //   discount: '0',
      //   discountPercent: '0',
      //   _originalPurchase: null
      // })));
      
      // Fetch full customer details from their original table
      logDebug('Fetching detailed customer data...');
      const detailedCustomerData = await getCustomerDetails(customer);
      logDebug('Detailed customer data:', detailedCustomerData);

      // Use detailed data if available, otherwise fall back to search result data
      const customerData = detailedCustomerData || customer;
      const mobileNo = getNormalizedMobile(customerData) || getNormalizedMobile(customer);
      
      if (!mobileNo) {
        logError('No mobile number found for customer');
        return;
      }

      // Populate form fields with customer data
      logDebug('Setting customer details from data');
      const customerName = getNormalizedName(customerData);
      
      // Extract name prefix if present (e.g., "Mr. John Doe" -> "Mr.")
      const nameParts = customerName.split(' ');
      const possiblePrefix = nameParts[0].endsWith('.') ? nameParts[0] : '';
      const nameWithoutPrefix = possiblePrefix ? nameParts.slice(1).join(' ') : customerName;
      
      if (possiblePrefix && namePrefixOptions.includes(possiblePrefix)) {
        setNamePrefix(possiblePrefix);
        setName(nameWithoutPrefix);
      } else {
        setName(customerName);
      }
      
      setMobile(mobileNo);
      setEmail(customerData.email || '');
      setAddress(customerData.address || '');
      setCity(customerData.city || '');
      setState(customerData.state || '');
      setPin(getNormalizedPinCode(customerData));
      setPhone(customerData.phone_landline || customerData.phone || '');
      
      if (customerData.age) {
        setAge(customerData.age.toString());
      }
      
      // Get purchase history for the customer
      logDebug('Fetching purchase history for mobile:', mobileNo);
      const purchaseHistoryResponse = await getCustomerPurchaseHistory(mobileNo);
      
      // Ensure we have an array of purchase history items and filter out non-billable items
      let purchaseHistoryItems: Array<PurchaseHistory & { [key: string]: any }> = [];
      
      // Helper function to determine if an item should be included
      const shouldIncludeItem = (item: any) => {
        // Always include orders
        if (item.type === 'order') return true;
        
        // Only include prescriptions that have actual billable content
        if (item.type === 'prescription') {
          // Exclude system prescriptions like 'Eye Examination'
          if (item.item_name === 'Eye Examination') return false;
          
          // Include prescriptions that have items or are marked as billable
          return (item.items && item.items.length > 0) || 
                 item.is_billable === true ||
                 (item.item_name && item.item_name.trim() !== '');
        }
        
        // Include contact lens items by default
        if (item.type === 'contact_lens') return true;
        
        // Default to excluding anything else
        return false;
      };
      
      if (Array.isArray(purchaseHistoryResponse)) {
        purchaseHistoryItems = purchaseHistoryResponse.filter(shouldIncludeItem);
      } else if (purchaseHistoryResponse && typeof purchaseHistoryResponse === 'object') {
        if (shouldIncludeItem(purchaseHistoryResponse)) {
          purchaseHistoryItems = [purchaseHistoryResponse];
        }
      }
      
      logDebug('Filtered purchase history items:', purchaseHistoryItems);
      
      logDebug('Raw purchase history data:', {
        data: purchaseHistoryItems,
        count: purchaseHistoryItems.length
      });
      
      // Log details of each item
      purchaseHistoryItems.forEach((item, index) => {
        logDebug(`Purchase history item ${index + 1}:`, {
          id: item.id,
          type: item.type,
          item_name: item.item_name,
          item_code: item.item_code,
          quantity: item.quantity,
          amount: item.amount,
          date: item.date,
          _originalItem: item._originalItem,
          _originalPurchase: item._originalPurchase
        });
      });
      
      // Update state with the purchase history items
      logDebug('Setting purchase history with items:', purchaseHistoryItems.length);
      setCustomerPurchaseHistory(purchaseHistoryItems);
      
      // Auto-populate billing items with recent purchases
      if (purchaseHistoryItems.length > 0) {
        logDebug('Populating billing items with history');
        try {
          const populatedItems = [];
          let itemCount = 0;
          const maxItems = 3; // Maximum number of items to show initially

          // --- Aggregate payment fields across only selected billing items ---
          const selectedItems = billingItems.filter(item => item.selected);
          // DEBUG: Log selected items for payment calculation
          console.debug('[BILLING][PAYMENT] Selected items for payment calculation', selectedItems);
          let totalAdvance = 0;
          let totalEstimate = 0;
          let totalDiscount = 0;
          let totalPayment = 0;
          let totalCash = 0;
          let totalCcUpiAdv = 0;
          let totalCheque = 0;
          let totalTax = 0;
          let totalBalance = 0;
          for (const item of selectedItems) {
            const payment = item._originalPurchase?.payment || item.payment;
            // --- Robust type handling for advance ---
            let advanceValue = 0;
            if (payment && !isNaN(Number(payment.advance)) && Number(payment.advance) > 0) {
              advanceValue = Number(payment.advance);
            } else if (payment && (
              !isNaN(Number(payment.advance_cash)) ||
              !isNaN(Number(payment.advance_card_upi)) ||
              !isNaN(Number(payment.advance_other))
            )) {
              advanceValue =
                (Number(payment.advance_cash) || 0) +
                (Number(payment.advance_card_upi) || 0) +
                (Number(payment.advance_other) || 0);
            } else if (!isNaN(Number(item.advance)) && Number(item.advance) > 0) {
              advanceValue = Number(item.advance);
            }
            // Log each item's advance value used
            console.debug('[BILLING][PAYMENT] Advance value used for item', { itemId: item.id, advanceValue, paymentAdvance: payment?.advance, itemAdvance: item.advance });
            totalAdvance += advanceValue;
            // --- Other fields, also robustly handle types ---
            totalEstimate += !isNaN(Number(payment?.estimate)) ? Number(payment.estimate) : (!isNaN(Number(item.estimate)) ? Number(item.estimate) : 0);
            totalDiscount += !isNaN(Number(payment?.discount_amount)) ? Number(payment.discount_amount) : (!isNaN(Number(item.discount)) ? Number(item.discount) : 0);
            // --- Payment: sum all paid amounts (advance, cash, card, cheque, etc.) ---
            let paid = 0;
            if (payment) {
              paid += Number(payment.advance) || 0;
              paid += Number(payment.cash_advance) || 0;
              paid += Number(payment.card_upi_advance) || 0;
              paid += Number(payment.cheque_advance) || 0;
              paid += Number(payment.advance_cash) || 0;
              paid += Number(payment.advance_card_upi) || 0;
              paid += Number(payment.advance_other) || 0;
            }
            totalPayment += paid;
            totalCash += !isNaN(Number(payment?.cash_advance)) ? Number(payment.cash_advance) : 0;
            totalCcUpiAdv += !isNaN(Number(payment?.card_upi_advance)) ? Number(payment.card_upi_advance) : 0;
            totalCheque += !isNaN(Number(payment?.cheque_advance)) ? Number(payment.cheque_advance) : 0;
            totalTax += !isNaN(Number(item.taxPercent)) ? Number(item.taxPercent) : 0;
            totalBalance += !isNaN(Number(payment?.balance)) ? Number(payment.balance) : 0;
          }
          // DEBUG: Log computed payment totals
          console.debug('[BILLING][PAYMENT] Computed totals', {
            totalAdvance,
            totalEstimate,
            totalDiscount,
            totalPayment,
            totalCash,
            totalCcUpiAdv,
            totalCheque,
            totalTax,
            totalBalance
          });
          // Set payment section fields to these totals
          setAdvance(totalAdvance ? totalAdvance.toString() : '0.00');
          setEstimate(totalEstimate ? totalEstimate.toString() : '0.00');
          setSchDisc(totalDiscount ? totalDiscount.toString() : '0.00');
          setPayment(totalPayment ? totalPayment.toString() : '0.00');
          setCash(totalCash ? totalCash.toString() : '0.00');
          setCcUpiAdv(totalCcUpiAdv ? totalCcUpiAdv.toString() : '0.00');
          setCheque(totalCheque ? totalCheque.toString() : '0.00');
          setTax(totalTax ? totalTax.toString() : '0.00');
          setBalance(totalBalance ? totalBalance.toString() : '0.00');

          // Process each history item
          for (const purchase of purchaseHistoryItems) {
            if (itemCount >= maxItems) break;
            
            logDebug(`Processing purchase:`, purchase);
            
            // Log the full purchase object for debugging
            logDebug('Processing purchase details:', JSON.parse(JSON.stringify(purchase)));
            
            // Handle order items (from order table)
            if (purchase.type === 'order') {
              // If we have _originalItem, it's an order item
              if (purchase._originalItem) {
                const item = purchase._originalItem;
                const itemName = item.item_name || item.lens_type || item.product_name || 'Order Item';
                const itemCode = item.item_code || item.product_code || `ITEM-${itemCount}`;
                const orderNo = purchase.referenceNo || purchase.order_no || `ORDER-${purchase.id}`;
                const rate = item.rate || item.unit_price || 0;
                const quantity = item.quantity || 1;
                const taxPercent = item.tax_percent || 0;
                const discountPercent = typeof item.discount_percent === 'number' ? item.discount_percent : parseFloat(item.discount_percent || '0');
                const discountAmount = typeof item.discount_amount === 'number' ? item.discount_amount : parseFloat(item.discount_amount || '0');
                const amount = item.amount || (rate * quantity);
                
                populatedItems.push({
                  id: `order_${purchase.id}_${item.id || itemCount}`,
                  selected: true,
                  itemCode: itemCode,
                  itemName: itemName,
                  orderNo: orderNo,
                  rate: getNormalizedNumber(rate),
                  taxPercent: getNormalizedNumber(taxPercent),
                  quantity: getNormalizedNumber(quantity),
                  amount: getNormalizedNumber(amount),
                  discount: getNormalizedNumber(discountAmount),
                  discountPercent: getNormalizedNumber(discountPercent),
                  _originalPurchase: {
                    ...purchase,
                    // Ensure we preserve the original values
                    discount_amount: typeof item.discount_amount === 'number' ? item.discount_amount : parseFloat(item.discount_amount || '0'),
                    discount_percent: typeof item.discount_percent === 'number' ? item.discount_percent : parseFloat(item.discount_percent || '0'),
                    rate: item.rate || 0,
                    amount: item.amount || 0,
                    tax_percent: item.tax_percent || 0,
                    quantity: item.quantity || 1,
                    item_name: item.item_name || itemName,
                    item_code: item.item_code || `ITEM-${itemCount}`
                  }
                });
                itemCount++;
              }
              // If we have order_items array, process each item
              else if (purchase._originalPurchase?.order_items) {
                for (const item of purchase._originalPurchase.order_items) {
                  if (itemCount >= maxItems) break;
                  
                  const itemName = item.item_name || 
                                 (item.lens_type ? `${item.lens_type} Lenses` : 'Order Item');
                  
                  populatedItems.push({
                    id: `${purchase.id}_${item.id || itemCount}`,
                    selected: true,
                    itemCode: item.item_code || `ITEM-${itemCount}`,
                    itemName: itemName,
                    orderNo: purchase.referenceNo || purchase.order_no || `ORDER-${purchase.id}`,
                    rate: getNormalizedNumber(item.rate || 0),
                    taxPercent: getNormalizedNumber(item.tax_percent || 0),
                    quantity: getNormalizedNumber(item.quantity || 1),
                    amount: getNormalizedNumber(item.amount || 0),
                    discount: getNormalizedNumber(typeof item.discount_amount === 'number' ? item.discount_amount : parseFloat(item.discount_amount || '0')),
                    discountPercent: getNormalizedNumber(typeof item.discount_percent === 'number' ? item.discount_percent : parseFloat(item.discount_percent || '0')),
                    _originalPurchase: {
                      ...purchase,
                      ...item,
                      // Ensure we preserve the original values
                      discount_amount: typeof item.discount_amount === 'number' ? item.discount_amount : parseFloat(item.discount_amount || '0'),
                      discount_percent: typeof item.discount_percent === 'number' ? item.discount_percent : parseFloat(item.discount_percent || '0'),
                      rate: item.rate || 0,
                      amount: item.amount || 0,
                      tax_percent: item.tax_percent || 0,
                      quantity: item.quantity || 1,
                      item_name: item.item_name || itemName,
                      item_code: item.item_code || `ITEM-${itemCount}`
                    }
                  });
                  itemCount++;
                }
              }
            } 
            // Handle contact lens items
            else if (purchase.type === 'contact_lens' || purchase.sourceType === 'contact_lens' || 
                    (purchase._originalPurchase?.contact_lens_items?.length > 0)) {
              const items = purchase.items || purchase._originalPurchase?.contact_lens_items || [];
              
              for (const item of items) {
                if (itemCount >= maxItems) break;
                
                // Map contact lens side from database to UI values
                const side = item.eye_side === 'Right' ? 'RE' : 
                            item.eye_side === 'Left' ? 'LE' : '';
                
                // Get all relevant fields with fallbacks
                const brand = item.brand || item.brand_name || '';
                const material = item.material || '';
                const power = item.power || item.sph || '';
                const baseCurve = item.base_curve || item.bc || '';
                const diameter = item.diameter || item.dia || '';
                const quantity = item.quantity || 1;
                const rate = item.rate || item.unit_price || 0;
                const taxPercent = item.tax_percent || 0;
                const discountPercent = typeof item.discount_percent === 'number' ? item.discount_percent : parseFloat(item.discount_percent || '0');
                const discountAmount = typeof item.discount_amount === 'number' ? item.discount_amount : parseFloat(item.discount_amount || '0');
                const amount = item.amount || (rate * quantity) || 0;
                
                // --- Contact Lens Payment Mapping (GUARANTEED FIX) ---
                // Always get payment from parent purchase for each contact lens item
                const parentPayment = purchase.payment || purchase._originalPurchase?.payment || purchase._originalPurchase?._originalPurchase?.payment;
                const clDiscount = parentPayment ? parentPayment.discount_amount : discountAmount;
                const clDiscountPercent = parentPayment ? parentPayment.discount_percent : discountPercent;
                const clAdvance = parentPayment ? parentPayment.advance : 0;
                const clEstimate = parentPayment ? parentPayment.estimate : amount;
                // Debug log for every contact lens item
                console.debug('DEBUG: Contact lens mapping (guaranteed fix)', {
                  parentPayment,
                  clDiscount,
                  clDiscountPercent,
                  clAdvance,
                  clEstimate,
                  purchase,
                  item
                });
                
                // Build a descriptive name for contact lenses
                const itemName = [
                  brand || 'Contact Lens',
                  material,
                  power,
                  side,
                  baseCurve ? `BC:${baseCurve}` : '',
                  diameter ? `DIA:${diameter}` : ''
                ]
                  .filter(Boolean)
                  .join(' ');
                populatedItems.push({
                  id: `cl_${purchase.id}_${item.id || itemCount}_${item.id}`,
                  selected: true,
                  itemCode: `CL-${item.id}`,
                  itemName: itemName,
                  orderNo: purchase.referenceNo || purchase.order_no || `CL-${purchase.id}`,
                  rate: getNormalizedNumber(rate),
                  taxPercent: getNormalizedNumber(taxPercent),
                  quantity: getNormalizedNumber(quantity),
                  amount: getNormalizedNumber(amount),
                  // Use payment discount/advance/estimate if available, else fallback to item
                  discount: getNormalizedNumber(clDiscount),
                  discountPercent: getNormalizedNumber(clDiscountPercent),
                  advance: getNormalizedNumber(clAdvance),
                  estimate: getNormalizedNumber(clEstimate),
                  payment: parentPayment || {},
                });
                itemCount++;
              }
            } 
            // Handle prescription items
            else if (purchase.type === 'prescription' || purchase.sourceType === 'prescription') {
              const identifier = purchase.prescription_no || purchase.referenceNo || `RX-${purchase.id}`;
              const amount = purchase.amount || purchase.total_amount || 0;
              const discountAmount = purchase.discount_amount || 0;
              const discountPercent = purchase.discount_percent || 0;
              const prescriptionType = purchase.prescription_type || 'Eye Examination';
              
              // Include all prescription details in the item name
              const itemName = [
                prescriptionType,
                purchase.vision_type ? `(${purchase.vision_type})` : ''
              ].filter(Boolean).join(' ').trim();
              
              populatedItems.push({
                id: `rx_${purchase.id}`,
                selected: true,
                itemCode: identifier,
                itemName: itemName,
                orderNo: identifier,
                rate: getNormalizedNumber(amount),
                taxPercent: getNormalizedNumber(0),
                quantity: getNormalizedNumber(1),
                amount: getNormalizedNumber(amount),
                discount: getNormalizedNumber(discountAmount),
                discountPercent: getNormalizedNumber(discountPercent),
                _originalPurchase: {
                  ...purchase,
                  // Include all relevant prescription details
                  prescription_type: prescriptionType,
                  vision_type: purchase.vision_type,
                  // Ensure we have all financial fields
                  amount: amount,
                  discount_amount: discountAmount,
                  discount_percent: discountPercent
                }
              });
              itemCount++;
            }
          }
          
          // No need to fill empty rows, just use the populated items
          
          logDebug('Final billing items to set:', populatedItems);
          setBillingItems(populatedItems);
        } catch (error) {
          logError('Error populating billing items:', error);
          // Return empty array if there's an error
          setBillingItems([]);
        }
      }
    } catch (error) {
      logError('Error handling customer selection:', error);
    } finally {
      setIsLoadingCustomer(false);
    }
  };
  
  // Payment details
  const [estimate, setEstimate] = useState('0.00');
  const [schDisc, setSchDisc] = useState('0.00');
  const [payment, setPayment] = useState('0.00');
  const [tax, setTax] = useState('0.00');
  const [advance, setAdvance] = useState('0.00');
  const [balance, setBalance] = useState('0.00');
  const [cash, setCash] = useState('0.00');
  const [ccUpiAdv, setCcUpiAdv] = useState('0.00');
  const [ccUpiType, setCcUpiType] = useState('');
  const [cheque, setCheque] = useState('0.00');
  
  // Billing table state (initialized in useEffect above)
  const [discountToApply, setDiscountToApply] = useState('');
  
  // Track if user has manually changed advance
  const [advanceManuallySet, setAdvanceManuallySet] = useState(false);
  
  const jobTypes = ['OrderCard', 'Contact lens', 'Repairing', 'Others'];
  const namePrefixOptions = ['Mr.', 'Mrs.', 'Ms.'];
  
  // Handle checkbox selection change
  const handleSelectionChange = (id: string) => {
    setBillingItems(prevItems => 
      prevItems.map(item => 
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  // Calculate item amount, tax, and discount
  const calculateItemAmount = (item: BillingItem) => {
    const quantity = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const taxPercent = parseFloat(item.taxPercent) || 0;
    const discountPercent = parseFloat(item.discountPercent) || 0;
    
    // Calculate base amount
    const baseAmount = quantity * rate;
    
    // Calculate discount amount (can be percentage or fixed)
    let discountAmount = 0;
    if (item.discount && parseFloat(item.discount) > 0) {
      // Use fixed discount amount if provided
      discountAmount = Math.min(parseFloat(item.discount), baseAmount);
    } else if (discountPercent > 0) {
      // Calculate discount from percentage
      discountAmount = (baseAmount * discountPercent) / 100;
    }
    
    // Calculate amount after discount
    const amountAfterDiscount = Math.max(0, baseAmount - discountAmount);
    
    // Calculate tax on the discounted amount
    const taxAmount = (amountAfterDiscount * taxPercent) / 100;
    
    // Final amount including tax
    const finalAmount = amountAfterDiscount + taxAmount;
    
    return {
      amount: getNormalizedNumber(finalAmount),
      taxAmount: getNormalizedNumber(taxAmount),
      discountAmount: getNormalizedNumber(discountAmount),
      baseAmount: getNormalizedNumber(baseAmount)
    };
  };

  // Handle item field changes
  const handleItemChange = (id: string, field: string, value: string) => {
    setBillingItems(prevItems => 
      prevItems.map(item => {
        if (item.id !== id) return item;
        
        const updatedItem = { ...item, [field]: value };
        
        // Recalculate amounts when relevant fields change
        if (['quantity', 'rate', 'taxPercent', 'discountPercent', 'discount'].includes(field)) {
          const calculated = calculateItemAmount(updatedItem);
          updatedItem.amount = calculated.amount;
          
          // Update discount amount if discount percent was changed
          if (field === 'discountPercent' && !updatedItem.discount) {
            updatedItem.discount = calculated.discountAmount;
          }
        }
        
        return updatedItem;
      })
    );
  };
  
  // Handle payment field changes
  const handlePaymentChange = (field: string, value: string) => {
    // Ensure the value is a valid number or empty string
    const parsedValue = value === '' ? 0 : (isNaN(parseFloat(value)) ? 0 : parseFloat(value));
    const numValue = getNormalizedNumber(parsedValue);
    
    switch (field) {
      case 'payment':
        setPayment(numValue);
        break;
      case 'advance':
        setAdvance(numValue);
        break;
      case 'cash':
        setCash(numValue);
        break;
      case 'ccUpiAdv':
        setCcUpiAdv(numValue);
        break;
      case 'cheque':
        setCheque(numValue);
        break;
      default:
        break;
    }
  };

  // Delete selected items
  const handleDeleteSelected = () => {
    const hasSelectedItems = billingItems.some(item => item.selected);
    
    if (hasSelectedItems) {
      setBillingItems(prevItems => {
        const remainingItems = prevItems.filter(item => !item.selected);
        return remainingItems;
      });
    }
  };

  // Add new empty row
  const handleAddRow = () => {
    const newItem = {
      id: Date.now().toString(),
      selected: true,
      itemCode: '',
      itemName: '',
      orderNo: '',
      rate: getNormalizedNumber(0),
      taxPercent: getNormalizedNumber(0),
      quantity: getNormalizedNumber(1),
      amount: getNormalizedNumber(0),
      discount: getNormalizedNumber(0),
      discountPercent: getNormalizedNumber(0),
      _originalPurchase: null
    };
    
    // If there are no items, just add one empty row
    if (billingItems.length === 0) {
      setBillingItems([newItem]);
    } else {
      // Otherwise add the new row after the last item
      setBillingItems([...billingItems, newItem]);
    }
  };

  // Apply same discount percentage to all items
  const handleApplyDiscount = () => {
    if (!discountToApply) return;
    
    setBillingItems(prevItems => 
      prevItems.map(item => {
        const discountAmount = item.amount ? 
          (parseFloat(item.amount) * parseFloat(discountToApply) / 100) || 0 : 0;
        
        return {
          ...item,
          discountPercent: discountToApply,
          discount: getNormalizedNumber(discountAmount)
        };
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!name.trim()) {
      alert('Please enter customer name');
      return;
    }
    
    if (!referenceNo.trim()) {
      alert('Please enter reference number');
      return;
    }
    
    if (!mobile.trim()) {
      alert('Please enter mobile number');
      return;
    }
    
    // Basic mobile number validation (10 digits)
    const mobileRegex = /^\d{10}$/;
    if (!mobileRegex.test(mobile.trim())) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }
    
    logDebug('Form submitted with valid data');
    // Proceed with form submission
  };

  const handleClear = () => {
    setCashMemo('B1920-030');
    setReferenceNo('B1920-030');
    setJobType('');
    setBookingBy('');
    setItemName('');
    setPrescBy('');
    setNamePrefix('Mr.');
    setName('');
    setAge('');
    setAddress('');
    setCity('');
    setState('');
    setPhone('');
    setPin('');
    setMobile('');
    setEmail('');
    setCcode('');
    setIsCash(false);
    setEstimate(getNormalizedNumber(0));
    setSchDisc(getNormalizedNumber(0));
    setPayment(getNormalizedNumber(0));
    setTax(getNormalizedNumber(0));
    setAdvance(getNormalizedNumber(0));
    setBalance(getNormalizedNumber(0));
    setCash(getNormalizedNumber(0));
    setCcUpiAdv(getNormalizedNumber(0));
    setCcUpiType('');
    setCheque(getNormalizedNumber(0));
  };
  
  const handleExitBill = () => {
    navigate('/');
  };

  // --- COMPREHENSIVE LOGGING ---
  console.debug('[BILLING][RENDER] BillingPage return start', { billingItemsCount: billingItems.length });

  // --- Payment Calculation ---
  let totalAdvance = 0;
  let totalEstimate = 0;
  let totalDiscount = 0;
  let totalPayment = 0;
  let totalCash = 0;
  let totalCcUpiAdv = 0;
  let totalCheque = 0;
  let totalTax = 0;
  let totalBalance = 0;

  const selectedItems = billingItems.filter(item => item.selected);
  console.debug('[BILLING][PAYMENT] Selected items for payment calculation', selectedItems);

  for (const item of selectedItems) {
    const payment = item._originalPurchase?.payment || item.payment;
    // --- Robust type handling for advance ---
    let advanceValue = 0;
    if (payment && !isNaN(Number(payment.advance)) && Number(payment.advance) > 0) {
      advanceValue = Number(payment.advance);
    } else if (payment && (
      !isNaN(Number(payment.advance_cash)) ||
      !isNaN(Number(payment.advance_card_upi)) ||
      !isNaN(Number(payment.advance_other))
    )) {
      advanceValue =
        (Number(payment.advance_cash) || 0) +
        (Number(payment.advance_card_upi) || 0) +
        (Number(payment.advance_other) || 0);
    } else if (!isNaN(Number(item.advance)) && Number(item.advance) > 0) {
      advanceValue = Number(item.advance);
    }
    // Log each item's advance value used
    console.debug('[BILLING][PAYMENT] Advance value used for item', { itemId: item.id, advanceValue, paymentAdvance: payment?.advance, itemAdvance: item.advance });
    totalAdvance += advanceValue;
    // --- Other fields, also robustly handle types ---
    totalEstimate += !isNaN(Number(payment?.estimate)) ? Number(payment.estimate) : (!isNaN(Number(item.estimate)) ? Number(item.estimate) : 0);
    totalDiscount += !isNaN(Number(payment?.discount_amount)) ? Number(payment.discount_amount) : (!isNaN(Number(item.discount)) ? Number(item.discount) : 0);
    // --- Payment: sum all paid amounts (advance, cash, card, cheque, etc.) ---
    let paid = 0;
    if (payment) {
      paid += Number(payment.advance) || 0;
      paid += Number(payment.cash_advance) || 0;
      paid += Number(payment.card_upi_advance) || 0;
      paid += Number(payment.cheque_advance) || 0;
      paid += Number(payment.advance_cash) || 0;
      paid += Number(payment.advance_card_upi) || 0;
      paid += Number(payment.advance_other) || 0;
    }
    totalPayment += paid;
    totalCash += !isNaN(Number(payment?.cash_advance)) ? Number(payment.cash_advance) : 0;
    totalCcUpiAdv += !isNaN(Number(payment?.card_upi_advance)) ? Number(payment.card_upi_advance) : 0;
    totalCheque += !isNaN(Number(payment?.cheque_advance)) ? Number(payment.cheque_advance) : 0;
    totalTax += !isNaN(Number(item.taxPercent)) ? Number(item.taxPercent) : 0;
    totalBalance += !isNaN(Number(payment?.balance)) ? Number(payment.balance) : 0;
  }

  // --- DEBUG: Log payment section values before render ---
  console.debug('[BILLING][PAYMENT] Final payment section values before render', {
    totalAdvance,
    totalEstimate,
    totalDiscount,
    totalPayment,
    totalCash,
    totalCcUpiAdv,
    totalCheque,
    totalTax,
    totalBalance
  });

  React.useEffect(() => {
    if (billingItems.length > 0) {
      console.debug('[BILLING][RENDER] Payment section JSX rendered');
    }
  }, [billingItems.length]);

  React.useEffect(() => {
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    billingItems.forEach(item => {
      const quantity = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      const taxPercent = parseFloat(item.taxPercent) || 0;
      const discount = parseFloat(item.discount) || 0;
      const baseAmount = quantity * rate;
      const taxAmount = (baseAmount * taxPercent) / 100;
      subtotal += baseAmount;
      totalTax += taxAmount;
      totalDiscount += discount;
    });

    const estimate = subtotal + totalTax;
    const subtotalAfterDiscount = Math.max(0, subtotal - totalDiscount);
    const totalAfterDiscount = subtotalAfterDiscount + totalTax;

    setEstimate(getNormalizedNumber(estimate));
    setTax(getNormalizedNumber(totalTax));
    setSchDisc(getNormalizedNumber(totalDiscount));

    const paymentAmount = parseFloat(payment) || 0;
    const advanceAmount = parseFloat(advance) || 0;
    const cashAmount = parseFloat(cash) || 0;
    const ccUpiAmount = parseFloat(ccUpiAdv) || 0;
    const chequeAmount = parseFloat(cheque) || 0;

    // Total payments including all methods
    const totalPayments = paymentAmount + advanceAmount + cashAmount + ccUpiAmount + chequeAmount;
    const balanceAmount = totalAfterDiscount - totalPayments;
    setBalance(getNormalizedNumber(Math.max(0, balanceAmount)));
  }, [billingItems, payment, advance, cash, ccUpiAdv, cheque]);

  React.useEffect(() => {
    let totalAdvance = 0;
    const selectedItems = billingItems.filter(item => item.selected);
    for (const item of selectedItems) {
      const payment = item._originalPurchase?.payment || item.payment;
      if (payment) {
        totalAdvance += Number(payment.advance) || 0;
        totalAdvance += Number(payment.advance_cash) || 0;
        totalAdvance += Number(payment.advance_card_upi) || 0;
        totalAdvance += Number(payment.advance_other) || 0;
      }
      // Also check if advance is directly on the item (for legacy/manual entries)
      if (!isNaN(Number(item.advance)) && Number(item.advance) > 0) {
        totalAdvance += Number(item.advance);
      }
    }
    if (!advanceManuallySet) {
      setAdvance(totalAdvance ? totalAdvance.toString() : '0.00');
    }
  }, [billingItems, advanceManuallySet]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-screen w-full max-w-screen-xl mx-auto p-2 sm:p-4">
      {/* Title Bar */}
      <div className="flex justify-between items-center bg-[#d5d5e1] p-1 rounded-t-md border border-gray-400">
        <div className="flex items-center">
          <img src="/favicon.ico" alt="Billing" className="w-5 h-5 mr-2" />
          <span className="font-semibold text-gray-800">Billing</span>
        </div>
        <div className="flex">
          <button type="button" className="ml-2 text-gray-600 hover:text-gray-800">
            <Minus size={14} />
          </button>
          <button type="button" className="ml-2 text-gray-600 hover:text-gray-800">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-wrap items-center bg-[#f0f0f5] p-1 border-x border-b border-gray-400 text-xs sm:text-sm">
        <button type="button" className="flex items-center text-blue-700 mr-2 px-1 mb-1 sm:mb-0">&lt;&lt; First</button>
        <button type="button" className="flex items-center text-blue-700 mr-2 px-1 mb-1 sm:mb-0">&lt; Prev</button>
        <button type="button" className="flex items-center text-blue-700 mr-2 px-1 mb-1 sm:mb-0">Next &gt;</button>
        <button type="button" className="flex items-center text-blue-700 px-1 mb-1 sm:mb-0">Last &gt;&gt;</button>
        <span className="ml-auto font-medium text-gray-700">Personal Information</span>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row w-full">
        <div className="w-full bg-white border-x border-gray-400 overflow-auto flex-1 flex flex-col">
          {/* Top Section */}
          <div className="flex flex-col lg:flex-row p-2 sm:p-3 border-b border-gray-300 gap-4">
            {/* Left Side */}
            <div className="w-full lg:w-1/2 lg:pr-3">
              <div className="flex flex-col sm:flex-row mb-3 gap-2">
                <div className="w-full sm:w-1/2 sm:pr-2">
                  <label className="block text-sm mb-1">Cash Memo</label>
                  <input type="text" className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none" value={cashMemo} onChange={(e) => setCashMemo(e.target.value)} />
                </div>
                <div className="w-full sm:w-1/2 sm:pl-2 mt-2 sm:mt-0">
                  <label className="block text-sm mb-1">Reference No.</label>
                  <input type="text" className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
                </div>
              </div>
              <div className="text-gray-700 font-medium mb-2">Bill Details</div>
              <div className="flex flex-col sm:flex-row mb-2 gap-2">
                <div className="w-full sm:w-1/2 sm:pr-2">
                    <label className="block text-sm mb-1">Item Name</label>
                  <select className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none" value={itemName} onChange={(e) => setItemName(e.target.value)}>
                      <option value="">Select</option>
                      <option value="Frames">Frames</option>
                      <option value="Lenses">Lenses</option>
                      <option value="Contact Lenses">Contact Lenses</option>
                    </select>
                  </div>
                <div className="w-full sm:w-1/2 sm:pl-2 mt-2 sm:mt-0">
                    <label className="block text-sm mb-1">Presc. By <span className="text-red-500">*</span></label>
                  <select className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none" value={prescBy} onChange={(e) => setPrescBy(e.target.value)}>
                      <option value="">Select</option>
                      <option value="Dr. Smith">Dr. Smith</option>
                      <option value="Dr. Johnson">Dr. Johnson</option>
                    </select>
                  </div>
                </div>
              </div>
            {/* Right Side - Personal Information */}
            <div className="w-full lg:w-1/2 lg:pl-3">
              <div className="mb-3">
                {/* Customer Search Section */}
                <div className="p-2 bg-white border border-gray-300">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Customer Search</h3>
                  <CustomerSearch onSelectCustomer={handleCustomerSelect} />
                  {isLoadingCustomer && (<div className="text-sm text-gray-500 mt-2">Loading customer data...</div>)}
                  {customerPurchaseHistory.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-medium text-gray-700 mb-1">Recent Purchases:</h4>
                      <div className="max-h-32 overflow-y-auto border rounded text-xs">
                        <table className="min-w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ref No</th>
                              <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {customerPurchaseHistory.slice(0, 5).map((purchase, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-900">
                                  {new Date(purchase.date).toLocaleDateString()}
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-500 capitalize">
                                  {purchase.type}
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-500">
                                  {purchase.prescription_no || purchase.order_no || 'N/A'}
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-900 text-right">
                                  {purchase.total_amount ? `₹${Number(purchase.total_amount).toFixed(2)}` : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
                    </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="w-full sm:w-1/6">
                    <label className="block text-sm mb-1">Name<span className="text-red-500">*</span></label>
                    <select className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none" value={namePrefix} onChange={(e) => setNamePrefix(e.target.value)}>
                      {namePrefixOptions.map((prefix, index) => (<option key={index} value={prefix}>{prefix}</option>))}
                    </select>
                  </div>
                  <div className="w-full sm:w-4/6 sm:pl-2">
                    <label className="block text-sm mb-1 opacity-0">.</label>
                    <input type="text" className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="w-full sm:w-1/6 sm:pl-2">
                    <label className="block text-sm mb-1">Age</label>
                    <input type="text" className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none" value={age} onChange={(e) => setAge(e.target.value)} />
                  </div>
                </div>
                <div>
                <label className="block text-sm mb-1">Address</label>
                  <input type="text" className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="w-full sm:w-3/4">
                  <label className="block text-sm mb-1">City</label>
                    <input type="text" className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                  <div className="w-full sm:w-1/4">
                  <label className="block text-sm mb-1">State</label>
                    <input type="text" className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none" value={state} onChange={(e) => setState(e.target.value)} />
                </div>
              </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="w-full sm:w-3/4">
                  <label className="block text-sm mb-1">Phone (L.L.)</label>
                    <input type="text" className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                  <div className="w-full sm:w-1/4">
                  <label className="block text-sm mb-1">Pin</label>
                    <input type="text" className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none" value={pin} onChange={(e) => setPin(e.target.value)} />
                </div>
              </div>
                <div>
                <label className="block text-sm mb-1">Mobile<span className="text-red-500">*</span></label>
                  <input type="text" className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none" value={mobile} onChange={(e) => setMobile(e.target.value)} />
              </div>
                <div>
                <label className="block text-sm mb-1">Email</label>
                  <input type="email" className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
                <div className="flex flex-col sm:flex-row gap-2 items-center">
                  <div className="w-full sm:w-2/3">
                  <label className="block text-sm mb-1">CCode</label>
                    <input type="text" className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none" value={ccode} onChange={(e) => setCcode(e.target.value)} />
                </div>
                  <div className="w-full sm:w-1/3 flex items-center pt-2 sm:pt-5">
                    <input type="checkbox" id="cash" className="h-4 w-4 text-blue-600 border-gray-300" checked={isCash} onChange={(e) => setIsCash(e.target.checked)} />
                  <label htmlFor="cash" className="ml-2 text-sm text-gray-700">Cash</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Table Section */}
          <div className="mb-4 overflow-x-auto border-b border-gray-300 pb-2">
            <div className="flex flex-col sm:flex-row mb-2 justify-between gap-2">
              <button type="button" className="px-2 py-1 bg-red-100 text-red-700 border border-red-300 text-xs rounded hover:bg-red-200 flex items-center mb-1 sm:mb-0" onClick={handleDeleteSelected}><Trash2 size={14} className="mr-1" /> Delete Selected</button>
              <button type="button" className="px-2 py-1 bg-blue-100 text-blue-700 border border-blue-300 text-xs rounded hover:bg-blue-200 mb-1 sm:mb-0" onClick={handleAddRow}>+ Add Row</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[700px] md:min-w-[900px] lg:min-w-0 w-full border border-gray-300 border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700">Sel</th>
                  <th className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700">Item Code</th>
                  <th className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700">Rate Rs.</th>
                  <th className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700">Tax %</th>
                  <th className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700">Qty</th>
                  <th className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700">Amount</th>
                  <th className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700">Item Name</th>
                  <th className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700">Order No.</th>
                  <th className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700">Discount</th>
                  <th className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700">Discount %</th>
                </tr>
              </thead>
              <tbody>
                {billingItems.map(item => (
                  <tr key={item.id}>
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      <input 
                        type="checkbox" 
                        checked={item.selected} 
                        onChange={() => handleSelectionChange(item.id)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <input 
                        type="text" 
                        value={item.itemCode} 
                        onChange={(e) => handleItemChange(item.id, 'itemCode', e.target.value)}
                        className="w-full px-1 py-1 border-0 focus:ring-0 focus:outline-none"
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <input 
                        type="text" 
                        value={parseFloat(item.rate).toFixed(2)} 
                        onChange={(e) => {
                          // Allow only numbers and one decimal point
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = value.split('.');
                          if (parts.length <= 2) { // Only allow one decimal point
                            handleItemChange(item.id, 'rate', value);
                          }
                        }}
                        onBlur={(e) => {
                          // Format to 2 decimal places on blur
                          const numValue = parseFloat(e.target.value) || 0;
                          handleItemChange(item.id, 'rate', numValue.toFixed(2));
                        }}
                        className="w-full px-1 py-1 border-0 focus:ring-0 focus:outline-none text-right"
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <input 
                        type="text" 
                        value={parseFloat(item.taxPercent).toFixed(2)} 
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = value.split('.');
                          if (parts.length <= 2) {
                            handleItemChange(item.id, 'taxPercent', value);
                          }
                        }}
                        onBlur={(e) => {
                          const numValue = parseFloat(e.target.value) || 0;
                          handleItemChange(item.id, 'taxPercent', numValue.toFixed(2));
                        }}
                        className="w-full px-1 py-1 border-0 focus:ring-0 focus:outline-none text-right"
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <input 
                        type="text" 
                        value={parseFloat(item.quantity).toFixed(2)} 
                        onChange={(e) => {
                          // Allow only numbers and one decimal point
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = value.split('.');
                          if (parts.length <= 2) { // Only allow one decimal point
                            handleItemChange(item.id, 'quantity', value);
                          }
                        }}
                        onBlur={(e) => {
                          // Format to 2 decimal places on blur
                          const numValue = parseFloat(e.target.value) || 0;
                          handleItemChange(item.id, 'quantity', numValue.toFixed(2));
                        }}
                        className="w-full px-1 py-1 border-0 focus:ring-0 focus:outline-none text-right"
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <input 
                        type="text" 
                        value={parseFloat(item.amount).toFixed(2)} 
                        className="w-full px-1 py-1 border-0 focus:ring-0 focus:outline-none text-right bg-gray-50"
                        readOnly
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <input 
                        type="text" 
                        value={item.itemName} 
                        onChange={(e) => handleItemChange(item.id, 'itemName', e.target.value)}
                        className="w-full px-1 py-1 border-0 focus:ring-0 focus:outline-none"
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <input 
                        type="text" 
                        value={item.orderNo} 
                        onChange={(e) => handleItemChange(item.id, 'orderNo', e.target.value)}
                        className="w-full px-1 py-1 border-0 focus:ring-0 focus:outline-none"
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <input 
                        type="text" 
                        value={parseFloat(item.discount).toFixed(2)} 
                        onChange={(e) => {
                          // Allow only numbers and one decimal point
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = value.split('.');
                          if (parts.length <= 2) { // Only allow one decimal point
                            handleItemChange(item.id, 'discount', value);
                          }
                        }}
                        onBlur={(e) => {
                          // Format to 2 decimal places on blur
                          const numValue = parseFloat(e.target.value) || 0;
                          handleItemChange(item.id, 'discount', numValue.toFixed(2));
                        }}
                        className="w-full px-1 py-1 border-0 focus:ring-0 focus:outline-none text-right"
                      />
                    </td>
                    <td className="border border-gray-300 px-0 py-0">
                      <input 
                        type="text" 
                        value={parseFloat(item.discountPercent).toFixed(2)} 
                        onChange={(e) => {
                          // Allow only numbers and one decimal point
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = value.split('.');
                          if (parts.length <= 2) { // Only allow one decimal point
                            handleItemChange(item.id, 'discountPercent', value);
                          }
                        }}
                        onBlur={(e) => {
                          // Format to 2 decimal places on blur
                          const numValue = parseFloat(e.target.value) || 0;
                          handleItemChange(item.id, 'discountPercent', numValue.toFixed(2));
                        }}
                        className="w-full px-1 py-1 border-0 focus:ring-0 focus:outline-none text-right"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="flex flex-col sm:flex-row justify-end mt-2 items-center gap-2">
              <span className="text-sm mr-2">Apply same discount % to all items above:</span>
              <input type="text" value={discountToApply} onChange={(e) => setDiscountToApply(e.target.value)} className="px-2 py-1 border border-gray-300 w-16 text-right mr-2" />
              <button type="button" className="px-2 py-1 bg-blue-100 text-blue-700 border border-blue-300 text-xs rounded hover:bg-blue-200" onClick={handleApplyDiscount}>Apply Disc</button>
            </div>
          </div>
          
          {/* Payment Section */}
          {billingItems.length > 0 && (
            <div className="mb-4 px-1 sm:px-3 pt-2 border-b border-gray-300 pb-2">
              <div className="font-medium text-gray-700 mb-2">Payment</div>
              <div className="flex flex-col md:flex-row gap-2">
                <div className="w-full md:w-1/6 md:pr-1">
                  <label className="block text-xs mb-1">Estimate</label>
                  <input type="text" className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none text-right" value={estimate} readOnly placeholder="0.00" />
                </div>
                <div className="w-full md:w-1/6 md:px-1">
                  <label className="block text-xs mb-1">*Sch. Disc.</label>
                  <input type="text" className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none text-right" value={schDisc} onChange={(e) => setSchDisc(e.target.value)} placeholder="0.00" />
                  <span className="text-xs text-gray-500">(Rs.)</span>
                </div>
                <div className="w-full md:w-1/6 md:px-1">
                  <label className="block text-xs mb-1">Payment</label>
                  <input type="text" className="w-full px-2 py-1 border border-gray-300 rounded-none text-right" value={payment} onChange={e => setPayment(e.target.value)} placeholder="0.00" />
                </div>
                <div className="w-full md:w-1/6 md:px-1">
                  <label className="block text-xs mb-1">Tax Rs.</label>
                  <input type="text" className="w-full px-2 py-1 border border-gray-300 rounded-none text-right bg-[#e8e7fa]" value={tax} readOnly placeholder="0.00" />
                </div>
                <div className="w-full md:w-1/6 md:px-1">
                  <label className="block text-xs mb-1">Adv.</label>
                  <input type="text" className="w-full px-2 py-1 border border-gray-300 rounded-none text-right" value={advance} onChange={e => { setAdvance(e.target.value); setAdvanceManuallySet(true); }} placeholder="0.00" />
                </div>
                <div className="w-full md:w-1/6 md:pl-1">
                  <label className="block text-xs mb-1">Balance</label>
                  <input type="text" className="w-full px-2 py-1 border border-gray-300 bg-[#e8e7fa] rounded-none text-right" value={balance} readOnly placeholder="0.00" />
                </div>
              </div>
              <div className="flex flex-col md:flex-row mt-2 gap-2">
                <div className="w-full md:w-1/3 md:pr-2">
                  <label className="block text-xs mb-1">Cash</label>
                  <input type="text" className="w-full px-2 py-1 border border-gray-300 rounded-none text-right" value={cash} onChange={(e) => handlePaymentChange('cash', e.target.value)} placeholder="0.00" />
                </div>
                <div className="w-full md:w-1/3 md:px-2">
                  <label className="block text-xs mb-1">CC/UPI Adv.</label>
                  <div className="flex gap-2">
                    <select className="w-1/2 px-2 py-1 border border-gray-300 rounded-none" value={ccUpiType} onChange={(e) => setCcUpiType(e.target.value)}>
                      <option value="">Type</option>
                      <option value="VISA">VISA</option>
                      <option value="MasterCard">MasterCard</option>
                      <option value="UPI">UPI</option>
                      <option value="Other">Other</option>
                    </select>
                    <input type="text" className="w-1/2 px-2 py-1 border border-gray-300 rounded-none text-right" value={ccUpiAdv} onChange={(e) => handlePaymentChange('ccUpiAdv', e.target.value)} placeholder="0.00" />
                  </div>
                </div>
                <div className="w-full md:w-1/3 md:pl-2">
                  <label className="block text-xs mb-1">Cheque</label>
                  <input type="text" className="w-full px-2 py-1 border border-gray-300 rounded-none text-right" value={cheque} onChange={(e) => handlePaymentChange('cheque', e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="text-right mt-1">
                <span className="text-blue-700 font-semibold text-sm">*SCHEME DISCOUNT (IF ANY)</span>
              </div>
            </div>
          )}
          
          {/* Bottom Buttons */}
          <div className="flex flex-col sm:flex-row flex-wrap justify-between gap-2 px-1 sm:px-3 pb-3 mt-2">
            <button type="button" className="px-3 py-1 bg-[#dcf8fa] text-blue-700 border border-blue-300 text-sm hover:bg-blue-100 w-full sm:w-auto">&lt;&lt; Add Bill &gt;&gt;</button>
            <button type="button" className="px-3 py-1 bg-[#dcf8fa] text-blue-700 border border-blue-300 text-sm hover:bg-blue-100 w-full sm:w-auto">&lt;&lt; Edit/Search Bill &gt;&gt;</button>
            <button type="button" className="px-3 py-1 bg-[#dcf8fa] text-blue-700 border border-blue-300 text-sm hover:bg-blue-100 w-full sm:w-auto">&lt;&lt; Email Invoice To Cust &gt;&gt;</button>
            <button type="button" className="px-3 py-1 bg-[#dcf8fa] text-blue-700 border border-blue-300 text-sm hover:bg-blue-100 w-full sm:w-auto">&lt;&lt; Print Bill &gt;&gt;</button>
            <button type="button" className="px-3 py-1 bg-[#dcf8fa] text-blue-700 border border-blue-300 text-sm hover:bg-blue-100 w-full sm:w-auto" onClick={handleClear}>&lt;&lt; Clear Bill &gt;&gt;</button>
            <button type="button" className="px-3 py-1 bg-[#dcf8fa] text-blue-700 border border-blue-300 text-sm hover:bg-blue-100 w-full sm:w-auto" onClick={handleExitBill}>&lt;&lt; Exit Bill &gt;&gt;</button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default BillingPage;
