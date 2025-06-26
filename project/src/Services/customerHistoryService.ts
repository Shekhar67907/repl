import { supabase } from './supabaseService';
import type { DeletedItem, CustomerHistory } from '../components/CustomerHistory/types';
import { logInfo, logError, logDebug, logWarn, logDev } from '../utils/logger';

// Service-specific interfaces for data manipulation
export interface ServiceDeletedItem {
  // Required fields
  id: string;
  order_id: string;
  product_type: string;
  product_name: string;
  price: number;
  quantity: number;
  deleted_at: string;
  
  // Optional fields
  product_id?: string;
  deleted_by?: string;
  original_data?: any;
  
  // Additional fields for UI/Service use
  itemCode?: string;
  itemName?: string;
  itemType?: string;
  rate?: number;
  qty?: number;
  amount?: number;
  discountPercent?: number;
  discountAmount?: number;
  brandName?: string;
  index?: string;
  coating?: string;
  orderNo?: string;
  prescriptionNo?: string;
}

export interface ServiceCustomerData {
  id?: string;
  name: string;
  mobileNo?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  prescriptionNo?: string;
}

class CustomerHistoryService {
  /**
   * Convert service item to database format
   */
  private convertServiceItemToDbFormat(item: ServiceDeletedItem): DeletedItem {
    // Map to the database format
    const dbItem: DeletedItem = {
      id: item.id,
      order_id: item.order_id,
      product_id: item.product_id || item.itemCode || '',
      product_type: item.product_type || item.itemType || 'unknown',
      product_name: item.product_name || item.itemName || 'Unknown Item',
      price: item.price || item.rate || 0,
      quantity: item.quantity || item.qty || 1,
      deleted_at: item.deleted_at || new Date().toISOString(),
      deleted_by: item.deleted_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      original_data: item.original_data || {
        // Include any additional fields that might be needed
        brand_name: item.brandName,
        index: item.index,
        coating: item.coating,
        discount_percent: item.discountPercent,
        discount_amount: item.discountAmount,
        item_code: item.itemCode,
        item_name: item.itemName,
        item_type: item.itemType,
        rate: item.rate,
        qty: item.qty,
        amount: item.amount,
        order_no: item.orderNo,
        prescription_no: item.prescriptionNo
      },
      // For backward compatibility
      item_code: item.itemCode || item.product_id,
      item_name: item.itemName || item.product_name,
      item_type: item.itemType || item.product_type,
      rate: item.rate || item.price,
      qty: item.qty || item.quantity,
      amount: item.amount || (item.price || 0) * (item.quantity || 1),
      discount_percent: item.discountPercent,
      discount_amount: item.discountAmount,
      brand_name: item.brandName,
      index: item.index,
      coating: item.coating,
      order_no: item.orderNo || item.order_id,
      prescription_no: item.prescriptionNo
    };

    return dbItem;
  }

  /**
   * Add a deleted item to customer history
   */
  async addDeletedItemToHistory(
    customerData: ServiceCustomerData,
    deletedItem: Omit<ServiceDeletedItem, 'deleted_at'>,
    orderNo?: string
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      logInfo('Adding deleted item to customer history:', { customerData, deletedItem, orderNo });

      // Prepare the deleted item with timestamp
      const itemWithTimestamp: ServiceDeletedItem = {
        ...deletedItem,
        deleted_at: new Date().toISOString(),
        order_id: orderNo || deletedItem.order_id || '',
        prescriptionNo: customerData.prescriptionNo || ''
      };

      // Convert to database format
      const dbItem = this.convertServiceItemToDbFormat(itemWithTimestamp);

      // First, try to find existing customer history record
      let existingHistory = null;
      // Search by mobile number first, then by customer ID if no mobile
      if (customerData.mobileNo) {
        const { data, error } = await supabase
          .from('customer_history')
          .select('*')
          .eq('mobile_no', customerData.mobileNo)
          .single();
        if (!error && data) {
          existingHistory = data;
        }
      }
      // If no record found by mobile, try customer ID
      if (!existingHistory && customerData.id) {
        const { data, error } = await supabase
          .from('customer_history')
          .select('*')
          .eq('customer_id', customerData.id)
          .single();
        if (!error && data) {
          existingHistory = data;
        }
      }

      if (existingHistory) {
        // Update existing record
        const currentItems = Array.isArray(existingHistory.deleted_items) 
          ? existingHistory.deleted_items 
          : [];
        // Prevent duplicate deleted items by id
        const alreadyExists = currentItems.some((item: { id: string }) => item.id === dbItem.id);
        if (alreadyExists) {
          return { success: false, message: 'This deleted item is already recorded in customer history.' };
        }
        const updatedItems = [...currentItems, dbItem];
        const newTotalItems = (existingHistory.total_deleted_items || 0) + 1;
        const newTotalValue = (existingHistory.total_deleted_value || 0) + (deletedItem.amount || 0);

        const { data: updatedData, error: updateError } = await supabase
          .from('customer_history')
          .update({
            deleted_items: updatedItems,
            total_deleted_items: newTotalItems,
            total_deleted_value: newTotalValue,
            // Update customer info in case it changed
            customer_name: customerData.name,
            email: customerData.email,
            address: customerData.address,
            city: customerData.city,
            state: customerData.state,
            pin_code: customerData.pinCode,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingHistory.id)
          .select()
          .single();

        if (updateError) {
          logError('Error updating customer history:', updateError);
          return { success: false, message: `Failed to update customer history: ${updateError.message}` };
        }

        logInfo('Successfully updated customer history:', updatedData);
        return { 
          success: true, 
          message: 'Item added to existing customer history', 
          data: updatedData 
        };
      } else {
        // Create new customer history record
        const newHistoryData = {
          customer_id: customerData.id || `cust_${Date.now()}`,
          customer_name: customerData.name,
          mobile_no: customerData.mobileNo || null,
          email: customerData.email || null,
          address: customerData.address || null,
          city: customerData.city || null,
          state: customerData.state || null,
          pin_code: customerData.pinCode || null,
          deleted_items: [dbItem],
          total_deleted_items: 1,
          total_deleted_value: deletedItem.amount || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: newData, error: insertError } = await supabase
          .from('customer_history')
          .insert(newHistoryData)
          .select()
          .single();

        if (insertError) {
          logError('Error creating customer history:', insertError);
          return { success: false, message: `Failed to create customer history: ${insertError.message}` };
        }

        logInfo('Successfully created new customer history:', newData);
        return { 
          success: true, 
          message: 'New customer history created with deleted item', 
          data: newData 
        };
      }
    } catch (error) {
      logError('Unexpected error in addDeletedItemToHistory:', error);
      return { 
        success: false, 
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Get customer history by customer ID
   */
  async getCustomerHistory(customerId: string): Promise<{ success: boolean; data?: CustomerHistory; message?: string }> {
    try {
      const { data, error } = await supabase
        .from('customer_history')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, data: undefined, message: 'No history found for this customer' };
        }
        logError('Error fetching customer history:', error);
        return { success: false, message: error.message };
      }

      // Ensure deleted_items is an array
      const customerHistory = {
        ...data,
        deleted_items: Array.isArray(data.deleted_items) ? data.deleted_items : []
      } as CustomerHistory;

      return { success: true, data: customerHistory };
    } catch (error) {
      logError('Unexpected error in getCustomerHistory:', error);
      return { 
        success: false, 
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Get customer history by mobile number
   */
  async getCustomerHistoryByMobile(mobileNo: string): Promise<{ success: boolean; data?: CustomerHistory; message?: string }> {
    try {
      const { data, error } = await supabase
        .from('customer_history')
        .select('*')
        .eq('mobile_no', mobileNo)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, data: undefined, message: 'No history found for this mobile number' };
        }
        logError('Error fetching customer history by mobile:', error);
        return { success: false, message: error.message };
      }

      // Ensure deleted_items is an array
      const customerHistory = {
        ...data,
        deleted_items: Array.isArray(data.deleted_items) ? data.deleted_items : []
      } as CustomerHistory;

      return { success: true, data: customerHistory };
    } catch (error) {
      logError('Unexpected error in getCustomerHistoryByMobile:', error);
      return { 
        success: false, 
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Search customer history by name or mobile
   */
  async searchCustomerHistory(searchQuery: string): Promise<{ success: boolean; data?: CustomerHistory[]; message?: string }> {
    try {
      // Search by name or mobile number
      const { data, error } = await supabase
        .from('customer_history')
        .select('*')
        .or(`customer_name.ilike.%${searchQuery}%,mobile_no.ilike.%${searchQuery}%`)
        .order('updated_at', { ascending: false });

      if (error) {
        logError('Error searching customer history:', error);
        return { success: false, message: error.message };
      }

      if (!data || data.length === 0) {
        return { success: true, data: [], message: 'No matching records found' };
      }

      // Filter out history for customers that no longer exist in the main prescriptions table.
      // This prevents "dead" records from showing up in search.
      const customerIds = [...new Set(data.map(item => item.customer_id).filter(id => id))];
      
      if (customerIds.length === 0) {
        return { success: true, data: [], message: 'No matching records found' };
      }

      const { data: existingCustomers, error: customerError } = await supabase
        .from('prescriptions')
        .select('id')
        .in('id', customerIds);
      
      if (customerError) {
        logError('Error checking for existing customers in prescriptions table:', customerError);
        // Fail gracefully: return the unfiltered data so the feature doesn't break.
        return { success: true, data, message: 'Search successful (with potential old records)' };
      }

      const existingCustomerIds = new Set(existingCustomers.map(c => c.id));
      const filteredData = data.filter(historyItem => existingCustomerIds.has(historyItem.customer_id));

      if (filteredData.length === 0) {
        return { success: true, data: [], message: 'No matching records found for existing customers' };
      }

      return { success: true, data: filteredData, message: 'Search successful' };
    } catch (error) {
      logError('Unexpected error in searchCustomerHistory:', error);
      return { 
        success: false, 
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Search customer history by specific field (reference_no or prescription_no)
   */
  async searchCustomerHistoryByField(
    field: 'reference_no' | 'prescription_no',
    value: string
  ): Promise<{ success: boolean; data?: CustomerHistory; message?: string }> {
    try {
      logInfo(`[searchCustomerHistoryByField] Searching by ${field}:`, value);
      
      if (!value.trim()) {
        logInfo('[searchCustomerHistoryByField] Empty search value provided');
        return { success: false, message: 'Search value cannot be empty' };
      }
      
      // Normalize the search field name
      const searchField = field === 'prescription_no' ? 'prescription_no' : 'order_no';
      
      // First, try to find exact match in deleted_items array
      const searchQuery = `deleted_items.cs.[{"${searchField}":"${value}"}]`;
      
      logInfo('[searchCustomerHistoryByField] Constructed search query:', searchQuery);
      
      // Execute the query
      const { data: historyData, error: historyError } = await supabase
        .from('customer_history')
        .select('*')
        .or(searchQuery);

      logInfo('[searchCustomerHistoryByField] Search results from customer_history:', { 
        data: historyData ? 'Data received' : 'No data',
        error: historyError,
        count: historyData?.length || 0
      });

      if (!historyError && historyData && historyData.length > 0) {
        // Get the first matching record
        const matchingRecord = historyData[0];
        
        // Filter deleted_items to only include matching items
        const filteredDeletedItems = (Array.isArray(matchingRecord.deleted_items) 
          ? matchingRecord.deleted_items 
          : []).filter((item: any) => {
            if (field === 'prescription_no') {
              return item.prescription_no === value || 
                     (item.original_data && item.original_data.prescription_no === value);
            } else {
              return item.order_no === value || 
                     item.order_id === value ||
                     (item.original_data && item.original_data.order_no === value);
            }
          });
        
        // Create a new customer history with filtered items
        const customerHistory = {
          ...matchingRecord,
          deleted_items: filteredDeletedItems,
          total_deleted_items: filteredDeletedItems.length,
          total_deleted_value: filteredDeletedItems.reduce(
            (sum: number, item: any) => sum + (item.amount || 0), 0
          )
        } as CustomerHistory;

        logInfo('Returning filtered customer history:', customerHistory);
        return {
          success: true,
          data: customerHistory
        };
      }

      // If not found in customer_history, try to find in orders table
      const orderFieldMap = {
        'reference_no': 'ref_no',
        'prescription_no': 'prescription_id'
      } as const;

      const orderField = orderFieldMap[field];

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq(orderField, value)
        .single();

      if (orderError || !orderData) {
        return {
          success: false,
          message: `No matching record found for ${field}: ${value}`
        };
      }

      // Get or create customer history based on order data
      const { data: customerHistory, error: custHistoryError } = await supabase
        .from('customer_history')
        .select('*')
        .eq('customer_id', orderData.customer_id || orderData.prescription_id)
        .single();

      if (custHistoryError || !customerHistory) {
        // Create new customer history if not exists
        const newHistoryData = {
          customer_id: orderData.customer_id || orderData.prescription_id || `cust_${Date.now()}`,
          customer_name: orderData.customer_name || orderData.name || 'Unknown Customer',
          mobile_no: orderData.mobile_no,
          email: orderData.email,
          address: orderData.address,
          city: orderData.city,
          state: orderData.state,
          pin_code: orderData.pin_code,
          total_deleted_items: 0,
          total_deleted_value: 0,
          deleted_items: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: newHistory, error: createError } = await supabase
          .from('customer_history')
          .insert(newHistoryData)
          .select()
          .single();

        if (createError || !newHistory) {
          return {
            success: false,
            message: `Failed to create customer history: ${createError?.message || 'Unknown error'}`
          };
        }
        
        // Ensure deleted_items is an array
        const newCustomerHistory = {
          ...newHistory,
          deleted_items: Array.isArray(newHistory.deleted_items) ? newHistory.deleted_items : []
        } as CustomerHistory;

        return {
          success: true,
          data: newCustomerHistory
        };
      }

      // Ensure deleted_items is an array
      const existingCustomerHistory = {
        ...customerHistory,
        deleted_items: Array.isArray(customerHistory.deleted_items) ? customerHistory.deleted_items : []
      } as CustomerHistory;

      return {
        success: true,
        data: existingCustomerHistory
      };
    } catch (error) {
      logError(`Error searching customer history by ${field}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : `Failed to search by ${field}`
      };
    }
  }

  /**
   * Get all customer history records with pagination
   */
  async getAllCustomerHistory(
    page = 1, 
    limit = 50
  ): Promise<{ success: boolean; data?: CustomerHistory[]; count?: number; message?: string }> {
    try {
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabase
        .from('customer_history')
        .select('*', { count: 'exact' })
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logError('Error fetching all customer history:', error);
        return { success: false, message: error.message };
      }

      // Ensure deleted_items is an array for each record
      const customerHistories = (data || []).map(record => ({
        ...record,
        deleted_items: Array.isArray(record.deleted_items) ? record.deleted_items : []
      })) as CustomerHistory[];

      return { success: true, data: customerHistories, count: count || 0 };
    } catch (error) {
      logError('Unexpected error in getAllCustomerHistory:', error);
      return { 
        success: false, 
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}

// Export the DeletedItem interface
export { DeletedItem };

// Create and export singleton instance
export const customerHistoryService = new CustomerHistoryService();