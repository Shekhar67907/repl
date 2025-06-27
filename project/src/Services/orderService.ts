// src/Services/orderService.ts
import { supabase } from './supabaseService';
import { logInfo, logError, logDebug, logWarn, logDev } from '../utils/logger';

// Types for order data
interface OrderItem {
  si: number;
  itemType: string;
  itemCode: string;
  itemName: string;
  rate: number;
  qty: number;
  amount: number;
  taxPercent: number;
  discountPercent: number;
  discountAmount: number;
  brandName?: string;
  index?: string;
  coating?: string;
}

interface OrderPayment {
  paymentEstimate: number;
  taxAmount: number;
  discountAmount: number;
  finalAmount: number;
  advanceCash: number;
  advanceCardUpi: number;
  advanceOther: number;
  scheduleAmount: number;
}

interface OrderData {
  prescriptionId: string;
  orderNo: string;
  billNo?: string;
  orderDate: string;
  deliveryDate?: string;
  status: string;
  remarks?: string;
  bookingBy?: string;
  items: OrderItem[];
  payment: OrderPayment;
}

// Generate a unique order number with prefix ORD-YYYYMMDD-XXX
const generateOrderNo = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `ORD-${year}${month}${day}-${random}`;
};

// Generate a unique bill number with prefix BILL-YYYYMMDD-XXX
const generateBillNo = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `BILL-${year}${month}${day}-${random}`;
};

// Save order with items and payment details to Supabase
export const saveOrder = async (orderData: OrderData): Promise<{ success: boolean; message: string; orderId?: string }> => {
  try {
    logInfo('====================== SAVE ORDER DEBUG START ======================');
    logInfo('Saving order data:', JSON.stringify(orderData, null, 2));
    logInfo('Connection info:', {
      functions: Object.keys(supabase).join(', ')
    });
    
    // Check if the tables exist in the database
    logInfo('Checking database schema for order tables...');
    try {
      const { data: schemaData, error: schemaError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', ['orders', 'order_items', 'order_payments']);
        
      logInfo('Schema check result:', {
        success: !schemaError, 
        tables: schemaData ? schemaData.map(t => t.table_name).join(', ') : 'No tables found',
        error: schemaError ? schemaError.message : null
      });
      
      // If no tables were found, let's explain why this might be happening
      if (!schemaData || schemaData.length === 0) {
        logWarn('⚠️ ORDER TABLES NOT FOUND IN DATABASE ⚠️');
        logWarn('Possible causes:');
        logWarn('1. The tables were added to schema.sql but not executed in the database');
        logWarn('2. The schema.sql changes were not saved or committed');
        logWarn('3. The tables have different names than expected');
        logWarn('4. There might be permission issues');
      }
    } catch (schemaCheckErr) {
      logError('Schema check failed:', schemaCheckErr);
    }
    
    // Test connection first
    logInfo('Testing database connection...');
    try {
      const { data: testData, error: testError } = await supabase
        .from('prescriptions')
        .select('id')
        .limit(1);
        
      logInfo('Database connection test:', { success: !testError, error: testError?.message, data: testData });
    } catch (testErr) {
      logError('Connection test failed:', testErr);
    }
    
    // Check if tables exist
    logInfo('Checking if tables exist...');
    try {
      const { data: orderTableInfo, error: tableError } = await supabase
        .from('orders')
        .select('id')
        .limit(1);
        
      logInfo('Order table check:', { exists: !tableError, error: tableError ? tableError.message : null });
    } catch (tableErr) {
      logError('Table check failed:', tableErr);
    }
    
    // Let's check if the prescription actually exists first
    logInfo(`Verifying prescription ID exists: ${orderData.prescriptionId}`);
    try {
      const { data: prescriptionCheck, error: prescriptionCheckError } = await supabase
        .from('prescriptions')
        .select('id')
        .eq('id', orderData.prescriptionId);
        
      if (prescriptionCheckError || !prescriptionCheck || prescriptionCheck.length === 0) {
        logError('⚠️ Prescription ID verification failed:', {
          error: prescriptionCheckError?.message,
          prescriptionFound: prescriptionCheck && prescriptionCheck.length > 0
        });
      } else {
        logInfo('✅ Prescription ID verified:', prescriptionCheck[0].id);
      }
    } catch (prescCheckErr) {
      logError('Prescription check error:', prescCheckErr);
    }
    
    // Prevent duplicate orders with the same order_no
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('order_no', orderData.orderNo)
      .single();

    if (existingOrder) {
      return { success: false, message: 'Order already exists with this order number.' };
    }
    
    // Create order with explicit debug info
    logInfo('Attempting to create order record...');
    const orderInsertData = {
      prescription_id: orderData.prescriptionId,
      order_no: orderData.orderNo,
      bill_no: orderData.billNo,
      order_date: orderData.orderDate,
      delivery_date: orderData.deliveryDate,
      status: orderData.status,
      remarks: orderData.remarks,
      booking_by: orderData.bookingBy
    };
    
    logInfo('Order insert data:', orderInsertData);
    logInfo('Order insert data (JSON):', JSON.stringify(orderInsertData, null, 2));
    logInfo('Order insert data (stringified):', JSON.stringify(orderInsertData));
    
    // Try to insert with explicit error handling
    let order = null;
    let orderError = null;
    
    try {
      const result = await supabase
        .from('orders')
        .insert({
        prescription_id: orderData.prescriptionId,
        order_no: orderData.orderNo || generateOrderNo(),
        bill_no: orderData.billNo || generateBillNo(),
        order_date: orderData.orderDate,
        delivery_date: orderData.deliveryDate,
        status: orderData.status,
        remarks: orderData.remarks,
        booking_by: orderData.bookingBy
      })
      .select()
      .single();
      
      order = result.data;
      orderError = result.error;
      
      // Check the raw response for more detailed debug info
      logInfo('Raw order insert response:', result);
    } catch (insertErr) {
      logError('❌ Order insert exception:', insertErr);
      orderError = { message: `Exception during insert: ${insertErr instanceof Error ? insertErr.message : 'Unknown error'}` };
    }
    
    if (orderError) {
      logError('Error saving order:', orderError);
      return { success: false, message: `Error saving order: ${orderError.message}` };
    }
    
    logInfo('Order saved successfully:', order);
    const orderId = order.id;
    
    logInfo('Order created successfully:', order);
    logInfo('Creating order items...');
    
    // Create order items, mapping carefully to schema fields
    const orderItems = orderData.items.map(item => {
      // Create a clean object with exact column names
      const mappedItem = {
        order_id: orderId,
        si: item.si,
        item_type: item.itemType,
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
      
      // Log each item for debugging
      logInfo(`Mapped order item ${item.si}:`, mappedItem);
      
      return mappedItem;
    });
    
    // Prevent duplicate order items (same order_id + item_code)
    const { data: existingItems, error: existingItemsError } = await supabase
      .from('order_items')
      .select('item_code')
      .eq('order_id', orderId);

    const existingItemCodes = new Set((existingItems || []).map(item => item.item_code));
    const newItems = orderItems.filter(item => !existingItemCodes.has(item.item_code));
      
    if (newItems.length === 0) {
      logInfo('No new order items to insert (all would be duplicates).');
    } else {
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(newItems);
    logInfo('Order items insertion result:', { success: !itemsError, error: itemsError ? itemsError.message : null });
    if (itemsError) {
      logError('Error saving order items:', itemsError);
      // Consider rolling back the order if items can't be saved
      await supabase.from('orders').delete().eq('id', orderId);
      return { success: false, message: `Error saving order items: ${itemsError.message}` };
      }
    }
    
    // Create order payment with careful field mapping
    logInfo('Creating order payment...');
    const paymentData = {
      order_id: orderId,
      payment_estimate: typeof orderData.payment.paymentEstimate === 'string' ? 
        parseFloat(orderData.payment.paymentEstimate) : 
        orderData.payment.paymentEstimate,
      tax_amount: typeof orderData.payment.taxAmount === 'string' ? 
        parseFloat(orderData.payment.taxAmount) : 
        orderData.payment.taxAmount,
      discount_amount: typeof orderData.payment.discountAmount === 'string' ? 
        parseFloat(orderData.payment.discountAmount) : 
        orderData.payment.discountAmount,
      final_amount: typeof orderData.payment.finalAmount === 'string' ? 
        parseFloat(orderData.payment.finalAmount) : 
        orderData.payment.finalAmount,
      advance_cash: typeof orderData.payment.advanceCash === 'string' ? 
        parseFloat(orderData.payment.advanceCash) : 
        orderData.payment.advanceCash,
      advance_card_upi: typeof orderData.payment.advanceCardUpi === 'string' ? 
        parseFloat(orderData.payment.advanceCardUpi) : 
        orderData.payment.advanceCardUpi,
      advance_other: typeof orderData.payment.advanceOther === 'string' ? 
        parseFloat(orderData.payment.advanceOther) : 
        orderData.payment.advanceOther,
      schedule_amount: typeof orderData.payment.scheduleAmount === 'string' ? 
        parseFloat(orderData.payment.scheduleAmount) : 
        orderData.payment.scheduleAmount
    };
    
    logInfo('Payment data:', paymentData);
    const { error: paymentError } = await supabase
      .from('order_payments')
      .insert({
        order_id: orderId,
        payment_estimate: orderData.payment.paymentEstimate,
        tax_amount: orderData.payment.taxAmount,
        discount_amount: orderData.payment.discountAmount,
        final_amount: orderData.payment.finalAmount,
        advance_cash: orderData.payment.advanceCash,
        advance_card_upi: orderData.payment.advanceCardUpi,
        advance_other: orderData.payment.advanceOther,
        schedule_amount: orderData.payment.scheduleAmount
      });
    
    if (paymentError) {
      logError('Error saving order payment:', paymentError);
      // Consider rolling back the order and items if payment can't be saved
      await supabase.from('order_items').delete().eq('order_id', orderId);
      await supabase.from('orders').delete().eq('id', orderId);
      return { success: false, message: `Error saving order payment: ${(paymentError as any).message}` };
    }
    
    logInfo('Payment insertion result:', { success: !paymentError, error: paymentError ? (paymentError as any).message : null });
    logInfo('====================== SAVE ORDER DEBUG END ======================');
    
    return { 
      success: true, 
      message: 'Order saved successfully', 
      orderId 
    };
  } catch (error) {
    logError('====================== SAVE ORDER ERROR ======================');
    logError('Unexpected error saving order:', error);
    return { 
      success: false, 
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};

// Get all orders for a prescription
export const getOrdersByPrescriptionId = async (prescriptionId: string) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(*),
        order_payments(*)
      `)
      .eq('prescription_id', prescriptionId)
      .order('created_at', { ascending: false });
    
    if (error) {
      logError('Error fetching orders:', error);
      return { success: false, message: error.message, data: null };
    }

    logInfo('Orders found:', data);
    return { 
      success: true, 
      message: 'Orders fetched successfully', 
      data 
    };
  } catch (error) {
    logError('Unexpected error fetching orders:', error);
    return { 
      success: false, 
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null
    };
  }
};

// Get order by ID with all related items and payment details
export const getOrderById = async (orderId: string) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(*),
        order_payments(*)
      `)
      .eq('id', orderId)
      .single();
    
    if (error) {
      logError('Error fetching order:', error);
      return { success: false, message: error.message, data: null };
    }

    logInfo('Order found:', data);
    return { 
      success: true, 
      message: 'Order fetched successfully', 
      data 
    };
  } catch (error) {
    logError('Unexpected error fetching order:', error);
    return { 
      success: false, 
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null
    };
  }
};

// Check if a prescription or reference number already exists in the database
const checkNumberExists = async (type: 'prescription' | 'reference', number: string): Promise<boolean> => {
  if (!number) return false;
  
  try {
    const { data, error } = await supabase
      .from('prescriptions')
      .select('id')
      .eq(type === 'prescription' ? 'prescription_no' : 'reference_no', number)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    logError(`Error checking ${type} number:`, error);
    throw error;
  }
};

// Generate a unique prescription number with retry mechanism
const generateUniquePrescriptionNumber = async (maxRetries = 3): Promise<string> => {
  const now = new Date();
  const year = now.getFullYear().toString().substring(2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Generate a random 4-digit number
    const random = Math.floor(1000 + Math.random() * 9000);
    const prescriptionNo = `P${year}${month}-${day}${random}`;
    
    try {
      const exists = await checkNumberExists('prescription', prescriptionNo);
      if (!exists) {
        return prescriptionNo;
      }
    } catch (error) {
      logError(`Attempt ${attempt}: Error generating prescription number:`, error);
      if (attempt === maxRetries) throw error;
    }
  }
  
  // Fallback to timestamp if all retries fail
  return `P${now.getTime().toString().slice(-10)}`;
};

// Navigation methods for orders using created_at for First/Last
const getFirstOrder = async () => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const orderId = data[0].id;
    const result = await getOrderById(orderId);
    return result.success ? result.data : null;
  } catch (error) {
    logError('[getFirstOrder] Error:', error);
    return null;
  }
};

const getLastOrder = async () => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const orderId = data[0].id;
    const result = await getOrderById(orderId);
    return result.success ? result.data : null;
  } catch (error) {
    logError('[getLastOrder] Error:', error);
    return null;
  }
};

const getPrevOrder = async (currentUpdatedAt: string) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id, updated_at')
      .lt('updated_at', currentUpdatedAt)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const orderId = data[0].id;
    const result = await getOrderById(orderId);
    return result.success ? result.data : null;
  } catch (error) {
    logError('[getPrevOrder] Error:', error);
    return null;
  }
};

const getNextOrder = async (currentUpdatedAt: string) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id, updated_at')
      .gt('updated_at', currentUpdatedAt)
      .order('updated_at', { ascending: true })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const orderId = data[0].id;
    const result = await getOrderById(orderId);
    return result.success ? result.data : null;
  } catch (error) {
    logError('[getNextOrder] Error:', error);
    return null;
  }
};

export const orderService = {
  saveOrder,
  getOrdersByPrescriptionId,
  getOrderById,
  checkNumberExists,
  generateUniquePrescriptionNumber,
  generateOrderNo,
  generateBillNo,
  getFirstOrder,
  getLastOrder,
  getPrevOrder,
  getNextOrder
};
