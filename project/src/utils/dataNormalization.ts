/**
 * Utility functions for normalizing data from different sources
 * These helpers standardize field access across different tables
 */

/**
 * Normalizes mobile number from different field names
 * @param data Object that might contain mobile_no, mobile, or phone
 * @returns Normalized mobile number as string
 */
export const getNormalizedMobile = (data: any): string => {
  if (!data) return '';
  return data.mobile_no || data.mobile || data.phone || '';
};

/**
 * Normalizes customer name from different field names
 * @param data Object that might contain name or customer_name
 * @returns Normalized customer name as string
 */
export const getNormalizedName = (data: any): string => {
  if (!data) return '';
  return data.name || data.customer_name || '';
};

/**
 * Normalizes pin/postal code from different field names
 * @param data Object that might contain pin_code or pin
 * @returns Normalized pin code as string
 */
export const getNormalizedPinCode = (data: any): string => {
  if (!data) return '';
  return data.pin_code || data.pinCode || data.pin || '';
};

/**
 * Normalizes numeric values to ensure consistent type and format
 * @param value Value that might be number, string, or undefined
 * @param defaultValue Default value if parsing fails (default: 0)
 * @returns Normalized number as string with 2 decimal places
 */
export const getNormalizedNumber = (value: any, defaultValue = 0): string => {
  let numValue: number;
  
  if (value === null || value === undefined) {
    numValue = defaultValue;
  } else if (typeof value === 'number') {
    numValue = value;
  } else if (typeof value === 'string') {
    const parsed = parseFloat(value);
    numValue = isNaN(parsed) ? defaultValue : parsed;
  } else {
    numValue = defaultValue;
  }
  
  // Return as string with 2 decimal places
  return numValue.toFixed(2);
};

/**
 * Normalizes discount values (handles both percentage and fixed amount)
 * @param percent Discount percentage that might be number, string, or undefined
 * @param amount Discount amount that might be number, string, or undefined
 * @returns Object with normalized discount percent and amount
 */
export const getNormalizedDiscount = (percent: any, amount: any) => {
  return {
    discountPercent: getNormalizedNumber(percent),
    discountAmount: getNormalizedNumber(amount)
  };
};

/**
 * Normalizes reference number from different field names
 * @param data Object that might contain different reference number fields
 * @param type Type of reference (order, prescription, etc.)
 * @returns Normalized reference number as string
 */
export const getNormalizedReferenceNo = (data: any, type: string): string => {
  if (!data) return '';
  
  switch (type) {
    case 'order':
      return data.order_no || data.referenceNo || `ORDER-${data.id || Date.now()}`;
    case 'prescription':
      return data.prescription_no || `RX-${data.id || Date.now()}`;
    case 'contact_lens':
      return data.prescription_no || `CL-${data.id || Date.now()}`;
    default:
      return data.referenceNo || `REF-${data.id || Date.now()}`;
  }
};