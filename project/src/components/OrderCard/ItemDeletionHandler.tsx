import React from 'react';
import { customerHistoryService } from '../../Services/customerHistoryService';
import { PrescriptionFormData, SelectedItem } from '../types';
import { logDebug, logError } from '../../utils/logger';

interface ItemDeletionHandlerProps {
  formData: PrescriptionFormData;
  onDeleteSuccess?: (message: string) => void;
  onDeleteError?: (error: string) => void;
}

export const useItemDeletionHandler = ({ 
  formData, 
  onDeleteSuccess, 
  onDeleteError 
}: ItemDeletionHandlerProps) => {
  
  const handleItemDeletion = async (
    deletedItem: SelectedItem,
    itemIndex: number
  ): Promise<boolean> => {
    try {
      logDebug('Processing item deletion', { deletedItem, itemIndex, formData });

      // Prepare customer data
      const customerData = {
        id: formData.id,
        name: formData.name,
        mobileNo: formData.mobileNo,
        email: formData.email,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pinCode: formData.pinCode,
        prescriptionNo: formData.prescriptionNo
      };

      // Prepare deleted item data - map from SelectedItem to ServiceDeletedItem
      const deletedItemData = {
        id: `${formData.prescriptionNo || 'UNKNOWN'}-${itemIndex}-${Date.now()}`,
        order_id: formData.referenceNo || formData.prescriptionNo || '',
        product_id: deletedItem.itemCode || '',
        product_type: deletedItem.itemType || 'Unknown',
        product_name: deletedItem.itemName || 'Unknown Item',
        price: deletedItem.rate || 0,
        quantity: deletedItem.qty || 1,
        // For backward compatibility
        itemCode: deletedItem.itemCode,
        itemName: deletedItem.itemName,
        itemType: deletedItem.itemType,
        rate: deletedItem.rate,
        qty: deletedItem.qty,
        amount: deletedItem.amount || 0,
        discountPercent: deletedItem.discountPercent,
        discountAmount: deletedItem.discountAmount,
        brandName: deletedItem.brandName,
        index: deletedItem.index,
        coating: deletedItem.coating
      };

      // Add to customer history
      const result = await customerHistoryService.addDeletedItemToHistory(
        customerData,
        deletedItemData,
        formData.referenceNo || formData.prescriptionNo
      );

      if (result.success) {
        logDebug('Successfully tracked deleted item', { data: result.data });
        onDeleteSuccess?.(result.message);
        return true;
      } else {
        logError('Failed to track deleted item', { message: result.message });
        onDeleteError?.(result.message);
        return false;
      }
    } catch (error) {
      const errorMessage = `Failed to track deleted item: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logError('Error in handleItemDeletion', error);
      onDeleteError?.(errorMessage);
      return false;
    }
  };

  return { handleItemDeletion };
};

// Standalone function for use in class components or other contexts
export const trackDeletedItem = async (
  formData: PrescriptionFormData,
  deletedItem: SelectedItem,
  itemIndex: number
): Promise<{ success: boolean; message: string }> => {
  try {
    const customerData = {
      id: formData.id,
      name: formData.name,
      mobileNo: formData.mobileNo,
      email: formData.email,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pinCode: formData.pinCode,
      prescriptionNo: formData.prescriptionNo
    };

    // Map SelectedItem to ServiceDeletedItem format
    const deletedItemData = {
      id: `${formData.prescriptionNo || 'UNKNOWN'}-${itemIndex}-${Date.now()}`,
      order_id: formData.referenceNo || formData.prescriptionNo || '',
      product_id: deletedItem.itemCode || '',
      product_type: deletedItem.itemType || 'Unknown',
      product_name: deletedItem.itemName || 'Unknown Item',
      price: deletedItem.rate || 0,
      quantity: deletedItem.qty || 1,
      // For backward compatibility
      itemCode: deletedItem.itemCode,
      itemName: deletedItem.itemName,
      itemType: deletedItem.itemType,
      rate: deletedItem.rate,
      qty: deletedItem.qty,
      amount: deletedItem.amount || 0,
      discountPercent: deletedItem.discountPercent,
      discountAmount: deletedItem.discountAmount,
      brandName: deletedItem.brandName,
      index: deletedItem.index,
      coating: deletedItem.coating
    };

    const result = await customerHistoryService.addDeletedItemToHistory(
      customerData,
      deletedItemData,
      formData.referenceNo || formData.prescriptionNo
    );

    return result;
  } catch (error) {
    return {
      success: false,
      message: `Failed to track deleted item: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};