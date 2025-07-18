// src/Services/contactLensService.ts
import { supabase } from './supabaseService';
import type { DatabasePrescription } from './supabaseService';
import { logInfo, logError, logDebug, logWarn, logDev } from '../utils/logger';

// Generate a unique contact lens prescription number with prefix CL-YYYYMMDD-XXX
export const generateContactLensPrescriptionNo = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `CL-${year}${month}${day}-${random}`;
};

interface ContactLensEye {
  eye_side: string;
  vision_type: 'dv' | 'nv';
  sph?: string;
  cyl?: string;
  axis?: string;
  add_power?: string;
  vn?: string;
  rpd?: string;
  lpd?: string;
  ipd?: string;
}

interface ContactLensItem {
  // Database fields (snake_case)
  eye_side: string;
  base_curve?: string;
  power?: string;
  material?: string;
  dispose?: string;
  brand?: string;
  diameter?: string;
  quantity?: number;
  rate?: number;
  discount_percent?: number;
  discount_amount?: number;
  final_amount?: number;
  sph?: string;
  cyl?: string;
  axis?: string;
  lens_code?: string;
  
  // UI fields (camelCase) - added to support fields from the UI
  discountPercent?: number;
  discountAmount?: number;
  amount?: number; // UI equivalent of final_amount
  // UI compatibility fields for fallback mapping
  bc?: string;
  qty?: number;
  ax?: string;
  lensCode?: string;
}

interface ContactLensPayment {
  // Direct mapping fields (matching UI fields exactly)
  payment_total?: number;      // Maps to UI's Total field
  estimate?: number;          // Maps to UI's Estimate field
  advance?: number;           // Maps to UI's Advance field
  balance?: number;           // Maps to UI's Balance field
  
  // Payment method
  payment_mode?: string;      // Cash, Card, UPI, Cheque
  
  // Individual advance amounts
  cash_advance?: number;
  card_upi_advance?: number;
  cheque_advance?: number;
  
  // Discount information
  discount_amount?: number;   // Amount of discount
  discount_percent?: number;  // Percentage of discount
  scheme_discount?: boolean;  // Whether this is a scheme discount
  
  // Dates
  payment_date?: string;
}

interface ContactLensPrescription {
  prescription_id?: string;
  booked_by?: string;
  delivery_date?: string;
  delivery_time?: string;
  status?: string;
  retest_date?: string;
  expiry_date?: string;
  remarks?: string;
  reference_no?: string; // Changed from ref_no to match the database schema
  customer_code?: string;
  birth_day?: string;
  marriage_anniversary?: string;
  pin?: string;
  phone_landline?: string;
  prescribed_by?: string;
  name?: string;
  gender?: string;
  age?: string;
  mobile?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  class?: string;
}

interface ContactLensData {
  prescription: ContactLensPrescription;
  eyes: ContactLensEye[];
  items: ContactLensItem[];
  payment: ContactLensPayment;
}

/**
 * Service functions for handling contact lens prescriptions
 * This includes saving and retrieving data across the following tables:
 * - contact_lens_prescriptions
 * - contact_lens_eyes
 * - contact_lens_items
 * - contact_lens_payments
 */

/**
 * Save contact lens prescription data to Supabase
 * This handles inserting data into all four contact lens tables:
 * - contact_lens_prescriptions
 * - contact_lens_eyes
 * - contact_lens_items
 * - contact_lens_payments
 */
// Helper function to get or create a prescription record for Contact Lens
const createMainPrescription = async (contactLensData: ContactLensData): Promise<{ success: boolean; message: string; id?: string }> => {
  try {
    const { prescription } = contactLensData;
    const mobileNumber = prescription.mobile || null; // Get mobile number


    // 1. Try to find an existing ContactLens prescription for this mobile_no
    if (mobileNumber && mobileNumber.trim() !== '') {
      try {
        // First check if there's a ContactLens prescription with this mobile number
        const { data: contactLensPrescription, error: clFindError } = await supabase
          .from('prescriptions')
          .select('id')
          .eq('mobile_no', mobileNumber)
          .eq('source', 'ContactLens')
          .maybeSingle();

        if (contactLensPrescription?.id) {
          // Found existing ContactLens prescription - reuse it
          logInfo('Found existing ContactLens prescription with ID:', contactLensPrescription.id);
          return {
            success: true,
            message: 'Main ContactLens prescription record found and reused.',
            id: contactLensPrescription.id
          };
        }

        if (clFindError) {
          logWarn('Error checking for existing ContactLens prescription:', clFindError.message);
        }

        // Check if there's any prescription with this mobile number (regardless of source)
        const { data: anyPrescription, error: anyFindError } = await supabase
          .from('prescriptions')
          .select('id, source')
          .eq('mobile_no', mobileNumber)
          .maybeSingle();

        if (anyFindError) {
          logWarn('Error checking for any existing prescription:', anyFindError.message);
        }

        if (anyPrescription) {
          logInfo(`Found existing prescription with mobile ${mobileNumber} and source: ${anyPrescription.source}`);
          // We'll continue to create a new ContactLens prescription with the same mobile number
          // The unique constraint on (mobile_no, source) will allow this
        }
      } catch (error) {
        logError('Error in prescription lookup:', error);
        // Continue with creation if there was an error in lookup
      }
    }

    // 2. If no existing ContactLens prescription found (or mobile_no was blank/find failed), create a new one
    const prescriptionNo = prescription.prescription_id || generateContactLensPrescriptionNo();
    const referenceNo = prescriptionNo; // Standard practice, can be same as prescription_no

    const insertPayload = {
      prescription_no: prescriptionNo,
      reference_no: referenceNo,
      name: prescription.name || 'Customer',
      gender: prescription.gender || 'Male',
      age: prescription.age || null,
      class: prescription.class || null,
      mobile_no: mobileNumber,
      email: prescription.email || null,
      address: prescription.address || null,
      city: prescription.city || null,
      state: prescription.state || null,
      pin_code: prescription.pin || null,
      customer_code: prescription.customer_code || null,
      birth_day: prescription.birth_day || null,
      marriage_anniversary: prescription.marriage_anniversary || null,
      phone_landline: prescription.phone_landline || null,
      prescribed_by: prescription.prescribed_by || 'Contact Lens Dept',
      date: new Date().toISOString().split('T')[0],
      others: prescription.remarks || null,
      source: 'ContactLens' // CRITICAL: Set the source for ContactLens
    };
    
    const { data: newPrescription, error: insertError } = await supabase
      .from('prescriptions')
      .insert(insertPayload)
      .select('id') // Only select the ID for efficiency
      .single();

    if (insertError) {
      logError('Error creating new main prescription:', insertError.message);
      return {
        success: false,
        message: `Error creating main prescription: ${insertError.message}`
      };
    }

    if (!newPrescription || !newPrescription.id) {
      logError('Failed to create main prescription: No ID returned after insert.');
      return {
        success: false,
        message: 'Failed to create main prescription: No ID returned after insert.'
      };
    }

    logInfo('Created new main prescription with ID:', newPrescription.id);
    return {
      success: true,
      message: 'Main prescription created successfully',
      id: newPrescription.id
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during main prescription creation';
    logError('Error in createMainPrescription catch block:', errorMessage);
    return {
      success: false,
      message: `Error creating main prescription: ${errorMessage}`
    };
  }
};

// Export the function in the service object at the end of file

export const saveContactLensPrescription = async (data: ContactLensData): Promise<{ success: boolean; message: string; id?: string }> => {
  try {
    const { prescription } = data;
    logInfo('Saving contact lens prescription for prescription number:', prescription.prescription_id);
    
    let prescriptionUuid: string;
    
    // Always use createMainPrescription which handles the find-or-create logic
    // This ensures we properly handle the source field and mobile number uniqueness
    logInfo('Creating/updating main prescription...');
    const createResult = await createMainPrescription(data);
    
    if (!createResult.success || !createResult.id) {
      return createResult; // Return the error from createMainPrescription
    }
    
    prescriptionUuid = createResult.id;
    logInfo('Main prescription processed with UUID:', prescriptionUuid);
    
    // Check if a contact lens prescription already exists for this prescription ID
    logInfo('Checking if contact lens prescription already exists...');
    const { data: existingContactLens, error: existingCheckError } = await supabase
      .from('contact_lens_prescriptions')
      .select('id')
      .eq('prescription_id', prescriptionUuid)
      .maybeSingle();
      
    if (existingCheckError) {
      logError('Error checking existing contact lens prescription:', existingCheckError);
      return { success: false, message: `Error checking existing data: ${existingCheckError.message}` };
    }
    
    // If contact lens prescription already exists, update it instead of creating a new one
    if (existingContactLens) {
      logInfo('Contact lens prescription already exists with ID:', existingContactLens.id);
      logInfo('Updating existing contact lens prescription instead of creating new one...');
      return await updateContactLensPrescription(existingContactLens.id, data);
    }
    
    // If no existing contact lens prescription, create a new one
    logInfo('No existing contact lens prescription found. Creating new record...');
    
    // Debug log for class value
    logInfo('Saving to contact_lens_prescriptions with class:', prescription.class);
    const { data: contactLensPrescription, error: prescriptionError } = await supabase
      .from('contact_lens_prescriptions')
      .upsert({
        prescription_id: prescriptionUuid,
        booked_by: prescription.booked_by,
        delivery_date: prescription.delivery_date || null,
        delivery_time: prescription.delivery_time || null,
        status: prescription.status || 'Processing',
        retest_date: prescription.retest_date || null,
        expiry_date: prescription.expiry_date || null,
        remarks: prescription.remarks || null,
        class: prescription.class || null,
        // Add the new fields that were previously missing in the database
        reference_no: prescription.reference_no || null,
        customer_code: prescription.customer_code || null,
        birth_day: prescription.birth_day || null,
        marriage_anniversary: prescription.marriage_anniversary || null,
        pin: prescription.pin || null,
        phone_landline: prescription.phone_landline || null,
        prescribed_by: prescription.prescribed_by || null
      }, { onConflict: 'prescription_id' })
      .select()
      .single();

    if (prescriptionError) {
      logError('Error saving contact lens prescription:', prescriptionError);
      return { 
        success: false, 
        message: `Error saving contact lens prescription: ${prescriptionError.message}` 
      };
    }
    
    if (!contactLensPrescription) {
      logError('Failed to create contact lens prescription: No data returned');
      return { 
        success: false, 
        message: 'Failed to create contact lens prescription: No data returned' 
      };
    }

    const contactLensPrescriptionId = contactLensPrescription.id;
    logInfo('Contact lens prescription saved with ID:', contactLensPrescriptionId);

    // 2. Insert or update eye data (for both left and right eyes) using UPSERT
    logInfo('Upserting contact lens eye data...');
    
    // First, delete any existing eye data for this prescription to avoid duplicates
    const { error: deleteEyesError } = await supabase
      .from('contact_lens_eyes')
      .delete()
      .eq('contact_lens_prescription_id', contactLensPrescriptionId);
      
    if (deleteEyesError) {
      logError('Error removing existing eye data:', deleteEyesError);
      // We'll continue anyway and try to insert the new data
    }

    // Defensive deduplication and logging
    const seen = new Set();
    const uniqueEyes = [];
    for (const eye of data.eyes) {
      const key = `${eye.eye_side}-${eye.vision_type}`;
      if (!seen.has(key)) {
        uniqueEyes.push(eye);
        seen.add(key);
      } else {
        logWarn('Duplicate eye entry detected and skipped:', eye);
      }
    }
    // Filter out empty eyes (all main fields empty)
    const filteredEyes = uniqueEyes.filter(eye =>
      eye.sph || eye.cyl || eye.axis || eye.add_power || eye.vn || eye.rpd || eye.lpd
    );
    logInfo('EYES TO INSERT (filtered):', filteredEyes);

    // Insert all eyes in a single batch
    if (filteredEyes.length > 0) {
      const { error: eyeError } = await supabase
        .from('contact_lens_eyes')
        .insert(filteredEyes.map(eye => ({
          contact_lens_prescription_id: contactLensPrescriptionId,
          eye_side: eye.eye_side,
          vision_type: eye.vision_type,
          sph: eye.sph || null,
          cyl: eye.cyl || null,
          axis: eye.axis || null,
          add_power: eye.add_power || null,
          vn: eye.vn || null,
          rpd: eye.rpd || null,
          lpd: eye.lpd || null,
          ipd: eye.ipd || null
        })));
      if (eyeError) {
        logError('Error saving eyes batch:', eyeError);
        throw new Error(`Error saving eyes: ${eyeError.message}`);
      }
      logInfo('All eyes saved successfully');
    }
    
    // 3. Insert or update contact lens items using UPSERT
    logInfo('Upserting contact lens items...');
    
    // First, delete any existing items for this prescription to avoid duplicates
    const { error: deleteItemsError } = await supabase
      .from('contact_lens_items')
      .delete()
      .eq('contact_lens_prescription_id', contactLensPrescriptionId);
      
    if (deleteItemsError) {
      logError('Error removing existing items:', deleteItemsError);
      // We'll continue anyway and try to insert the new data
    }
    
    const itemInsertPromises = data.items.map(async (item, index) => {
      // Convert UI side values to database values
      const dbSideValue = item.eye_side === 'RE' ? 'Right' : 
                          item.eye_side === 'LE' ? 'Left' : 
                          'Both'; // Empty string or any other value becomes 'Both'

      // Important: Field names coming from UI are in camelCase but need to be converted to snake_case
      // For example, from UI: discountPercent -> database: discount_percent
      logInfo('Saving item with discount fields:', {
        ui_fields: {
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount,
          amount: item.amount  // Final amount in UI
        },
        db_fields: {
          discount_percent: item.discount_percent,
          discount_amount: item.discount_amount, 
          final_amount: item.final_amount
        }
      });
      
      // IMPORTANT: In the contact_lens_items table, discount_amount is a generated column
      // that's automatically calculated by the database based on rate, quantity, and discount_percent.
      // We must EXCLUDE discount_amount from the insert operation and only set discount_percent.
      logInfo(`Inserting contact lens item ${index + 1} with discount_percent:`, item.discountPercent || 0);
      
      const insertData = {
        contact_lens_prescription_id: contactLensPrescriptionId,
        eye_side: dbSideValue,
        // Always prefer UI camelCase fields if present, then fallback to snake_case
        base_curve: item.bc !== undefined ? item.bc : (item.base_curve || null),
        power: item.power || null,
        material: item.material || null,
        dispose: item.dispose || null,
        brand: item.brand || null,
        diameter: item.diameter || null,
        quantity: item.qty !== undefined ? item.qty : (item.quantity || 1),
        rate: item.rate || 0,
        discount_percent: item.discountPercent !== undefined ? item.discountPercent : (item.discount_percent || 0),
        sph: item.sph || null,
        cyl: item.cyl || null,
        axis: item.ax !== undefined ? item.ax : (item.axis || null),
        lens_code: item.lensCode !== undefined ? item.lensCode : (item.lens_code || null),
        item_index: index // Add an index for ordering
      };
      
      logInfo('Contact lens item insert data:', insertData);
      
      const { error: itemError } = await supabase
        .from('contact_lens_items')
        .insert(insertData);
      
      if (itemError) {
        logError(`Error saving item ${index + 1}:`, itemError);
        throw new Error(`Error saving item ${index + 1}: ${itemError.message}`);
      }
      
      logInfo(`Item ${index + 1} saved successfully`);
      return true;
    });

    try {
      await Promise.all(itemInsertPromises);
      logInfo('All items saved successfully');
    } catch (itemError) {
      logError('Error saving items:', itemError);
      // Attempt to clean up the prescription entries and eye data
      await supabase
        .from('contact_lens_eyes')
        .delete()
        .eq('contact_lens_prescription_id', contactLensPrescriptionId);
        
      await supabase
        .from('contact_lens_prescriptions')
        .delete()
        .eq('id', contactLensPrescriptionId);
      
      return { 
        success: false, 
        message: itemError instanceof Error ? itemError.message : 'Error saving items' 
      };
    }

    // 4. Insert or update payment data using UPSERT pattern
    logInfo('Upserting payment data...');
    
    // First, check if payment data already exists for this prescription
    const { data: existingPayment, error: paymentCheckError } = await supabase
      .from('contact_lens_payments')
      .select('*')
      .eq('contact_lens_prescription_id', contactLensPrescriptionId)
      .maybeSingle();
      
    if (paymentCheckError) {
      logError('Error checking existing payment data:', paymentCheckError);
      // We'll continue anyway and try to insert/update
    }
    
    // Calculate actual values to ensure consistency between UI and database
    // This is critical to ensure payment_total, balance, and discount values match
    
    // Calculate total of all advances
    const totalAdvance = (
      parseFloat((data.payment.cash_advance || 0).toString()) +
      parseFloat((data.payment.card_upi_advance || 0).toString()) + 
      parseFloat((data.payment.cheque_advance || 0).toString())
    );
    
    // Calculate payment_total from items (sum of quantity * rate)
    let paymentTotal = 0;
    if (data.items && data.items.length > 0) {
      paymentTotal = data.items.reduce((total, item) => {
        const qty = parseFloat(item.quantity?.toString() || '0');
        const rate = parseFloat(item.rate?.toString() || '0');
        return total + (qty * rate);
      }, 0);
    } else {
      // Fallback to the existing payment_total if no items
      paymentTotal = parseFloat((data.payment.payment_total || 0).toString());
    }
    
    // Log the UI values we're getting
    logInfo('SAVING - UI VALUES BEFORE PROCESSING:', {
      ui_payment_total: data.payment.payment_total,
      ui_estimate: data.payment.estimate,
      ui_discount_amount: data.payment.discount_amount,
      ui_cash_advance: data.payment.cash_advance,
      ui_card_upi_advance: data.payment.card_upi_advance,
      ui_cheque_advance: data.payment.cheque_advance,
      ui_advance: data.payment.advance,
      ui_balance: data.payment.balance
    });
    
    // Note: Balance is a generated column in the database
    // The database will calculate: balance = payment_total - advance
    
    // Construct payment data with corrected values
    const correctedPaymentData = {
      contact_lens_prescription_id: contactLensPrescriptionId,
      
      // Ensure payment_total is the amount AFTER discount
      payment_total: paymentTotal,
      
      // Estimate is the original amount BEFORE discount
      estimate: parseFloat((data.payment.estimate || 0).toString()),
      
      // Set advance to calculated total of all advances
      advance: totalAdvance,
      
      // DO NOT set balance - it's a generated column in the database
      // The database will calculate: balance = payment_total - advance
      
      // Individual advances
      payment_mode: data.payment.payment_mode || 'Cash',
      cash_advance: parseFloat((data.payment.cash_advance || 0).toString()),
      card_upi_advance: parseFloat((data.payment.card_upi_advance || 0).toString()),
      cheque_advance: parseFloat((data.payment.cheque_advance || 0).toString()),
      
      // Discount information
      discount_amount: parseFloat((data.payment.discount_amount || 0).toString()),
      discount_percent: parseFloat((data.payment.discount_percent || 0).toString()),
      scheme_discount: Boolean(data.payment.scheme_discount),
      payment_date: data.payment.payment_date || new Date().toISOString().split('T')[0]
    };
    
    logInfo('Saving corrected payment data to database:', correctedPaymentData);
    
    // Use upsert if payment exists, otherwise insert
    const { error: paymentError } = existingPayment
      ? await supabase
          .from('contact_lens_payments')
          .update(correctedPaymentData)
          .eq('contact_lens_prescription_id', contactLensPrescriptionId)
      : await supabase
          .from('contact_lens_payments')
          .insert(correctedPaymentData);

    if (paymentError) {
      logError('Error saving payment data:', paymentError);
      // Attempt to clean up all related data
      await supabase
        .from('contact_lens_items')
        .delete()
        .eq('contact_lens_prescription_id', contactLensPrescriptionId);
        
      await supabase
        .from('contact_lens_eyes')
        .delete()
        .eq('contact_lens_prescription_id', contactLensPrescriptionId);
        
      await supabase
        .from('contact_lens_prescriptions')
        .delete()
        .eq('id', contactLensPrescriptionId);
      
      return { 
        success: false, 
        message: `Error saving payment data: ${paymentError.message}` 
      };
    }
    
    logInfo('Payment data saved successfully');
    logInfo('All contact lens prescription data saved successfully!');
    
    return { 
      success: true, 
      message: 'Contact lens prescription saved successfully', 
      id: contactLensPrescriptionId 
    };
  } catch (error) {
    logError('Unexpected error in saveContactLensPrescription:', error);
    return { 
      success: false, 
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};

export const saveOrUpdateContactLensData = async (contactLensData: ContactLensData, existingPrescriptionId?: string): Promise<{ success: boolean; message: string; id?: string }> => {
  try {
    // If an existing prescription ID is provided, always perform an update.
    if (existingPrescriptionId) {
      logInfo(`Updating existing contact lens prescription with ID: ${existingPrescriptionId}`);
      return updateContactLensPrescription(existingPrescriptionId, contactLensData);
    }
    
    // If no ID is provided, it's a new record. Create it.
    logInfo('No existing ID found, creating new contact lens prescription.');
    return createMainPrescription(contactLensData);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during save/update operation';
    logError('Error in saveOrUpdateContactLensData:', errorMessage);
    return {
      success: false,
      message: `Failed to save or update contact lens data: ${errorMessage}`
    };
  }
};

/**
 * Get a contact lens prescription by ID
 * Returns data from all four contact lens tables
 */
export const getContactLensPrescription = async (prescriptionId: string) => {
  try {
    // Get the contact lens prescription record
    const { data: prescriptionData, error: prescriptionError } = await supabase
      .from('contact_lens_prescriptions')
      .select('*')
      .eq('id', prescriptionId)
      .single();

    if (prescriptionError) {
      logError('Error fetching contact lens prescription:', prescriptionError);
      return { success: false, message: prescriptionError.message, data: null };
    }

    // Get the eye data
    const { data: eyesData, error: eyesError } = await supabase
      .from('contact_lens_eyes')
      .select('*')
      .eq('contact_lens_prescription_id', prescriptionId);

    if (eyesError) {
      logError('Error fetching contact lens eye data:', eyesError);
      return { success: false, message: eyesError.message, data: null };
    }

    // Get the items data
    const { data: itemsData, error: itemsError } = await supabase
      .from('contact_lens_items')
      .select('*')
      .eq('contact_lens_prescription_id', prescriptionId);

    if (itemsError) {
      logError('Error fetching contact lens items:', itemsError);
      return { success: false, message: itemsError.message, data: null };
    }

    // Get the payment data
    const { data: paymentData, error: paymentError } = await supabase
      .from('contact_lens_payments')
      .select('*')
      .eq('contact_lens_prescription_id', prescriptionId)
      .single();

    if (paymentError) {
      logError('Error fetching contact lens payment:', paymentError);
      return { success: false, message: paymentError.message, data: null };
    }

    // Get customer details from the main prescription
    const { data: customerData, error: customerError } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('id', prescriptionData.prescription_id)
      .single();

    if (customerError && customerError.code !== 'PGRST116') { // PGRST116 is not found, which is ok here
      logError('Error fetching customer data:', customerError);
      // Don't return here, as we might still be able to provide the contact lens data
    }

    // Combine the data into a single response
    const combinedData = {
      prescription: {
        ...prescriptionData,
        // Add customer details if available
        name: customerData?.name,
        gender: customerData?.gender,
        age: customerData?.age,
        mobile: customerData?.mobile_no,
        email: customerData?.email,
        address: customerData?.address,
        city: customerData?.city,
        state: customerData?.state,
        pin: customerData?.pin_code,
        // Include the new fields
        reference_no: prescriptionData?.reference_no || customerData?.reference_no,
        customer_code: prescriptionData?.customer_code || customerData?.customer_code,
        birth_day: prescriptionData?.birth_day || customerData?.birth_day,
        marriage_anniversary: prescriptionData?.marriage_anniversary || customerData?.marriage_anniversary,
        phone_landline: prescriptionData?.phone_landline || customerData?.phone_landline,
        prescribed_by: prescriptionData?.prescribed_by || customerData?.prescribed_by
      },
      eyes: eyesData || [],
      items: itemsData || [],
      payment: paymentData
    };

    return {
      success: true,
      message: 'Contact lens prescription fetched successfully',
      data: combinedData
    };

  } catch (error) {
    logError('Unexpected error fetching contact lens prescription:', error);
    return {
      success: false,
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null
    };
  }
};

/**
 * Get all contact lens prescriptions for a given prescription ID
 */
export const getContactLensPrescriptionsByPrescriptionId = async (prescriptionId: string) => {
  try {
    const { data, error } = await supabase
      .from('contact_lens_prescriptions')
      .select(`
        *,
        contact_lens_eyes(*),
        contact_lens_items(*),
        contact_lens_payments(*)
      `)
      .eq('prescription_id', prescriptionId)
      .order('created_at', { ascending: false });

    if (error) {
      logError('Error fetching contact lens prescriptions:', error);
      return { success: false, message: error.message, data: null };
    }

    return {
      success: true,
      message: 'Contact lens prescriptions fetched successfully',
      data
    };
  } catch (error) {
    logError('Unexpected error fetching contact lens prescriptions:', error);
    return {
      success: false,
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null
    };
  }
};

/**
 * Update an existing contact lens prescription
 */
export const updateContactLensPrescription = async (prescriptionId: string, data: ContactLensData) => {
  try {
    logInfo('Updating contact lens prescription:', prescriptionId);
    
    // First, get the original record to ensure we have all required fields
    const { data: originalRecord, error: fetchError } = await supabase
      .from('contact_lens_prescriptions')
      .select('*')
      .eq('id', prescriptionId)
      .single();
    
    if (fetchError) {
      logError('Error fetching original record:', fetchError);
      return { success: false, message: `Error fetching original record: ${fetchError.message}` };
    }
    
    if (!originalRecord) {
      return { success: false, message: 'Record not found' };
    }
    
    // Debug log for class value on update
    logInfo('Updating contact_lens_prescriptions with class:', data.prescription.class);
    const { error: prescriptionError } = await supabase
      .from('contact_lens_prescriptions')
      .upsert({
        id: prescriptionId, // Include the ID to match in conflict resolution
        prescription_id: originalRecord.prescription_id, // Keep the original required field
        booked_by: data.prescription.booked_by,
        delivery_date: data.prescription.delivery_date || null,
        delivery_time: data.prescription.delivery_time || null,
        status: data.prescription.status || 'Processing',
        retest_date: data.prescription.retest_date || null,
        expiry_date: data.prescription.expiry_date || null,
        remarks: data.prescription.remarks || null,
        class: data.prescription.class || null,
        reference_no: data.prescription.reference_no || null,
        customer_code: data.prescription.customer_code || null,
        birth_day: data.prescription.birth_day || null,
        marriage_anniversary: data.prescription.marriage_anniversary || null,
        pin: data.prescription.pin || null,
        phone_landline: data.prescription.phone_landline || null,
        prescribed_by: data.prescription.prescribed_by || null,
        updated_at: new Date().toISOString()
      });

    if (prescriptionError) {
      logError('Error updating contact lens prescription:', prescriptionError);
      return { success: false, message: `Error updating contact lens prescription: ${prescriptionError.message}` };
    }

    // Update eye data - First delete existing eyes and then insert new ones
    const { error: deleteEyesError } = await supabase
      .from('contact_lens_eyes')
      .delete()
      .eq('contact_lens_prescription_id', prescriptionId);

    if (deleteEyesError) {
      logError('Error deleting existing eye data:', deleteEyesError);
      return { success: false, message: `Error updating eye data: ${deleteEyesError.message}` };
    }

    // Insert new eye data
    const seenUpdate = new Set();
    const uniqueEyesUpdate = [];
    for (const eye of data.eyes) {
      const key = `${eye.eye_side}-${eye.vision_type}`;
      if (!seenUpdate.has(key)) {
        uniqueEyesUpdate.push(eye);
        seenUpdate.add(key);
      } else {
        logWarn('Duplicate eye entry detected and skipped (update):', eye);
      }
    }
    // Filter out empty eyes (all main fields empty)
    const filteredEyesUpdate = uniqueEyesUpdate.filter(eye =>
      eye.sph || eye.cyl || eye.axis || eye.add_power || eye.vn || eye.rpd || eye.lpd
    );
    logInfo('EYES TO INSERT (filtered, update):', filteredEyesUpdate);

    // Insert all eyes in a single batch
    if (filteredEyesUpdate.length > 0) {
      const { error: eyeError } = await supabase
        .from('contact_lens_eyes')
        .insert(filteredEyesUpdate.map(eye => ({
          contact_lens_prescription_id: prescriptionId,
          eye_side: eye.eye_side,
          vision_type: eye.vision_type,
          sph: eye.sph || null,
          cyl: eye.cyl || null,
          axis: eye.axis || null,
          add_power: eye.add_power || null,
          vn: eye.vn || null,
          rpd: eye.rpd || null,
          lpd: eye.lpd || null,
          ipd: eye.ipd || null
        })));
      if (eyeError) {
        logError('Error saving eyes batch (update):', eyeError);
        throw new Error(`Error updating eyes: ${eyeError.message}`);
      }
      logInfo('All eyes updated successfully');
    }

    // Update items - First delete existing items and then insert new ones
    const { error: deleteItemsError } = await supabase
      .from('contact_lens_items')
      .delete()
      .eq('contact_lens_prescription_id', prescriptionId);

    if (deleteItemsError) {
      logError('Error deleting existing items:', deleteItemsError);
      return { success: false, message: `Error updating items: ${deleteItemsError.message}` };
    }

    // Insert new items
    const itemInsertPromises = data.items.map(async (item, index) => {
      const { error: itemError } = await supabase
        .from('contact_lens_items')
        .insert({
          contact_lens_prescription_id: prescriptionId,
          eye_side: item.eye_side, // Use the exact value as it should be 'Left', 'Right', or 'Both'
          base_curve: item.base_curve || null,
          power: item.power || null,
          material: item.material || null,
          dispose: item.dispose || null,
          brand: item.brand || null,
          diameter: item.diameter || null,
          quantity: item.quantity,
          rate: item.rate,
          sph: item.sph || null,
          cyl: item.cyl || null,
          axis: item.axis || null,
          lens_code: item.lens_code || null
        });

      if (itemError) {
        throw new Error(`Error updating item ${index + 1}: ${itemError.message}`);
      }
      return true;
    });

    try {
      await Promise.all(itemInsertPromises);
    } catch (itemError) {
      logError('Error updating items:', itemError);
      return { success: false, message: itemError instanceof Error ? itemError.message : 'Error updating items' };
    }

    // Update payment data
    // First, get the payment record to get its ID which we need for the upsert
    const { data: existingPayment, error: fetchPaymentError } = await supabase
      .from('contact_lens_payments')
      .select('id')
      .eq('contact_lens_prescription_id', prescriptionId)
      .single();
      
    if (fetchPaymentError) {
      logError('Error fetching payment record:', fetchPaymentError);
      return { success: false, message: `Error fetching payment record: ${fetchPaymentError.message}` };
    }
    
    // Calculate the adjusted estimate by subtracting the discount amount
    // This ensures the generated balance (estimate - advance) will match the UI calculation (estimate - advance - discount)
    const discountAmount = data.payment.discount_amount || 0;
    const originalEstimate = data.payment.estimate || 0;
    const effectiveEstimate = Math.max(0, originalEstimate - discountAmount);
    
    // Calculate the total payment from items
    const paymentTotal = data.items.reduce((total, item) => {
      return total + (item.quantity || 0) * (item.rate || 0);
    }, 0);
    
    // Use upsert instead of update to avoid CORS issues
    const { error: paymentError } = await supabase
      .from('contact_lens_payments')
      .upsert({
        id: existingPayment.id, // Include the ID to ensure we update existing record
        contact_lens_prescription_id: prescriptionId,
        payment_total: paymentTotal, // Set the payment_total from items
        estimate: effectiveEstimate, // Use adjusted estimate that accounts for discount
        advance: data.payment.advance,
        payment_mode: data.payment.payment_mode,
        cash_advance: data.payment.cash_advance,
        card_upi_advance: data.payment.card_upi_advance,
        cheque_advance: data.payment.cheque_advance,
        discount_amount: data.payment.discount_amount,
        payment_date: data.payment.payment_date || new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      });

    if (paymentError) {
      logError('Error updating payment data:', paymentError);
      return { success: false, message: `Error updating payment data: ${paymentError.message}` };
    }

    return {
      success: true,
      message: 'Contact lens prescription updated successfully',
      id: prescriptionId
    };

  } catch (error) {
    logError('Unexpected error updating contact lens prescription:', error);
    return {
      success: false,
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Delete a contact lens prescription
 * This will cascade delete all related eyes, items, and payment data
 */
export const deleteContactLensPrescription = async (prescriptionId: string) => {
  try {
    // Delete the prescription record - due to cascade constraints,
    // this will automatically delete related eyes, items, and payment
    const { error } = await supabase
      .from('contact_lens_prescriptions')
      .delete()
      .eq('id', prescriptionId);

    if (error) {
      logError('Error deleting contact lens prescription:', error);
      return { success: false, message: `Error deleting contact lens prescription: ${error.message}` };
    }

    return {
      success: true,
      message: 'Contact lens prescription deleted successfully'
    };
  } catch (error) {
    logError('Unexpected error deleting contact lens prescription:', error);
    return {
      success: false,
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Search for contact lens patients by various fields
 * This will search across both the main prescriptions table and contact_lens_prescriptions
 * @param searchField - Field to search in (prescription_no, ref_no, name, mobile)
 * @param searchValue - Value to search for
 */
export const searchContactLensPatients = async (searchField: string, searchValue: string) => {
  try {
    if (!searchValue.trim()) {
      return { success: false, message: 'Search value cannot be empty', data: [] };
    }

    logInfo(`Searching for ${searchField} with value: ${searchValue}`);
    
    // Different search logic based on the field
    switch (searchField) {
      case 'prescription_no':
        // Search by prescription number in the main prescriptions table
        const { data: prescriptionData, error: prescriptionError } = await supabase
          .from('prescriptions')
          .select(`
            id,
            prescription_no,
            name,
            gender,
            age,
            class,
            prescribed_by,
            mobile_no,
            email,
            address,
            city,
            state,
            pin_code,
            date,
            birth_day,
            marriage_anniversary
          `)
          .ilike('prescription_no', `%${searchValue}%`);

        if (prescriptionError) {
          logError('Error searching prescriptions:', prescriptionError);
          return { success: false, message: `Error searching: ${prescriptionError.message}`, data: [] };
        }

        // For each found prescription, get any contact lens data
        const prescriptionResults = await Promise.all(prescriptionData.map(async (prescription) => {
          logDebug('SERVICE DEBUG | prescription.id', { id: prescription.id, style: 'color: red; font-weight: bold;' });
          const { data: contactLensData } = await supabase
            .from('contact_lens_prescriptions')
            .select(`
              id,
              prescription_id,
              booked_by,
              delivery_date,
              delivery_time,
              status,
              retest_date,
              expiry_date,
              remarks,
              birth_day,
              marriage_anniversary
            `)
            .eq('prescription_id', prescription.id)
            .maybeSingle();
          logDebug('SERVICE DEBUG | contactLensData.prescription_id', { prescription_id: contactLensData?.prescription_id, style: 'color: red; font-weight: bold;' });
          logInfo('🔍 SERVICE DEBUG | contactLensData:', contactLensData);
          const merged = {
            ...prescription,
            contactLensData: contactLensData || null,
            birth_day: contactLensData?.birth_day || prescription.birth_day || null,
            marriage_anniversary: contactLensData?.marriage_anniversary || prescription.marriage_anniversary || null
          };
          logInfo('🔍 SERVICE DEBUG | merged:', merged);
          return merged;
        }));

        return { 
          success: true, 
          message: `Found ${prescriptionResults.length} matching prescriptions`, 
          data: prescriptionResults 
        };

      case 'mobile':
        // Search by mobile number
        const { data: mobileData, error: mobileError } = await supabase
          .from('prescriptions')
          .select(`
            id,
            prescription_no,
            name,
            gender,
            age,
            class,
            prescribed_by,
            mobile_no,
            email,
            address,
            city,
            state,
            pin_code,
            date,
            birth_day,
            marriage_anniversary
          `)
          .ilike('mobile_no', `%${searchValue}%`);

        if (mobileError) {
          logError('Error searching by mobile:', mobileError);
          return { success: false, message: `Error searching: ${mobileError.message}`, data: [] };
        }

        // For each found prescription, get any contact lens data
        const mobileResults = await Promise.all(mobileData.map(async (prescription) => {
          const { data: contactLensData } = await supabase
            .from('contact_lens_prescriptions')
            .select(`
              id,
              prescription_id,
              booked_by,
              delivery_date,
              delivery_time,
              status,
              retest_date,
              expiry_date,
              remarks,
              birth_day,
              marriage_anniversary
            `)
            .eq('prescription_id', prescription.id)
            .maybeSingle();

          return {
            ...prescription,
            contactLensData: contactLensData || null,
            // Merge birth_day and marriage_anniversary for UI autopopulation
            birth_day: contactLensData?.birth_day || prescription.birth_day || null,
            marriage_anniversary: contactLensData?.marriage_anniversary || prescription.marriage_anniversary || null
          };
        }));

        return { 
          success: true, 
          message: `Found ${mobileResults.length} matching patients`, 
          data: mobileResults 
        };

      case 'name':
        // Search by patient name
        const { data: nameData, error: nameError } = await supabase
          .from('prescriptions')
          .select(`
            id,
            prescription_no,
            name,
            gender,
            age,
            class,
            prescribed_by,
            mobile_no,
            email,
            address,
            city,
            state,
            pin_code,
            date,
            birth_day,
            marriage_anniversary
          `)
          .ilike('name', `%${searchValue}%`);

        if (nameError) {
          logError('Error searching by name:', nameError);
          return { success: false, message: `Error searching: ${nameError.message}`, data: [] };
        }

        // For each found prescription, get any contact lens data
        const nameResults = await Promise.all(nameData.map(async (prescription) => {
          const { data: contactLensData } = await supabase
            .from('contact_lens_prescriptions')
            .select(`
              id,
              prescription_id,
              booked_by,
              delivery_date,
              delivery_time,
              status,
              retest_date,
              expiry_date,
              remarks,
              birth_day,
              marriage_anniversary
            `)
            .eq('prescription_id', prescription.id)
            .maybeSingle();

          return {
            ...prescription,
            contactLensData: contactLensData || null,
            // Merge birth_day and marriage_anniversary for UI autopopulation
            birth_day: contactLensData?.birth_day || prescription.birth_day || null,
            marriage_anniversary: contactLensData?.marriage_anniversary || prescription.marriage_anniversary || null
          };
        }));

        return { 
          success: true, 
          message: `Found ${nameResults.length} matching patients`, 
          data: nameResults 
        };

      case 'ref_no':
        // Search by reference number in contact_lens_prescriptions (exact match)
        const { data: clData, error: clError } = await supabase
          .from('contact_lens_prescriptions')
          .select(`
            id,
            prescription_id,
            reference_no,
            booked_by,
            delivery_date,
            delivery_time,
            status,
            retest_date,
            expiry_date,
            remarks,
            birth_day,
            marriage_anniversary
          `)
          .eq('reference_no', searchValue);

        if (clError) {
          logError('Error searching contact lens prescriptions by reference number:', clError);
          return { success: false, message: `Error searching: ${clError.message}`, data: [] };
        }

        // For each found contact lens prescription, get the related customer info from prescriptions
        const clResults = await Promise.all(clData.map(async (cl) => {
          const { data: prescription } = await supabase
            .from('prescriptions')
            .select(`
              id,
              prescription_no,
              name,
              gender,
              age,
              class,
              prescribed_by,
              mobile_no,
              email,
              address,
              city,
              state,
              pin_code,
              date,
              birth_day,
              marriage_anniversary
            `)
            .eq('id', cl.prescription_id)
            .maybeSingle();

          return {
            ...prescription,
            contactLensData: cl,
            birth_day: cl.birth_day || prescription?.birth_day || null,
            marriage_anniversary: cl.marriage_anniversary || prescription?.marriage_anniversary || null
          };
        }));

        return { 
          success: true, 
          message: `Found ${clResults.length} matching contact lens prescriptions`, 
          data: clResults 
        };

      default:
        return { success: false, message: 'Invalid search field', data: [] };
    }
  } catch (error) {
    logError('Unexpected error during search:', error);
    return {
      success: false,
      message: `Search error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: []
    };
  }
};

/**
 * Get detailed contact lens prescription data for a patient
 * This fetches all the eye data, items, and payment information
 * to fully populate the contact lens form
 */
export const getDetailedContactLensData = async (contactLensPrescriptionId: string) => {
  try {
    // Get the basic prescription data
    const { data: prescription, error: prescriptionError } = await supabase
      .from('contact_lens_prescriptions')
      .select('*')
      .eq('id', contactLensPrescriptionId)
      .single();
    
    // Add red debug logs for key fields
    logDebug('DETAILED DEBUG | contact_lens_prescriptions.id', { id: prescription?.id, style: 'color: red; font-weight: bold;' });
    logDebug('DETAILED DEBUG | contact_lens_prescriptions.prescription_id', { prescription_id: prescription?.prescription_id, style: 'color: red; font-weight: bold;' });
    logDebug('DETAILED DEBUG | contact_lens_prescriptions.birth_day', { birth_day: prescription?.birth_day, style: 'color: red; font-weight: bold;' });
    logDebug('DETAILED DEBUG | contact_lens_prescriptions.marriage_anniversary', { marriage_anniversary: prescription?.marriage_anniversary, style: 'color: red; font-weight: bold;' });
    
    if (prescriptionError) {
      logError('Error fetching prescription details:', prescriptionError);
      return { success: false, message: `Error fetching details: ${prescriptionError.message}` };
    }
    
    // Get the main prescription data (customer info)
    const { data: mainPrescriptionData, error: mainError } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('id', prescription.prescription_id)
      .single();
    const mainPrescription = mainPrescriptionData as DatabasePrescription | null;
    
    if (mainError) {
      logError('Error fetching main prescription:', mainError);
      return { success: false, message: `Error fetching customer info: ${mainError.message}` };
    }
    
    // Get eye data
    const { data: eyesData, error: eyesError } = await supabase
      .from('contact_lens_eyes')
      .select('*')
      .eq('contact_lens_prescription_id', contactLensPrescriptionId);
    
    if (eyesError) {
      logError('Error fetching eye data:', eyesError);
      return { success: false, message: `Error fetching eye data: ${eyesError.message}` };
    }
    
    // Get items
    const { data: items, error: itemsError } = await supabase
      .from('contact_lens_items')
      .select('*')
      .eq('contact_lens_prescription_id', contactLensPrescriptionId)
      .order('item_index', { ascending: true });
    
    if (itemsError) {
      logError('Error fetching items:', itemsError);
      return { success: false, message: `Error fetching items: ${itemsError.message}` };
    }
    
    // Get payment data
    const { data: payment, error: paymentError } = await supabase
      .from('contact_lens_payments')
      .select('*')
      .eq('contact_lens_prescription_id', contactLensPrescriptionId)
      .single();
    
    if (paymentError) {
      logError('Error fetching payment data:', paymentError);
      return { success: false, message: `Error fetching payment data: ${paymentError.message}` };
    }
    
    // Log what we're loading from the database
    logInfo('DATABASE VALUES BEING LOADED:', {
      items: items,
      payment: payment
    });
      
    // Map items to include all necessary fields with proper naming
    // Also convert database side values to UI side values
    const mappedItems = items.map((item, index) => {
      // Strictly parse all values as numbers with fallbacks to 0
      const qty = parseFloat(item.quantity) || 1;
      const rate = parseFloat(item.rate) || 0;
      
      // Calculate expected total before discount
      const expectedBaseTotal = qty * rate;
      
      // Get discount values directly from database with fallbacks to 0
      // Force parsing as numbers to avoid type issues
      let discountPercent = parseFloat(item.discount_percent) || 0;
      let discountAmount = parseFloat(item.discount_amount) || 0;
      let finalAmount = parseFloat(item.final_amount) || 0;
      
      // If finalAmount is 0 or equal to base amount, but we have a discount percent, recalculate
      if ((finalAmount === 0 || finalAmount === expectedBaseTotal) && discountPercent > 0) {
        // Recalculate discount amount and final amount
        discountAmount = expectedBaseTotal * (discountPercent / 100);
        finalAmount = expectedBaseTotal - discountAmount;
      }
      
      // If we have a discount amount but no percent, calculate the percent
      if (discountAmount > 0 && discountPercent === 0 && expectedBaseTotal > 0) {
        discountPercent = (discountAmount / expectedBaseTotal) * 100;
      }
      
      // Enhanced logging of what we're loading
      logInfo(`Item ${index + 1} values from database:`, {
        qty,
        rate,
        expectedBaseTotal,
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        final_amount: finalAmount,
      });
      
      // Debug log the raw eye_side value from database
      logInfo('Raw eye_side from DB:', item.eye_side);
      
      // Map eye_side database values to UI values, handling case insensitivity
      const normalizedEyeSide = String(item.eye_side).toLowerCase().trim();
      let sideValue = '';
      
      if (['right', 'r', 're', 'od'].includes(normalizedEyeSide)) {
        sideValue = 'RE';
      } else if (['left', 'l', 'le', 'os'].includes(normalizedEyeSide)) {
        sideValue = 'LE';
      }
      
      return {
        // Map the normalized eye side to UI format
        side: sideValue,
        
        // Map other fields to UI format
        si: index + 1,                   // Serial number
        bc: item.base_curve || '',       // Base curve
        power: item.power || '',         // Power
        material: item.material || '',   // Material
        dispose: item.dispose || '',     // Dispose
        brand: item.brand || '',         // Brand
        diameter: item.diameter || '',   // Diameter
        qty: item.quantity || 1,         // Quantity
        rate: item.rate || 0,            // Rate
        
        // Convert discount fields from snake_case to camelCase for UI
        discountPercent: discountPercent,  // Discount percentage
        discountAmount: discountAmount,    // Direct from database
        amount: finalAmount,              // Direct from database
        
        // Other fields
        sph: item.sph || '',             // Spherical
        cyl: item.cyl || '',             // Cylindrical
        ax: item.axis || '',             // Axis
        lensCode: item.lens_code || ''   // Lens code
      };
    });
    
    // Combine all data
    const detailedData = {
      prescription: {
        ...mainPrescription,
        ...prescription,
        // For fields that may exist in both, prefer contact lens-specific (prescription) values if present
        name: prescription.name || mainPrescription?.name || null,
        gender: prescription.gender || mainPrescription?.gender || null,
        age: prescription.age || mainPrescription?.age || null,
        mobile: prescription.mobile || mainPrescription?.mobile_no || null,
        email: prescription.email || mainPrescription?.email || null,
        address: prescription.address || mainPrescription?.address || null,
        city: prescription.city || mainPrescription?.city || null,
        state: prescription.state || mainPrescription?.state || null,
        pin: prescription.pin || mainPrescription?.pin_code || null,
        reference_no: prescription.reference_no || mainPrescription?.reference_no || null,
        customer_code: prescription.customer_code || mainPrescription?.customer_code || null,
        birth_day: prescription.birth_day || mainPrescription?.birth_day || null,
        marriage_anniversary: prescription.marriage_anniversary || mainPrescription?.marriage_anniversary || null,
        phone_landline: prescription.phone_landline || mainPrescription?.phone_landline || null,
        prescribed_by: prescription.prescribed_by || mainPrescription?.prescribed_by || null
      },
      eyes: eyesData || [],
      items: mappedItems,
      payment
    };
    
    return {
      success: true,
      message: 'Data retrieved successfully',
      data: detailedData
    };
    
  } catch (error) {
    logError('Unexpected error retrieving detailed data:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Navigation methods for Contact Lens Card (First, Last, Prev, Next)
 * All use updated_at for ordering and hydrate the full record for the form
 */
export const getFirstContactLens = async () => {
  // Get the oldest (first) contact lens prescription by created_at
  const { data, error } = await supabase
    .from('contact_lens_prescriptions')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { success: false, message: error?.message || 'No records found', data: null };
  return await getDetailedContactLensData(data.id);
};

export const getLastContactLens = async () => {
  // Get the most recent (last) contact lens prescription by created_at
  const { data, error } = await supabase
    .from('contact_lens_prescriptions')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { success: false, message: error?.message || 'No records found', data: null };
  return await getDetailedContactLensData(data.id);
};

export const getPrevContactLens = async (currentUpdatedAt: string) => {
  // Get the previous contact lens prescription (older than current)
  const { data, error } = await supabase
    .from('contact_lens_prescriptions')
    .select('id, updated_at')
    .lt('updated_at', currentUpdatedAt)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { success: false, message: error?.message || 'No previous record', data: null };
  return await getDetailedContactLensData(data.id);
};

export const getNextContactLens = async (currentUpdatedAt: string) => {
  // Get the next contact lens prescription (newer than current)
  const { data, error } = await supabase
    .from('contact_lens_prescriptions')
    .select('id, updated_at')
    .gt('updated_at', currentUpdatedAt)
    .order('updated_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { success: false, message: error?.message || 'No next record', data: null };
  return await getDetailedContactLensData(data.id);
};

// Export as a service object
export const contactLensService = {
  saveContactLensPrescription,
  getContactLensPrescription,
  getContactLensPrescriptionsByPrescriptionId,
  updateContactLensPrescription,
  deleteContactLensPrescription,
  searchContactLensPatients,
  getDetailedContactLensData,
  generateContactLensPrescriptionNo,
  getFirstContactLens,
  getLastContactLens,
  getPrevContactLens,
  getNextContactLens,
  saveOrUpdateContactLensData
};
