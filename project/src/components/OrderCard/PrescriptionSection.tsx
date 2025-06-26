import React, { useState, useEffect } from 'react';
import Input from '../ui/Input';
import Checkbox from '../ui/Checkbox';
import { PrescriptionFormData, EyeData } from '../types';

// Utility functions copied from LensPrescriptionSection
const calculateSphericalEquivalent = (sph: string, cyl: string): string => {
  const sphNum = parseFloat(sph);
  const cylNum = parseFloat(cyl);
  if (!isNaN(sphNum) && !isNaN(cylNum)) {
    return (sphNum + cylNum / 2).toFixed(2);
  }
  return '';
};

const formatVnValue = (value: string, forDisplay: boolean): string => {
    if (!value) return forDisplay ? '6/' : '';
  
    const cleanedValue = value.replace(/[^0-9Nn/]/g, '');
  
    if (cleanedValue.toUpperCase() === 'N') return 'N';
  
    if (cleanedValue.startsWith('6/')) {
      const parts = cleanedValue.split('/');
      if (parts.length > 1 && parts[1]) {
        return `6/${parts[1]}`;
      }
      return '6/';
    }
  
    if (!isNaN(Number(cleanedValue))) {
      return `6/${cleanedValue}`;
    }
    
    return forDisplay ? '6/' : cleanedValue;
};

interface VisualAcuity {
  status: string;
  equivalentValue: string | null;
}

const validateAndFormatVn = (vn: string): VisualAcuity => {
    const defaultResult = { status: 'Normal', equivalentValue: '20/20' };
    if (!vn || !vn.startsWith('6/')) return defaultResult;
    
    const parts = vn.split('/');
    if (parts.length !== 2 || isNaN(Number(parts[1]))) return defaultResult;
  
    const denominator = Number(parts[1]);
    
    const classification = (val: number) => {
      if (val <= 9) return { status: 'Normal', equivalentValue: '20/20' };
      if (val <= 12) return { status: 'Slightly reduced', equivalentValue: '20/40' };
      if (val <= 18) return { status: 'Reduced', equivalentValue: '20/60' };
      return { status: 'Severely reduced', equivalentValue: '20/200' };
    };
  
    return classification(denominator);
};

interface PrescriptionSectionProps {
  formData: {
    rightEye: EyeData;
    leftEye: EyeData;
    balanceLens: boolean;
    age: string | number;
    remarks?: {
      forConstantUse: boolean;
      forDistanceVisionOnly: boolean;
      forNearVisionOnly: boolean;
      separateGlasses: boolean;
      biFocalLenses: boolean;
      progressiveLenses: boolean;
      antiReflectionLenses: boolean;
      antiRadiationLenses: boolean;
      underCorrected: boolean;
    };
  } & Pick<PrescriptionFormData, 'rightEye' | 'leftEye' | 'balanceLens' | 'age' | 'remarks'>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleNumericInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCheckboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errors?: Record<string, string>;
}

const PrescriptionSection: React.FC<PrescriptionSectionProps> = ({
  formData,
  handleChange,
  handleNumericInputChange,
  handleCheckboxChange,
  errors = {}
}) => {
  
  const [vaStatus, setVaStatus] = useState<{ rightEye: VisualAcuity, leftEye: VisualAcuity }>({
    rightEye: { status: 'Normal', equivalentValue: '20/20' },
    leftEye: { status: 'Normal', equivalentValue: '20/20' },
  });

  useEffect(() => {
    setVaStatus({
      rightEye: validateAndFormatVn(formData.rightEye.dv.vn),
      leftEye: validateAndFormatVn(formData.leftEye.dv.vn)
    });
  }, [formData.rightEye.dv.vn, formData.leftEye.dv.vn]);

  // Add this function to copy DV to NV directly
  const copyDvToNv = (eye: 'rightEye' | 'leftEye') => {
    // Don't copy if balance lens is active and it's the left eye
    if (formData.balanceLens && eye === 'leftEye') {
      return;
    }
    const dv = formData[eye].dv;
    handleChange({ target: { name: `${eye}.nv.sph`, value: dv.sph } } as React.ChangeEvent<HTMLInputElement>);
    handleChange({ target: { name: `${eye}.nv.cyl`, value: dv.cyl } } as React.ChangeEvent<HTMLInputElement>);
    handleChange({ target: { name: `${eye}.nv.ax`, value: dv.ax } } as React.ChangeEvent<HTMLInputElement>);
    handleChange({ target: { name: `${eye}.nv.add`, value: dv.add } } as React.ChangeEvent<HTMLInputElement>);
    handleChange({ target: { name: `${eye}.nv.vn`, value: dv.vn } } as React.ChangeEvent<HTMLInputElement>);
  };

  // Update calculateNearVision to only calculate Sph, but always copy other fields
  const calculateNearVision = (eye: 'rightEye' | 'leftEye', e: React.FocusEvent<HTMLInputElement>) => {
    const eyeData = eye === 'rightEye' ? formData.rightEye : formData.leftEye;
    const dvSph = parseFloat(eyeData.dv.sph);
    const add = parseFloat(e.target.value);

    // Calculate NV Sph as DV Sph + Add
    if (!isNaN(dvSph) && !isNaN(add)) {
      const nvSph = (dvSph + add).toFixed(2);
      handleChange({ target: { name: `${eye}.nv.sph`, value: nvSph } } as React.ChangeEvent<HTMLInputElement>);
    }
    // Always copy other DV fields to NV
    handleChange({ target: { name: `${eye}.nv.cyl`, value: eyeData.dv.cyl } } as React.ChangeEvent<HTMLInputElement>);
    handleChange({ target: { name: `${eye}.nv.ax`, value: eyeData.dv.ax } } as React.ChangeEvent<HTMLInputElement>);
    handleChange({ target: { name: `${eye}.nv.add`, value: eyeData.dv.add } } as React.ChangeEvent<HTMLInputElement>);
    handleChange({ target: { name: `${eye}.nv.vn`, value: eyeData.dv.vn } } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleVnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
      const formattedValue = formatVnValue(value, false);
        handleChange({
      target: { name, value: formattedValue }
        } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleVnFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const { value, name } = e.target;
    if (value.trim() === 'N') {
        handleChange({
        target: { name, value: '' }
      } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const handleVnKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const { name, value } = e.currentTarget;
      const formattedValue = formatVnValue(value, true);
      handleChange({
        target: { name, value: formattedValue }
      } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-gray-700 mb-2 border-b pb-1">Lens Prescription</h3>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-[700px] md:min-w-[900px] lg:min-w-0">
        {/* Right Eye */}
          <div className="border border-gray-300 rounded p-2">
            <h4 className="font-bold text-center mb-2 text-blue-600">Right (Normal) - {vaStatus.rightEye.status}</h4>
            <table className="w-full border-collapse">
            <thead>
                <tr>
                  <th className="border border-gray-300 p-1 text-xs"></th>
                  <th className="border border-gray-300 p-1 text-xs">Sph</th>
                  <th className="border border-gray-300 p-1 text-xs">Cyl</th>
                  <th className="border border-gray-300 p-1 text-xs">Ax</th>
                  <th className="border border-gray-300 p-1 text-xs">Add</th>
                  <th className="border border-gray-300 p-1 text-xs">Va</th>
                  <th className="border border-gray-300 p-1 text-xs">RPD</th>
                  <th className="border border-gray-300 p-1 text-xs">SE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-1 text-sm font-medium text-left">D.V</td>
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.dv.sph} value={formData.rightEye.dv.sph} name="rightEye.dv.sph" onChange={handleNumericInputChange} className="w-full text-center text-sm px-1 sm:px-2 py-1" error={errors['rightEye.dv.sph']} /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.dv.cyl} value={formData.rightEye.dv.cyl} name="rightEye.dv.cyl" onChange={handleNumericInputChange} className="w-full text-center text-sm px-1 sm:px-2 py-1" error={errors['rightEye.dv.cyl']} /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.dv.ax} value={formData.rightEye.dv.ax} name="rightEye.dv.ax" onChange={handleChange} className="w-full text-center text-sm px-1 sm:px-2 py-1" error={errors['rightEye.dv.ax']} /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.dv.add} value={formData.rightEye.dv.add} name="rightEye.dv.add" onChange={handleNumericInputChange} onBlur={(e) => calculateNearVision('rightEye', e)} className="w-full text-center text-sm px-1 sm:px-2 py-1" error={errors['rightEye.dv.add']} /></td>
                <td className="border border-gray-300 p-1 relative">
                  <Input 
                      title={formData.rightEye.dv.vn}
                    value={formData.rightEye.dv.vn} 
                    name="rightEye.dv.vn" 
                    onChange={handleVnChange} 
                    onFocus={(e) => {
                      handleVnFocus(e);
                      copyDvToNv('rightEye');
                    }} 
                    onKeyDown={handleVnKeyDown} 
                      className="w-full text-center text-sm px-1 sm:px-2 py-1"
                      placeholder="6/"
                    error={errors['rightEye.dv.vn']}
                    />
                </td>
                  <td className="border border-gray-300 p-1"><Input 
                    title={formData.rightEye.dv.rpd}
                    value={formData.rightEye.dv.rpd} 
                    name="rightEye.dv.rpd" 
                    onChange={handleNumericInputChange} 
                    helperText="Valid range: 25-38mm" 
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && (value < 25 || value > 38)) {
                        alert(`RPD must be between 25-38mm. You entered: ${value}mm`);
                      }
                    }} 
                    className="w-full text-center text-sm px-1 sm:px-2 py-1" 
                    error={errors['rightEye.dv.rpd']}
                  /></td>
                  <td className="border border-gray-300 p-1 text-sm text-gray-600 text-center">{calculateSphericalEquivalent(formData.rightEye.dv.sph, formData.rightEye.dv.cyl)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-1 text-sm font-medium text-left">N.V</td>
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.nv.sph} value={formData.rightEye.nv.sph} name="rightEye.nv.sph" onChange={handleNumericInputChange} className="w-full text-center text-sm px-1 sm:px-2 py-1" /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.nv.cyl} value={formData.rightEye.nv.cyl} name="rightEye.nv.cyl" onChange={handleNumericInputChange} className="w-full text-center text-sm px-1 sm:px-2 py-1" /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.nv.ax} value={formData.rightEye.nv.ax} name="rightEye.nv.ax" onChange={handleChange} className="w-full text-center text-sm px-1 sm:px-2 py-1" /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.nv.add} value={formData.rightEye.nv.add} name="rightEye.nv.add" onChange={handleNumericInputChange} className="w-full text-center text-sm px-1 sm:px-2 py-1" /></td>
                <td className="border border-gray-300 p-1">
                  <Input 
                      title={formData.rightEye.nv.vn}
                    value={formData.rightEye.nv.vn} 
                    name="rightEye.nv.vn" 
                      onChange={handleVnChange}
                      className="w-full text-center text-sm px-1 sm:px-2 py-1"
                  />
                </td>
                <td className="border border-gray-300 p-1"></td>
                  <td className="border border-gray-300 p-1 text-sm text-gray-600 text-center">{calculateSphericalEquivalent(formData.rightEye.nv.sph, formData.rightEye.nv.cyl)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Left Eye */}
          <div className="border border-gray-300 rounded p-2">
            <h4 className="font-bold text-center mb-2 text-blue-600">Left (Normal) - {vaStatus.leftEye.status}</h4>
            <table className="w-full border-collapse">
            <thead>
                <tr>
                  <th className="border border-gray-300 p-1 text-xs"></th>
                  <th className="border border-gray-300 p-1 text-xs">Sph</th>
                  <th className="border border-gray-300 p-1 text-xs">Cyl</th>
                  <th className="border border-gray-300 p-1 text-xs">Ax</th>
                  <th className="border border-gray-300 p-1 text-xs">Add</th>
                  <th className="border border-gray-300 p-1 text-xs">Va</th>
                  <th className="border border-gray-300 p-1 text-xs">LPD</th>
                  <th className="border border-gray-300 p-1 text-xs">SE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-1 text-sm font-medium text-left">D.V</td>
                  <td className="border border-gray-300 p-1"><Input title={formData.leftEye.dv.sph} value={formData.leftEye.dv.sph} name="leftEye.dv.sph" onChange={handleNumericInputChange} className="w-full text-center text-sm px-1 sm:px-2 py-1" disabled={formData.balanceLens} error={errors['leftEye.dv.sph']} /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.leftEye.dv.cyl} value={formData.leftEye.dv.cyl} name="leftEye.dv.cyl" onChange={handleNumericInputChange} className="w-full text-center text-sm px-1 sm:px-2 py-1" disabled={formData.balanceLens} error={errors['leftEye.dv.cyl']} /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.leftEye.dv.ax} value={formData.leftEye.dv.ax} name="leftEye.dv.ax" onChange={handleChange} className="w-full text-center text-sm px-1 sm:px-2 py-1" disabled={formData.balanceLens} error={errors['leftEye.dv.ax']} /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.leftEye.dv.add} value={formData.leftEye.dv.add} name="leftEye.dv.add" onChange={handleNumericInputChange} onBlur={(e) => calculateNearVision('leftEye', e)} className="w-full text-center text-sm px-1 sm:px-2 py-1" disabled={formData.balanceLens} error={errors['leftEye.dv.add']} /></td>
                <td className="border border-gray-300 p-1 relative">
                  <Input 
                      title={formData.leftEye.dv.vn}
                    value={formData.leftEye.dv.vn} 
                    name="leftEye.dv.vn" 
                    onChange={handleVnChange}
                    onFocus={(e) => {
                      handleVnFocus(e);
                      copyDvToNv('leftEye');
                    }}
                    onKeyDown={handleVnKeyDown}
                      className="w-full text-center text-sm px-1 sm:px-2 py-1"
                      placeholder="6/"
                    disabled={formData.balanceLens}
                    error={errors['leftEye.dv.vn']}
                    />
                </td>
                  <td className="border border-gray-300 p-1"><Input 
                    title={formData.leftEye.dv.lpd}
                    value={formData.leftEye.dv.lpd} 
                    name="leftEye.dv.lpd" 
                    onChange={handleNumericInputChange} 
                    helperText="Valid range: 25-38mm" 
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && (value < 25 || value > 38)) {
                        alert(`LPD must be between 25-38mm. You entered: ${value}mm`);
                      }
                    }} 
                    className="w-full text-center text-sm px-1 sm:px-2 py-1" 
                    disabled={formData.balanceLens} 
                    error={errors['leftEye.dv.lpd']}
                  /></td>
                  <td className="border border-gray-300 p-1 text-sm text-gray-600 text-center">{calculateSphericalEquivalent(formData.leftEye.dv.sph, formData.leftEye.dv.cyl)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-1 text-sm font-medium text-left">N.V</td>
                  <td className="border border-gray-300 p-1">
                    <Input 
                      title={formData.leftEye.nv.sph} 
                      value={formData.leftEye.nv.sph} 
                      name="leftEye.nv.sph" 
                      onChange={handleNumericInputChange} 
                      className="w-full text-center text-sm px-1 sm:px-2 py-1" 
                      disabled={formData.balanceLens}
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <Input 
                      title={formData.leftEye.nv.cyl} 
                      value={formData.leftEye.nv.cyl} 
                      name="leftEye.nv.cyl" 
                      onChange={handleNumericInputChange} 
                      className="w-full text-center text-sm px-1 sm:px-2 py-1" 
                      disabled={formData.balanceLens}
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <Input 
                      title={formData.leftEye.nv.ax} 
                      value={formData.leftEye.nv.ax} 
                      name="leftEye.nv.ax" 
                      onChange={handleChange} 
                      className="w-full text-center text-sm px-1 sm:px-2 py-1" 
                      disabled={formData.balanceLens}
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <Input 
                      title={formData.leftEye.nv.add} 
                      value={formData.leftEye.nv.add} 
                      name="leftEye.nv.add" 
                      onChange={handleNumericInputChange} 
                      className="w-full text-center text-sm px-1 sm:px-2 py-1" 
                      disabled={formData.balanceLens}
                    />
                  </td>
                <td className="border border-gray-300 p-1">
                  <Input 
                    title={formData.leftEye.nv.vn}
                    value={formData.leftEye.nv.vn} 
                    name="leftEye.nv.vn" 
                    onChange={handleVnChange}
                    className="w-full text-center text-sm px-1 sm:px-2 py-1"
                    disabled={formData.balanceLens}
                  />
                </td>
                <td className="border border-gray-300 p-1 text-right">
                  <Checkbox
                    label="BALANCE LENS"
                    checked={formData.balanceLens}
                    onChange={handleCheckboxChange}
                    name="balanceLens"
                  />
                </td>
                  <td className="border border-gray-300 p-1 text-sm text-gray-600 text-center">{calculateSphericalEquivalent(formData.leftEye.nv.sph, formData.leftEye.nv.cyl)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionSection; 