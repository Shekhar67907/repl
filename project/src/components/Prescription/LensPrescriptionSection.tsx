import React, { useEffect, useState } from 'react';
import Input from '../ui/Input';
import Checkbox from '../ui/Checkbox';
import { PrescriptionData, EyeData, VisualAcuity } from '../types';
import { 
  calculateNearVisionSph, 
  validateAndFormatVn,
  checkHighPrescription,
  calculateSphericalEquivalent,
  handleSpecialCases,
  validateVnValue,
  formatVnValue
} from '../../utils/prescriptionUtils';
import { logError } from '../../utils/logger';

interface LensPrescriptionSectionProps {
  formData: { 
    rightEye: EyeData;
    leftEye: EyeData;
    balanceLens: boolean;
    age?: number;
  };
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleNumericInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCheckboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const LensPrescriptionSection: React.FC<LensPrescriptionSectionProps> = ({
  formData,
  handleChange,
  handleNumericInputChange,
  handleCheckboxChange,
}) => {
  const [warnings, setWarnings] = useState<{
    rightEye: string[],
    leftEye: string[]
  }>({
    rightEye: [],
    leftEye: []
  });

  const [vaStatus, setVaStatus] = useState<{
    rightEye: VisualAcuity | null,
    leftEye: VisualAcuity | null
  }>({
    rightEye: null,
    leftEye: null
  });

  // Add this function to copy DV to NV directly
  const copyDvToNv = (eye: 'rightEye' | 'leftEye') => {
    const dv = formData[eye].dv;
    handleChange({ target: { name: `${eye}.nv.sph`, value: dv.sph } } as React.ChangeEvent<HTMLInputElement>);
    handleChange({ target: { name: `${eye}.nv.cyl`, value: dv.cyl } } as React.ChangeEvent<HTMLInputElement>);
    handleChange({ target: { name: `${eye}.nv.ax`, value: dv.ax } } as React.ChangeEvent<HTMLInputElement>);
    handleChange({ target: { name: `${eye}.nv.add`, value: dv.add } } as React.ChangeEvent<HTMLInputElement>);
    handleChange({ target: { name: `${eye}.nv.vn`, value: dv.vn } } as React.ChangeEvent<HTMLInputElement>);
  };

  // Calculate Near Vision values based on D.V values
  const calculateNearVision = (eye: 'rightEye' | 'leftEye', e: React.FocusEvent<HTMLInputElement>) => {
    const dvData = formData[eye].dv;
    const nvData = formData[eye].nv;

    // Only calculate if Add field is being blurred
    if (e.target.name === `${eye}.dv.add` && dvData.add) {
      // Always recalculate and copy DV to NV, but calculate NV Sph as DV Sph + Add
      handleChange({ target: { name: `${eye}.nv.sph`, value: calculateNearVisionSph(dvData.sph, dvData.add) } } as React.ChangeEvent<HTMLInputElement>);
      handleChange({ target: { name: `${eye}.nv.cyl`, value: dvData.cyl } } as React.ChangeEvent<HTMLInputElement>);
      handleChange({ target: { name: `${eye}.nv.ax`, value: dvData.ax } } as React.ChangeEvent<HTMLInputElement>);
      handleChange({ target: { name: `${eye}.nv.add`, value: '' } } as React.ChangeEvent<HTMLInputElement>);
      handleChange({ target: { name: `${eye}.nv.vn`, value: 'N' } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  // Use ref to track previous values for IPD calculation to prevent infinite loops
  const prevRpdRef = React.useRef(formData.rightEye.dv.rpd);
  const prevLpdRef = React.useRef(formData.leftEye.dv.lpd);
  const prevIpdRef = React.useRef('');
  
  // Effect to handle prescription logic
  useEffect(() => {
    // Only calculate if RPD or LPD actually changed
    const rpd = formData.rightEye.dv.rpd;
    const lpd = formData.leftEye.dv.lpd;
    
    if (rpd && lpd && (rpd !== prevRpdRef.current || lpd !== prevLpdRef.current)) {
      const rpdValue = parseFloat(rpd);
      const lpdValue = parseFloat(lpd);
      
      if (!isNaN(rpdValue) && !isNaN(lpdValue)) {
        const calculatedIPD = (rpdValue + lpdValue).toFixed(1);
        
        // Only update if the calculated IPD is different from the previous one
        if (calculatedIPD !== prevIpdRef.current) {
          prevIpdRef.current = calculatedIPD;
          handleChange({
            target: {
              name: 'ipd',
              value: calculatedIPD
            }
          } as React.ChangeEvent<HTMLInputElement>);
        }
      }
      
      // Update refs
      prevRpdRef.current = rpd;
      prevLpdRef.current = lpd;
    }
  }, [formData.rightEye.dv.rpd, formData.leftEye.dv.lpd, handleChange]);

  // Effect to initialize Vn fields
  useEffect(() => {
    // Initialize D.V Vn fields with "6/" if empty
    (['rightEye', 'leftEye'] as const).forEach(eye => {
      if (!formData[eye].dv.vn) {
        handleChange({
          target: {
            name: `${eye}.dv.vn`,
            value: '6/'
          }
        } as React.ChangeEvent<HTMLInputElement>);
      }
      // Initialize N.V Vn fields with "N" if empty
      if (!formData[eye].nv.vn) {
        handleChange({
          target: {
            name: `${eye}.nv.vn`,
            value: 'N'
          }
        } as React.ChangeEvent<HTMLInputElement>);
      }
    });
  }, []);

  // Check for high prescription values when SPH or CYL changes
  useEffect(() => {
    const rightEyeWarnings = checkHighPrescription(
      formData.rightEye.dv.sph,
      formData.rightEye.dv.cyl
    ).warnings;

    const leftEyeWarnings = checkHighPrescription(
      formData.leftEye.dv.sph,
      formData.leftEye.dv.cyl
    ).warnings;

    setWarnings({
      rightEye: rightEyeWarnings,
      leftEye: leftEyeWarnings
    });
  }, [
    formData.rightEye.dv.sph,
    formData.rightEye.dv.cyl,
    formData.leftEye.dv.sph,
    formData.leftEye.dv.cyl
  ]);

  // Update visual acuity status when VN changes
  useEffect(() => {
    const rightVa = validateAndFormatVn(formData.rightEye.dv.vn);
    const leftVa = validateAndFormatVn(formData.leftEye.dv.vn);

    setVaStatus({
      rightEye: rightVa,
      leftEye: leftVa
    });
  }, [formData.rightEye.dv.vn, formData.leftEye.dv.vn]);

  // Calculate the division result for Vn field - Used in handleVnChange
  const calculateVnDivision = (value: string): string => {
    if (!value.startsWith('6/')) return value;
    const vnDenominator = value.substring(2);
    if (vnDenominator.startsWith('*')) {
      return vnDenominator; // For now, just return as is
    }
    if (!vnDenominator || vnDenominator === '0') return value;
    
    const result = 6 / parseInt(vnDenominator, 10);
    // Only show division result if it's a clean number
    if (Number.isInteger(result)) {
      return `6/${vnDenominator} (${result})`;
    }
    return value;
  };

  // Handle Vn field changes
  const handleVnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    let value = input.value;
    const name = input.name;

    if (!name) {
      logError('[handleVnChange] Missing name on event target', { input, event: e });
      console.trace();
      return;
    }

    const eye = name.split('.')[0];
    const isNearVision = name.includes('.nv.vn');

    // Handle N.V row
    if (isNearVision) {
      const validatedValue = validateVnValue(value, true);
      if (validatedValue !== null) {
        handleChange({
          target: {
            name: name,
            value: validatedValue
          }
        } as React.ChangeEvent<HTMLInputElement>);
      }
      return;
    }

    // Handle D.V row
    if (name.includes('.dv.vn')) {
      // Always format the value to ensure proper structure
      const formattedValue = formatVnValue(value, false);
      
      // Allow editing by accepting any valid format
        handleChange({
          target: {
            name: name,
          value: formattedValue,
          }
        } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const handleVnFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const input = e.target;
    let value = input.value;
    const name = input.name;
    // If focusing on DV Va field, copy DV to NV
    if (name && name.endsWith('.dv.vn')) {
      const eye = name.startsWith('rightEye') ? 'rightEye' : 'leftEye';
      copyDvToNv(eye);
    }
    // When focusing, if the value is a default '6/', clear it for user input
    if (value.trim() === '6/') {
      // Do not clear it, let the user edit
    }
    // If it's a default 'N', clear it
    else if (value.trim() === 'N') {
        handleChange({
          target: {
          name: input.name,
          value: '',
          }
      } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const handleVnKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    const value = input.value;
  
    if (e.key === 'Enter') {
      const formattedValue = formatVnValue(value, false);
      handleChange({
        target: {
          name: input.name,
          value: formattedValue,
        }
      } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  // Effect to handle balance lens functionality
  useEffect(() => {
    if (formData.balanceLens) {
      // Copy right eye values to left eye
      const newLeftEye = {
        dv: {
          ...formData.rightEye.dv,
          lpd: formData.leftEye.dv.lpd // Keep original LPD
        },
        nv: { ...formData.rightEye.nv }
      };

      // Update each field individually to ensure proper state updates
      Object.entries(newLeftEye.dv).forEach(([key, value]) => {
        handleChange({
          target: {
            name: `leftEye.dv.${key}`,
            value: value?.toString() || ''
          }
        } as React.ChangeEvent<HTMLInputElement>);
      });

      Object.entries(newLeftEye.nv).forEach(([key, value]) => {
        handleChange({
          target: {
            name: `leftEye.nv.${key}`,
            value: value?.toString() || ''
          }
        } as React.ChangeEvent<HTMLInputElement>);
      });
    }
  }, [formData.balanceLens, formData.rightEye]);

  // Effect to update spherical equivalent when SPH or CYL changes
  useEffect(() => {
    // Update right eye SE
    const rightDvSe = calculateSphericalEquivalent(formData.rightEye.dv.sph, formData.rightEye.dv.cyl);
    const rightNvSe = calculateSphericalEquivalent(formData.rightEye.nv.sph, formData.rightEye.nv.cyl);
    
    if (rightDvSe !== null) {
      handleChange({
        target: {
          name: 'rightEye.dv.sphericalEquivalent',
          value: rightDvSe.toFixed(2)
        }
      } as React.ChangeEvent<HTMLInputElement>);
    }
    
    if (rightNvSe !== null) {
      handleChange({
        target: {
          name: 'rightEye.nv.sphericalEquivalent',
          value: rightNvSe.toFixed(2)
        }
      } as React.ChangeEvent<HTMLInputElement>);
    }

    // Update left eye SE
    const leftDvSe = calculateSphericalEquivalent(formData.leftEye.dv.sph, formData.leftEye.dv.cyl);
    const leftNvSe = calculateSphericalEquivalent(formData.leftEye.nv.sph, formData.leftEye.nv.cyl);
    
    if (leftDvSe !== null) {
      handleChange({
        target: {
          name: 'leftEye.dv.sphericalEquivalent',
          value: leftDvSe.toFixed(2)
        }
      } as React.ChangeEvent<HTMLInputElement>);
    }
    
    if (leftNvSe !== null) {
      handleChange({
        target: {
          name: 'leftEye.nv.sphericalEquivalent',
          value: leftNvSe.toFixed(2)
        }
      } as React.ChangeEvent<HTMLInputElement>);
    }
  }, [
    formData.rightEye.dv.sph,
    formData.rightEye.dv.cyl,
    formData.rightEye.nv.sph,
    formData.rightEye.nv.cyl,
    formData.leftEye.dv.sph,
    formData.leftEye.dv.cyl,
    formData.leftEye.nv.sph,
    formData.leftEye.nv.cyl
  ]);

  const commonInputProps = {
    className: "w-full text-center px-1 py-1 sm:px-2 border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50",
    type: "text"
  };

  const renderEyeRow = (eye: 'rightEye' | 'leftEye', vision: 'dv' | 'nv') => {
    const eyeData = formData[eye]?.[vision];
    const dvData = formData[eye]?.dv;
    const isDv = vision === 'dv';
    const isRight = eye === 'rightEye';

    if (!eyeData) {
      logError(`Missing ${vision} data for ${eye}`, { formData });
      return (
        <tr className="bg-red-100">
          <td colSpan={isDv ? 10 : 9} className="text-center text-red-700 py-2">
            Error: Data not available for {eye} {vision.toUpperCase()}
          </td>
        </tr>
      );
    }

    return (
      <tr>
        <td>
          <input
            {...commonInputProps}
            name={`${eye}.${vision}.sph`}
            value={eyeData.sph || ''}
            onChange={handleNumericInputChange}
            title={eyeData.sph || ''}
          />
        </td>
        <td>
          <input
            {...commonInputProps}
            name={`${eye}.${vision}.cyl`}
            value={eyeData.cyl || ''}
            onChange={handleNumericInputChange}
            title={eyeData.cyl || ''}
          />
        </td>
        <td>
          <input
            {...commonInputProps}
            name={`${eye}.${vision}.ax`}
            value={eyeData.ax || ''}
            onChange={handleNumericInputChange}
            title={eyeData.ax || ''}
          />
        </td>
        <td>
          <input
            {...commonInputProps}
            name={`${eye}.${vision}.add`}
            value={eyeData.add || ''}
            onChange={handleNumericInputChange}
            onBlur={(e) => calculateNearVision(eye, e)}
            title={eyeData.add || ''}
          />
        </td>
        <td>
          <input
            {...commonInputProps}
            name={`${eye}.${vision}.vn`}
            value={eyeData.vn || ''}
            onChange={handleVnChange}
            onFocus={handleVnFocus}
            onKeyDown={handleVnKeyDown}
            title={eyeData.vn || ''}
          />
        </td>
        {isDv && (
          <>
            <td>
              <input
                {...commonInputProps}
                name={`${eye}.dv.${isRight ? 'rpd' : 'lpd'}`}
                value={isRight ? dvData.rpd || '' : dvData.lpd || ''}
                onChange={handleNumericInputChange}
                title={isRight ? dvData.rpd || '' : dvData.lpd || ''}
              />
            </td>
            <td className="w-24 text-center">
              <span>{calculateSphericalEquivalent(dvData.sph, dvData.cyl)}</span>
            </td>
          </>
        )}
      </tr>
    );
  };

  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-gray-700 mb-2 border-b pb-1">Lens Prescription</h3>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-[700px] md:min-w-[900px] lg:min-w-0">
        {/* Right Eye */}
          <div className="border border-gray-300 rounded p-2">
            <h4 className="font-bold text-center mb-2 text-blue-600">Right (Normal) - {vaStatus.rightEye?.status || '20/20'}</h4>
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
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.dv.sph} value={formData.rightEye.dv.sph} name="rightEye.dv.sph" onChange={handleNumericInputChange} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.dv.cyl} value={formData.rightEye.dv.cyl} name="rightEye.dv.cyl" onChange={handleNumericInputChange} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.dv.ax} value={formData.rightEye.dv.ax} name="rightEye.dv.ax" onChange={handleChange} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.dv.add} value={formData.rightEye.dv.add} name="rightEye.dv.add" onChange={handleNumericInputChange} onBlur={(e) => calculateNearVision('rightEye', e)} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                <td className="border border-gray-300 p-1 relative">
                  <Input 
                      title={formData.rightEye.dv.vn}
                    value={formData.rightEye.dv.vn} 
                    name="rightEye.dv.vn" 
                    onChange={handleVnChange} 
                    onFocus={handleVnFocus} 
                    onKeyDown={handleVnKeyDown} 
                      className="text-center text-sm px-1 sm:px-2 py-1"
                    placeholder="6/"
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
                    if (!isNaN(value)) {
                      if (value < 25 || value > 38) {
                        alert(`RPD must be between 25-38mm. You entered: ${value}mm`);
                      }
                      handleChange({
                        target: {
                          name: e.target.name,
                          value: value.toFixed(1)
                        }
                      } as React.ChangeEvent<HTMLInputElement>);
                    }
                  }} 
                    className="text-center text-sm px-1 sm:px-2 py-1" 
                /></td>
                  <td className="border border-gray-300 p-1 text-sm text-gray-600 text-center">{calculateSphericalEquivalent(formData.rightEye.dv.sph, formData.rightEye.dv.cyl)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-1 text-sm font-medium text-left">N.V</td>
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.nv.sph} value={formData.rightEye.nv.sph} name="rightEye.nv.sph" onChange={handleNumericInputChange} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.nv.cyl} value={formData.rightEye.nv.cyl} name="rightEye.nv.cyl" onChange={handleNumericInputChange} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.nv.ax} value={formData.rightEye.nv.ax} name="rightEye.nv.ax" onChange={handleChange} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.rightEye.nv.add} value={formData.rightEye.nv.add} name="rightEye.nv.add" onChange={handleNumericInputChange} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                <td className="border border-gray-300 p-1">
                  <Input 
                      title={formData.rightEye.nv.vn}
                    value={formData.rightEye.nv.vn} 
                    name="rightEye.nv.vn" 
                    onChange={handleVnChange}
                      className="text-center text-sm px-1 sm:px-2 py-1"
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
                  <td className="border border-gray-300 p-1 text-sm text-gray-600 text-center">{calculateSphericalEquivalent(formData.rightEye.nv.sph, formData.rightEye.nv.cyl)}</td>
              </tr>
            </tbody>
          </table>
            {warnings.rightEye.length > 0 && (
              <div className="mt-2 p-2 bg-yellow-100 text-yellow-800 text-xs rounded">
                <strong>Warning:</strong> {warnings.rightEye.join(', ')}
              </div>
            )}
        </div>

        {/* Left Eye */}
          <div className="border border-gray-300 rounded p-2">
            <h4 className="font-bold text-center mb-2 text-blue-600">Left (Normal) - {vaStatus.leftEye?.status || '20/20'}</h4>
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
                  <td className="border border-gray-300 p-1"><Input title={formData.leftEye.dv.sph} value={formData.leftEye.dv.sph} name="leftEye.dv.sph" onChange={handleNumericInputChange} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.leftEye.dv.cyl} value={formData.leftEye.dv.cyl} name="leftEye.dv.cyl" onChange={handleNumericInputChange} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.leftEye.dv.ax} value={formData.leftEye.dv.ax} name="leftEye.dv.ax" onChange={handleChange} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.leftEye.dv.add} value={formData.leftEye.dv.add} name="leftEye.dv.add" onChange={handleNumericInputChange} onBlur={(e) => calculateNearVision('leftEye', e)} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                <td className="border border-gray-300 p-1 relative">
                  <Input 
                      title={formData.leftEye.dv.vn}
                    value={formData.leftEye.dv.vn} 
                    name="leftEye.dv.vn" 
                    onChange={handleVnChange}
                    onFocus={handleVnFocus}
                    onKeyDown={handleVnKeyDown}
                      className="text-center text-sm px-1 sm:px-2 py-1"
                    placeholder="6/"
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
                    if (!isNaN(value)) {
                      if (value < 25 || value > 38) {
                        alert(`LPD must be between 25-38mm. You entered: ${value}mm`);
                      }
                      handleChange({
                        target: {
                          name: e.target.name,
                          value: value.toFixed(1)
                        }
                      } as React.ChangeEvent<HTMLInputElement>);
                    }
                  }} 
                    className="text-center text-sm px-1 sm:px-2 py-1" 
                /></td>
                  <td className="border border-gray-300 p-1 text-sm text-gray-600 text-center">{calculateSphericalEquivalent(formData.leftEye.dv.sph, formData.leftEye.dv.cyl)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-1 text-sm font-medium text-left">N.V</td>
                  <td className="border border-gray-300 p-1"><Input title={formData.leftEye.nv.sph} value={formData.leftEye.nv.sph} name="leftEye.nv.sph" onChange={handleNumericInputChange} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.leftEye.nv.cyl} value={formData.leftEye.nv.cyl} name="leftEye.nv.cyl" onChange={handleNumericInputChange} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.leftEye.nv.ax} value={formData.leftEye.nv.ax} name="leftEye.nv.ax" onChange={handleChange} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                  <td className="border border-gray-300 p-1"><Input title={formData.leftEye.nv.add} value={formData.leftEye.nv.add} name="leftEye.nv.add" onChange={handleNumericInputChange} className="text-center text-sm px-1 sm:px-2 py-1" /></td>
                <td className="border border-gray-300 p-1">
                  <Input 
                      title={formData.leftEye.nv.vn}
                    value={formData.leftEye.nv.vn} 
                    name="leftEye.nv.vn" 
                    onChange={handleVnChange}
                      className="text-center text-sm px-1 sm:px-2 py-1"
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
            {warnings.leftEye.length > 0 && (
              <div className="mt-2 p-2 bg-yellow-100 text-yellow-800 text-xs rounded">
                <strong>Warning:</strong> {warnings.leftEye.join(', ')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LensPrescriptionSection;
