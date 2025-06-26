import React, { useState } from 'react';
import { SelectedItem } from '../types';
import { trackDeletedItem } from './ItemDeletionHandler';
import ToastNotification from '../ui/ToastNotification';
import { logWarn, logError } from '../../utils/logger';

interface ItemsTableProps {
  items: SelectedItem[];
  onDeleteItem: (index: number) => void;
  onUpdateItem?: (index: number, updatedItem: SelectedItem) => void;
  formData: any; // PrescriptionFormData type
  readOnly?: boolean;
}

const ItemsTable: React.FC<ItemsTableProps> = ({
  items,
  onDeleteItem,
  onUpdateItem,
  formData,
  readOnly = false
}) => {
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
    visible: boolean;
  }>({
    message: '',
    type: 'success',
    visible: false
  });

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({
      message,
      type,
      visible: true
    });
  };

  const handleDeleteWithHistory = async (index: number) => {
    const itemToDelete = items[index];
    
    if (!itemToDelete) {
      showNotification('Item not found', 'error');
      return;
    }

    try {
      // Track the deleted item in customer history
      const trackingResult = await trackDeletedItem(formData, itemToDelete, index);
      
      if (trackingResult.success) {
        // If tracking successful, proceed with deletion
        onDeleteItem(index);
        showNotification(
          `Item "${itemToDelete.itemName}" deleted and tracked in customer history`, 
          'success'
        );
      } else {
        // If tracking failed, still allow deletion but show warning
        logWarn('Failed to track deleted item', { message: trackingResult.message });
        onDeleteItem(index);
        showNotification(
          `Item deleted but history tracking failed: ${trackingResult.message}`, 
          'error'
        );
      }
    } catch (error) {
      logError('Error during item deletion', error);
      // Still allow deletion even if history tracking fails
      onDeleteItem(index);
      showNotification(
        `Item deleted but history tracking failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        'error'
      );
    }
  };

  const handleDiscountChange = (index: number, field: 'discountPercent' | 'discountAmount', value: string) => {
    if (!onUpdateItem) return;

    const item = items[index];
    const numValue = parseFloat(value) || 0;
    const baseAmount = item.rate * item.qty;

    let updatedItem: SelectedItem;

    if (field === 'discountPercent') {
      const discountAmount = (baseAmount * numValue) / 100;
      updatedItem = {
        ...item,
        discountPercent: numValue,
        discountAmount: parseFloat(discountAmount.toFixed(2)),
        amount: parseFloat((baseAmount - discountAmount).toFixed(2))
      };
    } else {
      const discountPercent = baseAmount > 0 ? (numValue / baseAmount) * 100 : 0;
      updatedItem = {
        ...item,
        discountAmount: numValue,
        discountPercent: parseFloat(discountPercent.toFixed(2)),
        amount: parseFloat((baseAmount - numValue).toFixed(2))
      };
    }

    onUpdateItem(index, updatedItem);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No items added yet. Click "Add Spectacle", "Add Frame/Sun Glasses", or "Add Lenses" to get started.
      </div>
    );
  }

  return (
    <>
      {notification.visible && (
        <ToastNotification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ ...notification, visible: false })}
        />
      )}
      
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700">S.I.</th>
              <th className="border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700">Item Code</th>
              <th className="border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700">Item Name</th>
              <th className="border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700">Unit</th>
              <th className="border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700">Tax (%)</th>
              <th className="border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700">Rate</th>
              <th className="border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700">Qty</th>
              <th className="border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700">Disc %</th>
              <th className="border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700">Disc Amt</th>
              <th className="border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700">Amount</th>
              {!readOnly && (
                <th className="border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700">Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-300 px-2 py-1 text-xs text-center">{item.si}</td>
                <td className="border border-gray-300 px-2 py-1 text-xs">{item.itemCode}</td>
                <td className="border border-gray-300 px-2 py-1 text-xs">{item.itemName}</td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-center">{item.unit}</td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-center">{item.taxPercent}%</td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right">₹{item.rate.toFixed(2)}</td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-center">{item.qty}</td>
                <td className="border border-gray-300 px-2 py-1 text-xs">
                  {readOnly ? (
                    <span className="text-center block">{item.discountPercent?.toFixed(2) || '0.00'}%</span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.discountPercent?.toString() || '0'}
                      onChange={(e) => handleDiscountChange(index, 'discountPercent', e.target.value)}
                      className="w-16 h-7 text-xs text-center border border-gray-300 rounded px-1"
                    />
                  )}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs">
                  {readOnly ? (
                    <span className="text-right block">₹{item.discountAmount?.toFixed(2) || '0.00'}</span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.discountAmount?.toString() || '0'}
                      onChange={(e) => handleDiscountChange(index, 'discountAmount', e.target.value)}
                      className="w-20 h-7 text-xs text-right border border-gray-300 rounded px-1"
                    />
                  )}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right font-medium">
                  ₹{item.amount.toFixed(2)}
                </td>
                {!readOnly && (
                  <td className="border border-gray-300 px-2 py-1 text-xs text-center">
                    <button
                      onClick={() => handleDeleteWithHistory(index)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium transition-colors"
                      title="Delete item (will be tracked in customer history)"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-medium">
              <td colSpan={readOnly ? 9 : 10} className="border border-gray-300 px-2 py-1 text-xs text-right">
                Total Amount:
              </td>
              <td className="border border-gray-300 px-2 py-1 text-xs text-right font-bold">
                ₹{items.reduce((total, item) => total + item.amount, 0).toFixed(2)}
              </td>
              {!readOnly && <td className="border border-gray-300"></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
};

export default ItemsTable;