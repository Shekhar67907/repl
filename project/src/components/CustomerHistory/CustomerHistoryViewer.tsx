import React, { useState, useEffect, useRef, useCallback } from 'react';
import { customerHistoryService } from '../../Services/customerHistoryService';
import { contactLensService, getContactLensPrescriptionsByPrescriptionId } from '../../Services/contactLensService';
import { Search, X, User, Phone, Mail } from 'lucide-react';
import Card from '../ui/Card';
import Select from '../ui/Select';
import type { CustomerHistory, DeletedItem, SearchResult, SearchField } from './types';
import { logDebug, logError } from '../../utils/logger';

const CustomerHistoryViewer: React.FC = () => {
  const [searchField, setSearchField] = useState<SearchField>('name');
  const [searchValue, setSearchValue] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SearchResult | null>(null);
  const [customerHistory, setCustomerHistory] = useState<CustomerHistory | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>('');
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | null>(null);

  // Search fields configuration
  const searchFields: { label: string; value: SearchField }[] = [
    { label: 'Name', value: 'name' },
    { label: 'Mobile', value: 'mobile' },
    { label: 'Reference No', value: 'ref_no' },
    { label: 'Prescription No', value: 'prescription_no' },
  ];

  // Handle clicks outside the search container
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Async version of mapToSearchResult for ContactLens prescription_no fix
  const mapToSearchResultAsync = useCallback(async (data: CustomerHistory): Promise<SearchResult & { type?: string; prescription_id?: string }> => {
    let uniqueDeletedItems: any[] = [];
    if (Array.isArray(data.deleted_items) && data.deleted_items.length > 0) {
      const latestByKey = new Map();
      data.deleted_items.forEach((item, index) => {
        const key = item.item_code || item.product_id || item.id || index;
        if (!latestByKey.has(key) || new Date(item.deleted_at) > new Date(latestByKey.get(key).deleted_at)) {
          latestByKey.set(key, item);
        }
      });
      uniqueDeletedItems = Array.from(latestByKey.values());
    }
    const total_deleted_items = uniqueDeletedItems.length;
    const total_deleted_value = uniqueDeletedItems.reduce(
      (sum, item) => sum + ((item.price || 0) * (item.quantity || item.qty || 1)), 0
    );
    let type = 'OrderCard';
    let prescription_id = '';
    if (uniqueDeletedItems.some(item => (item.product_type || item.item_type) === 'ContactLens')) {
      type = 'ContactLens';
    }
    if (uniqueDeletedItems.length > 0) {
      if (type === 'ContactLens') {
        // Prefer a prescription_no that starts with CL-
        const clItem = uniqueDeletedItems.find(
          (item: DeletedItem) => typeof item.prescription_no === 'string' && item.prescription_no.startsWith('CL-')
        );
        if (clItem?.prescription_no) {
          prescription_id = clItem.prescription_no;
        } else {
          // If not found, try to fetch from main table using UUID
          const uuid = uniqueDeletedItems[0].prescription_no || uniqueDeletedItems[0].prescriptionNo;
          if (uuid && typeof uuid === 'string' && uuid.length > 20) { // likely a UUID
            try {
              const result = await contactLensService.getContactLensPrescriptionsByPrescriptionId(uuid);
              if (result.success && Array.isArray(result.data) && result.data.length > 0) {
                // Try to get prescription_no from the main table
                prescription_id = result.data[0].reference_no || result.data[0].prescription_no || '';
              } else {
                prescription_id = uuid;
              }
            } catch (e) {
              prescription_id = uuid;
            }
          } else {
            prescription_id = uuid || '';
          }
        }
      } else {
        prescription_id = uniqueDeletedItems[0].prescription_no
          || uniqueDeletedItems[0].prescriptionNo
          || '';
      }
    }
    return {
      id: data.id,
      customer_id: data.customer_id,
      customer_name: data.customer_name || 'Unknown Customer',
      mobile_no: data.mobile_no,
      email: data.email,
      total_deleted_items,
      total_deleted_value,
      updated_at: data.updated_at || new Date().toISOString(),
      type,
      prescription_id
    };
  }, []);

  // Update search logic to use async mapping
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (!searchValue.trim()) {
      setSearchResults([]);
      setShowResults(false);
      setSearchError('');
      return;
    }
    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        setIsSearching(true);
        setSearchError('');
        if (searchField === 'ref_no' || searchField === 'prescription_no') {
          const searchType = searchField === 'ref_no' ? 'reference_no' : 'prescription_no';
          const response = await customerHistoryService.searchCustomerHistoryByField(
            searchType,
            searchValue.trim()
          );
          if (response.success && response.data) {
            const searchResult = await mapToSearchResultAsync(response.data);
            setSearchResults([searchResult]);
            setShowResults(true);
          } else {
            setSearchResults([]);
            setSearchError(response.message || 'No matching records found');
            setShowResults(false);
          }
        } else {
          const searchResult = await customerHistoryService.searchCustomerHistory(searchValue.trim());
          if (searchResult.success && searchResult.data && Array.isArray(searchResult.data)) {
            const mappedResults = await Promise.all(searchResult.data.map(mapToSearchResultAsync));
            setSearchResults(mappedResults);
            setShowResults(mappedResults.length > 0);
            if (mappedResults.length === 0) {
              setSearchError('No matching records found');
            }
          } else {
            setSearchResults([]);
            setSearchError(searchResult.message || 'No matching records found');
            setShowResults(false);
          }
        }
      } catch (error) {
        setSearchError('Failed to search customer history');
        setSearchResults([]);
        setShowResults(false);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchValue, searchField, mapToSearchResultAsync]);

  const handleCustomerSelect = useCallback((customer: SearchResult) => {
    logDebug('[handleCustomerSelect] Customer selected', customer);
    setSelectedCustomer(customer);
    setShowResults(false);
    setSearchValue('');
    setSearchError('');
    loadCustomerHistory(customer.customer_id);
  }, []);

  const performSearch = useCallback(async () => {
    if (!searchValue.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setSearchError('');
    
    try {
      if (searchField === 'ref_no' || searchField === 'prescription_no') {
        const response = await customerHistoryService.searchCustomerHistoryByField(
          searchField === 'ref_no' ? 'reference_no' : 'prescription_no',
          searchValue
        );
        
        if (response.success && response.data) {
          const result = await mapToSearchResultAsync(response.data);
          setSearchResults([result]);
          setShowResults(true);
          // Auto-select if only one result
          handleCustomerSelect(result);
          logDebug('[performSearch] Search results set', [result]);
        } else {
          setSearchResults([]);
          setSearchError(response.message || 'No results found');
          setShowResults(false);
        }
      } else {
        const searchResult = await customerHistoryService.searchCustomerHistory(searchValue);
        if (searchResult.success && searchResult.data && Array.isArray(searchResult.data)) {
          const mappedResults = await Promise.all(searchResult.data.map(mapToSearchResultAsync));
          setSearchResults(mappedResults);
          setShowResults(mappedResults.length > 0);
          // Auto-select if only one result
          if (mappedResults.length === 1) {
            handleCustomerSelect(mappedResults[0]);
          }
          logDebug('[performSearch] Search results set', mappedResults);
          
          if (mappedResults.length === 0) {
            setSearchError('No results found');
          }
        } else {
          setSearchResults([]);
          setSearchError(searchResult.message || 'No results found');
          setShowResults(false);
        }
      }
    } catch (error) {
      logError('Search error', error);
      setSearchError('Failed to perform search');
      setSearchResults([]);
      setShowResults(false);
    } finally {
      setIsSearching(false);
    }
  }, [searchValue, searchField, mapToSearchResultAsync, handleCustomerSelect]);

  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    setSearchResults([]);
    setShowResults(false);
    setSearchError('');
    setSelectedCustomer(null);
    setCustomerHistory(null);
  }, []);

  const loadCustomerHistory = useCallback(async (customerId: string) => {
    setLoading(true);
    setCustomerHistory(null);
    setSearchError('');
    try {
      const response = await customerHistoryService.getCustomerHistory(customerId);
      if (response.success && response.data) {
        setCustomerHistory(response.data);
      } else {
        setSearchError(response.message || 'No history found');
      }
    } catch (error) {
      logError('Error loading customer history', error);
      setSearchError('Failed to load customer history');
    } finally {
      setLoading(false);
    }
  }, []);

  const formatDate = (dateString: string | undefined) => {
    try {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatCurrency = (amount: number | undefined) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  // Safe access to deleted items with fallback
  const getDeletedItems = (customerHistory: CustomerHistory | null): DeletedItem[] => {
    if (!customerHistory) return [];
    return Array.isArray(customerHistory.deleted_items) ? customerHistory.deleted_items : [];
  };

  // Debug: log component state
  logDebug('[Component State]', {
    searchField,
    searchValue,
    isSearching,
    searchResults,
    showResults,
    selectedCustomer,
    customerHistory,
    loading,
    searchError
  });

  return (
    <div className="p-6" style={{ position: 'relative', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Customer History</h2>
        {selectedCustomer && (
          <button
            onClick={handleClearSearch}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <X className="h-4 w-4" />
            Clear Selection
          </button>
        )}
      </div>
      
      {/* Search Section */}
      <Card className="p-4 mb-6 bg-white shadow-sm rounded-lg relative" style={{ zIndex: 100, overflow: 'visible' }}>
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end" style={{ overflow: 'visible' }}>
          <div className="w-full md:flex-1" ref={searchContainerRef}>
            <div className="relative">
              <div className="flex items-stretch border border-gray-300 rounded-md overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
                <div className="relative flex-shrink-0 w-36">
                  <Select
                    value={searchField}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      setSearchField(e.target.value as SearchField);
                      setSearchValue('');
                      setSearchResults([]);
                      setShowResults(false);
                      setSearchError('');
                    }}
                    options={searchFields}
                    className="h-full border-0 rounded-none bg-gray-50 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => {
                    logDebug('[Input onChange] Value', { value: e.target.value });
                    setSearchValue(e.target.value);
                    // Don't automatically show results here - let the useEffect handle it
                  }}
                  onFocus={() => {
                    logDebug('[Input onFocus] searchResults.length', { length: searchResults.length });
                    if (searchResults.length > 0 && searchValue.trim()) {
                      setShowResults(true);
                    }
                  }}
                  placeholder={`Search by ${searchFields.find(f => f.value === searchField)?.label.toLowerCase() || 'name'}...`}
                  className="block w-full px-4 py-2 text-sm border-0 focus:ring-0 focus:outline-none"
                  style={{ minWidth: '200px' }}
                  autoComplete="off"
                />
                <button
                  onClick={performSearch}
                  disabled={isSearching}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center justify-center"
                  style={{ minWidth: '44px' }}
                >
                  {isSearching ? (
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Search className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Search Results Dropdown */}
              {showResults && searchValue.trim() !== '' && (
                <div 
                  className="absolute z-[1000] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-96 overflow-y-auto"
                  style={{
                    top: 'calc(100% + 4px)',
                    left: 0,
                    width: '100%',
                    maxHeight: '24rem',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseDown={(e) => {
                    // Prevent input blur when clicking inside dropdown
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <div className="sticky top-0 z-10 px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                    Search Results ({searchResults.length})
                  </div>
                  {searchResults.map((result) => {
                    const extendedResult = result as SearchResult & { type?: string; prescription_id?: string };
                    return (
                      <div
                        key={extendedResult.id}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors duration-150 border-b border-gray-100 last:border-0"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCustomerSelect(result);
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                        }}
                      >
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mr-3 mt-0.5">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                              <User className="h-4 w-4" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-2">
                                  {extendedResult.customer_name}
                                  {/* Type badge */}
                                  {extendedResult.type === 'ContactLens' ? (
                                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">ContactLens</span>
                                  ) : (
                                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">OrderCard</span>
                                  )}
                                </p>
                                {/* Prescription ID */}
                                {extendedResult.prescription_id && (
                                  <p className="text-xs text-gray-500 mt-0.5">Prescription ID: <span className="font-mono">{extendedResult.prescription_id}</span></p>
                                )}
                              </div>
                              <div className="ml-2 flex-shrink-0 flex">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                  {extendedResult.total_deleted_items} {extendedResult.total_deleted_items === 1 ? 'item' : 'items'}
                                </span>
                              </div>
                            </div>
                            <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:mt-0 sm:space-x-6">
                              {extendedResult.mobile_no && (
                                <div className="flex items-center text-sm text-gray-500 mt-1">
                                  <Phone className="flex-shrink-0 mr-1.5 h-3.5 w-3.5 text-gray-400" />
                                  <span>{extendedResult.mobile_no}</span>
                                </div>
                              )}
                              {extendedResult.email && (
                                <div className="flex items-center text-sm text-gray-500 mt-1">
                                  <Mail className="flex-shrink-0 mr-1.5 h-3.5 w-3.5 text-gray-400" />
                                  <span className="truncate max-w-xs">{extendedResult.email}</span>
                                </div>
                              )}
                            </div>
                            <div className="mt-2">
                              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                {formatCurrency(extendedResult.total_deleted_value)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Search Error/No Results Message */}
              {searchError && (
                <div 
                  className="bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden"
                  style={{ 
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    marginTop: '2px'
                  }}
                >
                  <div className="p-4 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-3">
                        <X className="h-6 w-6 text-red-600" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-1">
                        {searchError.includes('No results') || searchError.includes('No matching') ? 'No Results Found' : 'Error'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {searchError.includes('No results') || searchError.includes('No matching')
                          ? `We couldn't find any customers matching "${searchValue}"`
                          : searchError}
                      </p>
                      {!(searchError.includes('No results') || searchError.includes('No matching')) && (
                        <button
                          onClick={() => setSearchError('')}
                          className="mt-3 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            <span className="ml-3 text-gray-600">Loading customer history...</span>
          </div>
        </Card>
      )}

      {/* Customer History Section */}
      {selectedCustomer && customerHistory && !loading && (
        <Card className="p-6">
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-2">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{customerHistory.customer_name}</p>
              </div>
              {customerHistory.mobile_no && (
                <div>
                  <p className="text-sm text-gray-500">Mobile</p>
                  <p className="font-medium">{customerHistory.mobile_no}</p>
                </div>
              )}
              {customerHistory.email && (
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{customerHistory.email}</p>
                </div>
              )}
              {customerHistory.address && (
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium">{customerHistory.address}</p>
                </div>
              )}
              {customerHistory.city && (
                <div>
                  <p className="text-sm text-gray-500">City</p>
                  <p className="font-medium">{customerHistory.city}</p>
                </div>
              )}
              {customerHistory.state && (
                <div>
                  <p className="text-sm text-gray-500">State</p>
                  <p className="font-medium">{customerHistory.state}</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Deleted Items History</h3>
            {customerHistory.deleted_items && customerHistory.deleted_items.length > 0 ? (
              <div className="overflow-x-auto">
                {/* Filter to show only the latest deletion per item_code, fallback to id or index */}
                {(() => {
                  const latestByKey = new Map();
                  customerHistory.deleted_items.forEach((item, index) => {
                    const key = item.item_code || item.product_id || item.id || index;
                    if (!latestByKey.has(key) || new Date(item.deleted_at) > new Date(latestByKey.get(key).deleted_at)) {
                      latestByKey.set(key, item);
                    }
                  });
                  const uniqueDeletedItems = Array.from(latestByKey.values());
                  return (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount %</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount Amt</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax %</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {uniqueDeletedItems.map((item: DeletedItem, index: number) => (
                          <tr key={item.id || item.item_code || item.product_id || index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(item.deleted_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {item.product_name}
                              </div>
                              {item.item_code && (
                                <div className="text-sm text-gray-500">{item.item_code}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.product_type || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency(item.price || 0)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.discount_percent != null ? `${item.discount_percent}%` : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.discount_amount != null ? formatCurrency(item.discount_amount) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.tax_percent != null ? `${item.tax_percent}%` : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {formatCurrency((item.price || 0) * (item.quantity || 1))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-lg font-medium mb-2">No deleted items found</div>
                <div className="text-sm">This customer has no deleted items in their history.</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!selectedCustomer && !loading && !showResults && searchValue.trim() === '' && (
        <Card className="p-6">
          <div className="text-center py-8 text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <div className="text-lg font-medium mb-2">Search for a Customer</div>
            <div className="text-sm">
              Use the search bar above to find a customer by name, mobile number, reference number, or prescription number.
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default CustomerHistoryViewer;