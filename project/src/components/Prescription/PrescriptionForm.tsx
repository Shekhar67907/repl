import React, { useState, useEffect } from 'react';
import Dialog from '../ui/Dialog';
import PrintOptionsDialog from '../ui/PrintOptionsDialog';
import ToastNotification from '../ui/ToastNotification';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Checkbox from '../ui/Checkbox';
import RadioGroup from '../ui/RadioGroup';
import Button from '../ui/Button';
import { 
  PrescriptionData
} from '../../types';
import { printOrderCard } from '../../utils/printOrderService';
import { 
  generatePrescriptionNo, 
  calculateIPD, 
  getTodayDate,
  getNextMonthDate,
  titleOptions,
  classOptions,
  prescribedByOptions
} from '../../utils/helpers';
import {
  validatePrescriptionData,
  formatPrescriptionNumber
} from '../../utils/prescriptionUtils';
import LensPrescriptionSection from './LensPrescriptionSection';
import { useNavigate } from 'react-router-dom';
import { logInfo, logError, logDebug, logDev, logWarn } from '../../utils/logger';
import { supabase } from '../../Services/supabaseService';

interface PrescriptionFormProps {
  onSubmit: (data: PrescriptionData) => void;
  initialData?: PrescriptionData;
  onFirst?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onLast?: () => void;
}

const PrescriptionForm: React.FC<PrescriptionFormProps> = ({ onSubmit, initialData, onFirst, onPrev, onNext, onLast }) => {
  // Use initialData if provided, otherwise use default values
  const [formData, setFormData] = useState<PrescriptionData>(initialData || {
    prescriptionNo: generatePrescriptionNo(),
    referenceNo: '',
    class: '',
    prescribedBy: '',
    date: getTodayDate(),
    name: '',
    title: 'Mr.',
    age: '',
    gender: 'Male',
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
    bookingBy: '',
    rightEye: {
      dv: { sph: '', cyl: '', ax: '', add: '', vn: '', rpd: '' },
      nv: { sph: '', cyl: '', ax: '', add: '', vn: '' }
    },
    leftEye: {
      dv: { sph: '', cyl: '', ax: '', add: '', vn: '', lpd: '' },
      nv: { sph: '', cyl: '', ax: '', add: '', vn: '' }
    },
    remarks: {
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
    retestAfter: getNextMonthDate(),
    others: '',
    balanceLens: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error'; visible: boolean}>({message: '', type: 'error', visible: false});
  const [isSaving] = useState(false);
  const [showSaveConfirmDialog, setShowSaveConfirmDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showPrintOptionsDialog, setShowPrintOptionsDialog] = useState(false);
  const navigate = useNavigate();

  // Update form data when initialData changes (when a search result is selected)
  useEffect(() => {
    if (initialData) {
      logInfo('Updating form with initialData', { prescriptionNo: initialData.prescriptionNo, initialData });
      setFormData(initialData);
    }
  }, [initialData]);
  
  // Force prescription number to be set correctly when component loads
  useEffect(() => {
    // If prescription number is empty, generate a new one
    if (!formData.prescriptionNo) {
      const newPrescriptionNo = generatePrescriptionNo();
      logInfo('Setting new prescription number', { newPrescriptionNo });
      setFormData(prev => ({
        ...prev,
        prescriptionNo: newPrescriptionNo,
        // Also set reference number if it's empty
        referenceNo: prev.referenceNo || newPrescriptionNo
      }));
    }
  }, []);

  // Handle initial reference number setting and IPD calculation
  useEffect(() => {
    // Set reference number same as prescription number initially if empty
    if (!formData.referenceNo) {
      setFormData(prev => ({ ...prev, referenceNo: prev.prescriptionNo }));
    }
    
    // Calculate IPD from RPD and LPD
    const calculatedIPD = calculateIPD(formData.rightEye.dv.rpd, formData.leftEye.dv.lpd);
    if (calculatedIPD) {
      setFormData(prev => ({ ...prev, ipd: calculatedIPD }));
    }
  }, [formData.prescriptionNo, formData.rightEye.dv.rpd, formData.leftEye.dv.lpd]);
  
  // Handle copying DV values to NV when DV values change
  useEffect(() => {
    // Copy DV values to NV for right eye if NV values are empty
    if (formData.rightEye.dv.sph && !formData.rightEye.nv.sph) {
      setFormData(prev => ({
        ...prev,
        rightEye: {
          ...prev.rightEye,
          nv: { ...prev.rightEye.dv, rpd: prev.rightEye.dv.rpd }
        }
      }));
    }
  }, [formData.rightEye.dv, formData.rightEye.nv.sph]);
  
  // Handle copying DV values to NV for left eye
  useEffect(() => {
    if (formData.leftEye.dv.sph && !formData.leftEye.nv.sph) {
      setFormData(prev => ({
        ...prev,
        leftEye: {
          ...prev.leftEye,
          nv: { ...prev.leftEye.dv, lpd: prev.leftEye.dv.lpd }
        }
      }));
    }
  }, [formData.leftEye.dv, formData.leftEye.nv.sph]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const missingFields: string[] = [];
    
    logDebug('validateForm called', { balanceLens: formData.balanceLens, leftEyeDv: formData.leftEye.dv });
    
    if (!formData.prescribedBy) {
      newErrors.prescribedBy = 'Prescribed By is required';
      missingFields.push('Prescribed By');
    }
    
    if (!formData.name) {
      newErrors.name = 'Name is required';
      missingFields.push('Name');
    }

    // Validate right eye prescription
    const rightEyeErrors = validatePrescriptionData(formData.rightEye.dv, false);
    rightEyeErrors.forEach(error => {
      newErrors[`rightEye.dv.${error.field}`] = error.message;
      missingFields.push(`Right Eye ${error.field.toUpperCase()} - ${error.message}`);
    });

    // Validate left eye prescription, considering balance lens
    const leftEyeErrors = validatePrescriptionData(formData.leftEye.dv, formData.balanceLens);
    logDebug('Left eye validation', { isBalanceLens: formData.balanceLens, leftEyeDv: formData.leftEye.dv, errors: leftEyeErrors });
    
    leftEyeErrors.forEach(error => {
      newErrors[`leftEye.dv.${error.field}`] = error.message;
      missingFields.push(`Left Eye ${error.field.toUpperCase()} - ${error.message}`);
    });
    
    setErrors(newErrors);
    logInfo('PrescriptionForm: validateForm result', { isValid: Object.keys(newErrors).length === 0, newErrors });
    
    // Show toast notification if there are any errors
    if (missingFields.length > 0) {
      const message = missingFields.length === 1
        ? `Please fill the required field: ${missingFields[0]}`
        : `Please fill all required fields (${missingFields.length} missing)`;
        
      setNotification({
        message: message,
        type: 'error',
        visible: true
      });
    }
    
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (!name) {
      logError('[handleChange] Missing name on event target', undefined, { event: e });
      return;
    }

    // Prevent changes to left eye DV fields when balance lens is active
    if (formData.balanceLens && name.startsWith('leftEye.dv.')) {
      const field = name.split('.').pop();
      if (field === 'sph' || field === 'cyl' || field === 'ax') {
        logDebug('Preventing change to left eye field when balance lens is active', { name });
        return;
      }
    }

    // Handle nested properties
    if (name.includes('.')) {
      const [parent, child, grandchild] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof PrescriptionData] as object),
          [child]: grandchild 
            ? { 
                ...(prev[parent as keyof PrescriptionData] as any)[child],
                [grandchild]: value 
              }
            : value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    // Clear error when field is filled
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    logDebug('handleCheckboxChange called', { name, checked });
    
    if (name === 'balanceLens') {
      setFormData(prev => {
        const newState = {
          ...prev,
          balanceLens: checked
        };
        
        // When balance lens is checked, copy right eye values to left eye
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
    } else if (name.includes('.')) {
      // Handle nested checkbox properties
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof PrescriptionData] as object),
          [child]: checked
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    }
  };
  

  const handleNumericInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Prevent changes to left eye DV fields when balance lens is active
    if (formData.balanceLens && name.startsWith('leftEye.dv.')) {
      const field = name.split('.').pop();
      if (field === 'sph' || field === 'cyl' || field === 'ax') {
        logDebug('Preventing numeric change to left eye field when balance lens is active', { name });
        return;
      }
    }

    // Format the value based on field type
    let formattedValue = value;
    
    // Apply validation and formatting based on field type
    if (name.includes('sph')) {
      formattedValue = formatPrescriptionNumber(value, 'SPH');
    } else if (name.includes('cyl')) {
      formattedValue = formatPrescriptionNumber(value, 'CYL');
    } else if (name.includes('ax')) {
      formattedValue = formatPrescriptionNumber(value, 'AX');
    } else if (name.includes('add')) {
      formattedValue = formatPrescriptionNumber(value, 'ADD');
    } else if (name.includes('rpd') || name.includes('lpd')) {
      // For RPD and LPD, allow direct input without formatting
      formattedValue = value;
    }

    // Call handleChange with a proper event object
    handleChange({
      target: {
        name,
        value: formattedValue
      }
    } as React.ChangeEvent<HTMLInputElement>);
  };

  // Helper functions for future implementation
  // Note: This function is kept for future use but marked with a comment to avoid lint warnings
  /* const calculateVnDivision = (value: string): string => {
    if (!value.startsWith('6/')) return value;
    const denominator = value.substring(2);
    if (!denominator || denominator === '0') return value;
    
    const result = 6 / parseInt(denominator, 10);
    // Only show division result if it's a clean number
    if (Number.isInteger(result)) {
      return `6/${denominator} (${result})`;
    }
    return value;
  }; */

  // Helper to check reference number uniqueness
  const validateReferenceNumber = async (referenceNo: string, currentId?: string): Promise<boolean> => {
    if (!referenceNo) return true;
    let query = supabase
      .from('prescriptions')
      .select('id')
      .eq('reference_no', referenceNo);
    if (currentId) {
      query = query.neq('id', currentId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      logError('Error validating reference number:', error);
      setNotification({
        message: 'Error validating reference number. Please try again.',
        type: 'error',
        visible: true
      });
      return false;
    }
    if (data) {
      setNotification({
        message: 'This reference number is already in use. Please use a different one.',
        type: 'error',
        visible: true
      });
      return false;
    }
    return true;
  };

  // Helper to check prescription number uniqueness
  const validatePrescriptionNo = async (prescriptionNo: string, currentId?: string): Promise<boolean> => {
    if (!prescriptionNo) return true;
    let query = supabase
      .from('prescriptions')
      .select('id')
      .eq('prescription_no', prescriptionNo);
    if (currentId) {
      query = query.neq('id', currentId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      logError('Error validating prescription number:', error);
      setNotification({
        message: 'Error validating prescription number. Please try again.',
        type: 'error',
        visible: true
      });
      return false;
    }
    if (data) {
      setNotification({
        message: 'This prescription number is already in use. Please use a different one.',
        type: 'error',
        visible: true
      });
      return false;
    }
    return true;
  };

  const manualSave = async () => {
    // Prescription number uniqueness check before saving
    if (formData.prescriptionNo) {
      const isUnique = await validatePrescriptionNo(formData.prescriptionNo, (formData as any).id);
      if (!isUnique) return { success: false };
    }
    // Reference number uniqueness check before saving
    if (formData.referenceNo) {
      const isValid = await validateReferenceNumber(formData.referenceNo, (formData as any).id);
      if (!isValid) return { success: false };
    }
    try {
      // Call the onSubmit prop with the form data
      onSubmit(formData);
      return { success: true };
    } catch (error) {
      logError('Error in manualSave', error, { prescriptionNo: formData.prescriptionNo });
      return { success: false };
    }
  };

  // Handler for the first confirmation dialog (Yes button)
  const handleSaveConfirm = async () => {
    setShowSaveConfirmDialog(false);
    
    try {
      const result = await manualSave();
      if (result && result.success) {
        // After saving successfully, show the print dialog
        setShowPrintDialog(true);
      } else {
        logWarn('Failed to save prescription. Please try again.', { prescriptionNo: formData.prescriptionNo });
      }
    } catch (error) {
      logError('Error saving prescription', error, { prescriptionNo: formData.prescriptionNo });
    }
  };
  
  // Handlers for the print dialog
  const handlePrintConfirm = () => {
    // Close the print confirm dialog and show the print options dialog
    setShowPrintDialog(false);
    setShowPrintOptionsDialog(true);
  };

  // Handler for printing order card
  const handlePrintOrderCard = () => {
    // Format remarks as a string
    const formatRemarks = (remarks: any): string => {
      if (!remarks) return '';
      
      // Convert the remarks object to an array of selected remarks
      const selectedRemarks = Object.entries(remarks)
        .filter(([_, value]) => value === true)
        .map(([key]) => {
          // Convert camelCase to Title Case
          return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
        });
      
      return selectedRemarks.join(', ');
    };

    // Sample order data - replace with actual data from your state/database
    const orderData = {
      orderNumber: formData.prescriptionNo || 'ORD-' + Math.floor(Math.random() * 10000),
      customerName: formData.name,
      bookingDate: new Date(),
      deliveryDate: formData.retestAfter ? new Date(formData.retestAfter) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      estimateAmount: 1000, // Replace with actual amount
      advanceAmount: 500,   // Replace with actual advance
      balanceAmount: 500,   // Replace with actual balance
      items: [
        {
          description: 'Spectacles',
          qty: 1,
          rate: 1000,
          amount: 1000
        }
      ],
      remarks: formatRemarks(formData.remarks)
    };
    
    printOrderCard(orderData);
  };

  // Handler for print options selection
  const handlePrintOptionSelected = (option: 'normal' | 'card') => {
    // Handle the selected print option
    if (option === 'normal') {
      logInfo('Print Normal Size', { prescriptionNo: formData.prescriptionNo });
      // Implement normal size printing logic
    } else if (option === 'card') {
      logInfo('Print Card Size', { prescriptionNo: formData.prescriptionNo });
      // Implement card size printing logic
    }
    
    // After printing, generate new prescription number for next entry
    setFormData(prev => ({
      ...prev,
      prescriptionNo: generatePrescriptionNo(),
      referenceNo: ''
    }));
  };
  
  const handlePrintCancel = () => {
    console.log("Cancel pressed, closing dialog");
    setShowPrintOptionsDialog(false);
    setShowPrintDialog(false);
    setFormData(prev => ({
      ...prev,
      prescriptionNo: generatePrescriptionNo(),
      referenceNo: ''
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logInfo('PrescriptionForm: handleFormSubmit triggered', { prescriptionNo: formData.prescriptionNo });
    
    // If balance lens is checked, copy right eye values to left eye before validation
    if (formData.balanceLens) {
      setFormData(prev => ({
        ...prev,
        leftEye: {
          ...prev.leftEye,
          dv: {
            ...prev.rightEye.dv,
            lpd: prev.leftEye.dv.lpd // Keep original LPD
          },
          nv: { ...prev.rightEye.nv }
        }
      }));
    }
  
    if (validateForm()) {
      // Show the first confirmation dialog instead of saving directly
      setShowSaveConfirmDialog(true);
    }
  };  

  const handleClear = () => {
    const newPrescriptionNo = generatePrescriptionNo();
    
    setFormData({
      prescriptionNo: newPrescriptionNo,
      referenceNo: newPrescriptionNo, // Set to same as prescription number
      class: '',
      prescribedBy: '',
      date: getTodayDate(),
      name: '',
      title: 'Mr.',
      age: '',
      gender: 'Male',
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
      bookingBy: '',
      rightEye: {
        dv: { sph: '', cyl: '', ax: '', add: '', vn: '', rpd: '' },
        nv: { sph: '', cyl: '', ax: '', add: '', vn: '' }
      },
      leftEye: {
        dv: { sph: '', cyl: '', ax: '', add: '', vn: '', lpd: '' },
        nv: { sph: '', cyl: '', ax: '', add: '', vn: '' }
      },
      remarks: {
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
      retestAfter: getNextMonthDate(),
      others: '',
      balanceLens: false
    });
    
    setErrors({});
  };

  // Handler for Exit button
  const handleExit = () => {
    navigate('/');
  };

  return (
    <form onSubmit={handleFormSubmit} className="w-full max-w-screen-xl mx-auto px-2 sm:px-3 md:px-4">
      {notification.visible && (
        <ToastNotification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({...notification, visible: false})}
        />
      )}
      {isSaving && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow flex flex-col items-center">
            <div className="loader mb-2" style={{ width: 32, height: 32, border: '4px solid #3b82f6', borderTop: '4px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <span className="text-blue-600 font-semibold">Saving...</span>
          </div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      
      {/* Save Confirmation Dialog - NOW RESPONSIVE */}
      <Dialog isOpen={showSaveConfirmDialog} onClose={() => setShowSaveConfirmDialog(false)} title="Confirm Save">
        <p className="text-sm text-gray-600 mb-4">Are you sure you want to save this prescription?</p>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setShowSaveConfirmDialog(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveConfirm}>Save</Button>
        </div>
      </Dialog>
      
      {/* Print Options Dialog - NOW RESPONSIVE */}
      <PrintOptionsDialog
        isOpen={showPrintOptionsDialog}
        onClose={handlePrintCancel}
        onPrintOptionSelected={handlePrintOptionSelected}
        prescriptionData={formData}
      />
      
      <Card className="mb-4 w-full">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-2 md:gap-0">
          <Button type="button" variant="outline" size="sm">
            &lt;&lt; Consultation Fee &gt;&gt;
          </Button>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <Button type="button" variant="outline" size="sm" onClick={onFirst}>
              &lt;&lt; First
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onPrev}>
              {"< Prev"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onNext}>
              Next &gt;
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onLast}>
              Last &gt;&gt;
            </Button>
          </div>
          <Button type="button" variant="outline" size="sm">
            &lt;&lt; Display Prescription History &gt;&gt;
          </Button>
        </div>
        
        {/* Header Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <Input 
              label="Prescription No.:"
              value={formData.prescriptionNo || 'P2324-' + (Math.floor(Math.random() * 900) + 100)} 
              onChange={handleChange}
              name="prescriptionNo"
            />
          </div>
          <div>
            <Input 
              label="Reference No.:" 
              value={formData.referenceNo} 
              onChange={handleChange}
              name="referenceNo"
            />
          </div>
          <div>
            <Select 
              label="Class:" 
              options={classOptions}
              value={formData.class} 
              onChange={handleChange}
              name="class"
            />
          </div>
          <div>
            <Select 
              label="Prescribed By:" 
              options={prescribedByOptions}
              value={formData.prescribedBy} 
              onChange={handleChange}
              name="prescribedBy"
              required
              error={errors.prescribedBy}
            />
          </div>
          <div>
            <Input 
              label="Booking By:" 
              value={formData.bookingBy} 
              onChange={handleChange}
              name="bookingBy"
            />
          </div>
          <div>
            <Input 
              label="Date:" 
              type="date"
              value={formData.date} 
              onChange={handleChange}
              name="date"
            />
          </div>
        </div>
        
        {/* Personal Information Section */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2 border-b pb-1">
            Personal Information (Customer's Personal Information Can Only Be Edited Through Customer Master Form)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div className="flex flex-col md:flex-row md:items-center md:space-x-2">
              <Select 
                label="Title"
                options={titleOptions}
                value={formData.title} 
                onChange={handleChange}
                name="title"
                className="w-24"
                fullWidth={false}
              />
              <Input 
                label="Name" 
                value={formData.name} 
                onChange={handleChange}
                name="name"
                required
                error={errors.name}
              />
            </div>
            <div>
              <Input 
                label="Age" 
                type="number"
                value={formData.age} 
                onChange={handleChange}
                name="age"
              />
            </div>
            <div>
              <Input 
                label="Customer Code:" 
                value={formData.customerCode} 
                onChange={handleChange}
                name="customerCode"
              />
            </div>
            
            <div>
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
            </div>
            <div>
              <Input 
                label="Birth Day:" 
                type="date"
                value={formData.birthDay} 
                onChange={handleChange}
                name="birthDay"
              />
            </div>
            <div>
              <Input 
                label="Marr Anniv:" 
                type="date"
                value={formData.marriageAnniversary} 
                onChange={handleChange}
                name="marriageAnniversary"
              />
            </div>
            
            <div className="col-span-1 md:col-span-2 lg:col-span-3">
              <Input 
                label="Address" 
                value={formData.address} 
                onChange={handleChange}
                name="address"
              />
            </div>
            
            <div>
              <Input 
                label="City" 
                value={formData.city} 
                onChange={handleChange}
                name="city"
              />
            </div>
            <div>
              <Input 
                label="State" 
                value={formData.state} 
                onChange={handleChange}
                name="state"
              />
            </div>
            <div>
              <Input 
                label="IPD:" 
                value={formData.ipd} 
                onChange={handleNumericInput}
                name="ipd"
                className="text-center"
              />
            </div>
            
            <div>
              <Input 
                label="Phone (L.L.)" 
                value={formData.phoneLandline} 
                onChange={handleChange}
                name="phoneLandline"
              />
            </div>
            <div>
              <Input 
                label="Pin" 
                value={formData.pinCode} 
                onChange={handleChange}
                name="pinCode"
              />
            </div>
            <div className="row-span-2 flex items-center justify-center">
              <div className="bg-gray-200 h-32 w-32 flex items-center justify-center border border-gray-300">
                <span className="text-gray-500 text-sm">Photo</span>
              </div>
            </div>
            
            <div>
              <Input 
                label="Mobile No." 
                value={formData.mobileNo} 
                onChange={handleChange}
                name="mobileNo"
                required
                error={errors.mobileNo}
              />
            </div>
            <div>
              <Input 
                label="Email" 
                type="email"
                value={formData.email} 
                onChange={handleChange}
                name="email"
              />
            </div>
          </div>
        </div>
        
        {/* Prescription Section */}
        <LensPrescriptionSection
          formData={{
            ...formData,
            age: parseInt(formData.age) || 0
          }}
          handleChange={handleChange}
          handleNumericInputChange={handleNumericInput}
          handleCheckboxChange={handleCheckboxChange}
          setNotification={setNotification}
          loading={isSaving}
        />
        
        {/* Remarks Section */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Remarks:</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Checkbox 
                label="FOR CONSTANT USE"
                checked={formData.remarks.forConstantUse}
                onChange={handleCheckboxChange}
                name="remarks.forConstantUse"
              />
              <Checkbox 
                label="FOR DISTANCE VISION ONLY"
                checked={formData.remarks.forDistanceVisionOnly}
                onChange={handleCheckboxChange}
                name="remarks.forDistanceVisionOnly"
              />
              <Checkbox 
                label="FOR NEAR VISION ONLY"
                checked={formData.remarks.forNearVisionOnly}
                onChange={handleCheckboxChange}
                name="remarks.forNearVisionOnly"
              />
            </div>
            <div>
              <Checkbox 
                label="SEPARATE GLASSES"
                checked={formData.remarks.separateGlasses}
                onChange={handleCheckboxChange}
                name="remarks.separateGlasses"
              />
              <Checkbox 
                label="BI FOCAL LENSES"
                checked={formData.remarks.biFocalLenses}
                onChange={handleCheckboxChange}
                name="remarks.biFocalLenses"
              />
              <Checkbox 
                label="PROGRESSIVE LENSES"
                checked={formData.remarks.progressiveLenses}
                onChange={handleCheckboxChange}
                name="remarks.progressiveLenses"
              />
            </div>
            <div>
              <Checkbox 
                label="ANTI REFLECTION LENSES"
                checked={formData.remarks.antiReflectionLenses}
                onChange={handleCheckboxChange}
                name="remarks.antiReflectionLenses"
              />
              <Checkbox 
                label="ANTI RADIATION LENSES"
                checked={formData.remarks.antiRadiationLenses}
                onChange={handleCheckboxChange}
                name="remarks.antiRadiationLenses"
              />
              <Checkbox 
                label="UNDERCORRECTED"
                checked={formData.remarks.underCorrected}
                onChange={handleCheckboxChange}
                name="remarks.underCorrected"
              />
            </div>
          </div>
        </div>
        
        {/* Additional Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <Input 
              label="Retest After" 
              type="date"
              value={formData.retestAfter} 
              onChange={handleChange}
              name="retestAfter"
            />
          </div>
          <div className="lg:col-span-3 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Others
            </label>
            <textarea
              value={formData.others}
              onChange={handleChange}
              name="others"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row justify-center items-stretch md:items-center space-y-2 md:space-y-0 md:space-x-4 mt-8">
          <Button type="submit" variant="action">
            &lt;&lt; Add Prescription &gt;&gt;
          </Button>
          <Button type="button" variant="action" onClick={handlePrintConfirm}>
            &lt;&lt; Print Prescription &gt;&gt;
          </Button>
          <Button type="button" variant="action" onClick={handleClear}>
            &lt;&lt; Clear Prescription &gt;&gt;
          </Button>
          <Button type="button" variant="action" onClick={handleExit}>
            &lt;&lt; Exit &gt;&gt;
          </Button>
        </div>
      </Card>
    </form>
  );
};

export default PrescriptionForm;