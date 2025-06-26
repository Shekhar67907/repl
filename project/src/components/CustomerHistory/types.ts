// types.ts - Types for customer history tracking

export interface DeletedItem {
  // Primary fields from database
  id: string;
  order_id: string;
  product_id?: string;
  product_type: string;
  product_name: string;
  price: number;
  quantity: number;
  deleted_at: string;
  deleted_by?: string;
  original_data?: any;
  created_at?: string;
  updated_at?: string;
  
  // Backward compatibility fields
  item_code?: string;
  item_name?: string;
  item_type?: string; // e.g., 'Frames', 'ContactLens', etc.
  rate?: number;
  qty?: number;
  amount?: number;
  discount_percent?: number;
  discount_amount?: number;
  tax_percent?: number;
  brand_name?: string;
  index?: string;
  coating?: string;
  order_no?: string;
  prescription_no?: string;
  // Contact lens specific fields
  eye_side?: string;
  power?: string;
  base_curve?: string;
  diameter?: string;
  material_text?: string;
  disposal_text?: string;
  brand_text?: string;
}

export interface CustomerHistory {
  id: string;
  customer_id: string;
  customer_name: string;
  mobile_no?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  deleted_items: DeletedItem[];
  total_deleted_items: number;
  total_deleted_value: number;
  created_at?: string;
  updated_at?: string;
}

export interface SearchResult {
  id: string;
  customer_id: string;
  customer_name: string;
  mobile_no?: string;
  email?: string;
  total_deleted_items: number;
  total_deleted_value: number;
  updated_at: string;
}

export type SearchField = 'name' | 'mobile' | 'ref_no' | 'prescription_no';