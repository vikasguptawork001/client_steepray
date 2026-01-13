import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import * as XLSX from 'xlsx';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(200);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState('product_name');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [advancedSearch, setAdvancedSearch] = useState({
    product_name: '',
    brand: '',
    remarks: ''
  });
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQuickSaleModal, setShowQuickSaleModal] = useState(false);
  const [quickSaleItem, setQuickSaleItem] = useState(null);
  const [quickSaleQuantity, setQuickSaleQuantity] = useState(1);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [totalStockAmount, setTotalStockAmount] = useState(null);
  const [showStockAmountModal, setShowStockAmountModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [quickSaleLoading, setQuickSaleLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [editItemImage, setEditItemImage] = useState(null);
  const [editItemImagePreview, setEditItemImagePreview] = useState(null);
  const [originalItemData, setOriginalItemData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [page, limit, search, searchField]);


  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(config.api.items, {
        params: { page, limit, search, searchField }
      });
      setItems(response.data.items);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdvancedSearch = async () => {
    if (searching) return;
    
    try {
      setSearching(true);
      setLoading(true);
      const response = await apiClient.post(config.api.itemsAdvancedSearch, advancedSearch);
      setItems(response.data.items);
      setTotalPages(1);
    } catch (error) {
      console.error('Error in advanced search:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  const fetchTotalStockAmount = async () => {
    try {
      const response = await apiClient.get(config.api.itemsStockTotal);
      const amount = response.data.total_stock_amount;
      // Ensure it's a number, default to 0 if null/undefined
      setTotalStockAmount(typeof amount === 'number' ? amount : (parseFloat(amount) || 0));
    } catch (error) {
      console.error('Error fetching total stock amount:', error);
      setTotalStockAmount(0);
    }
  };

  useEffect(() => {
    if (user?.role === 'super_admin') {
      fetchTotalStockAmount();
    }
  }, [user]);

  const exportToExcel = () => {
    if (exporting || items.length === 0) return;
    
    setExporting(true);
    try {
      const data = items.map(item => ({
        'Product Name': item.product_name,
        'Brand': item.brand,
        'HSN Number': item.hsn_number,
        'Tax Rate': item.tax_rate,
        'Sale Rate': item.sale_rate,
        'Purchase Rate': user?.role === 'super_admin' ? item.purchase_rate : 'N/A',
        'Quantity': item.quantity,
        'Rack Number': item.rack_number,
        'Remarks': item.remarks || ''
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Items');
      XLSX.writeFile(wb, 'stock_items.xlsx');
      toast.success('Excel file exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const canEdit = user?.role === 'admin' || user?.role === 'super_admin';
  const canDelete = user?.role === 'super_admin';

  const handleView = async (item) => {
    if (updating || deleting || quickSaleLoading || modalLoading) return;
    // Prevent opening if another modal is already open
    if (showEditModal || showQuickSaleModal || showStockAmountModal || showViewModal) {
      return;
    }
    setModalLoading(true);
    // Close all other modals first
    setShowEditModal(false);
    setShowQuickSaleModal(false);
    setShowStockAmountModal(false);
    setEditingItem(null);
    setOriginalItemData(null);
    setEditItemImage(null);
    setEditItemImagePreview(null);
    setQuickSaleItem(null);
    try {
      const response = await apiClient.get(`${config.api.items}/${item.id}`);
      setViewItem(response.data.item);
      setShowViewModal(true);
    } catch (error) {
      alert('Error fetching item details: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setModalLoading(false);
    }
  };

  const handleQuickSale = (item) => {
    if (updating || deleting || quickSaleLoading || modalLoading) return;
    // Prevent opening if another modal is already open
    if (showEditModal || showViewModal || showStockAmountModal || showQuickSaleModal) {
      return;
    }
    setModalLoading(true);
    // Close all other modals first
    setShowEditModal(false);
    setShowViewModal(false);
    setShowStockAmountModal(false);
    setEditingItem(null);
    setOriginalItemData(null);
    setEditItemImage(null);
    setEditItemImagePreview(null);
    setViewItem(null);
    setQuickSaleItem(item);
    setQuickSaleQuantity(1);
    setShowQuickSaleModal(true);
    setModalLoading(false);
  };

  const handleQuickSaleSubmit = async () => {
    if (quickSaleLoading) return;
    
    // Parse quantity and validate
    const qty = parseInt(quickSaleQuantity) || 0;
    
    if (!quickSaleItem || qty <= 0) {
      alert('Please enter a valid quantity');
      return;
    }

    if (qty > quickSaleItem.quantity) {
      alert(`Insufficient stock. Available: ${quickSaleItem.quantity}`);
      return;
    }

    setQuickSaleLoading(true);
    try {
      // Get retail seller party for quick sales
      const retailResponse = await apiClient.get(config.api.sellersRetail);
      const retailPartyId = retailResponse.data.party.id;

      // Create sale transaction (using retail buyer as seller party for quick sales)
      await apiClient.post(config.api.sale, {
        seller_party_id: retailPartyId,
        items: [{
          item_id: quickSaleItem.id,
          quantity: qty,
          sale_rate: parseFloat(quickSaleItem.sale_rate) || 0
        }],
        payment_status: 'fully_paid',
        paid_amount: quickSaleItem.sale_rate * qty,
        discount: 0,
        with_gst: false
      });

      toast.success('Quick sale completed successfully!');
      setShowQuickSaleModal(false);
      setQuickSaleItem(null);
      fetchItems();
      if (user?.role === 'super_admin') {
        fetchTotalStockAmount();
      }
    } catch (error) {
      toast.error('Error completing quick sale: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setQuickSaleLoading(false);
    }
  };

  const handleEdit = async (item) => {
    if (updating || deleting || quickSaleLoading || modalLoading) return;
    // Prevent opening if another modal is already open
    if (showViewModal || showQuickSaleModal || showStockAmountModal || showEditModal) {
      return;
    }
    setModalLoading(true);
    // Close all other modals first
    setShowViewModal(false);
    setShowQuickSaleModal(false);
    setShowStockAmountModal(false);
    setViewItem(null);
    setQuickSaleItem(null);
    
    setEditingItem(item);
    
    // Store original values for comparison
    const originalData = {
      product_name: item.product_name || '',
      product_code: item.product_code || '',
      brand: item.brand || '',
      hsn_number: item.hsn_number || '',
      tax_rate: item.tax_rate && [5, 18, 28].includes(parseFloat(item.tax_rate)) ? parseFloat(item.tax_rate) : 18,
      sale_rate: parseFloat(item.sale_rate) || 0,
      purchase_rate: parseFloat(item.purchase_rate) || 0,
      quantity: parseInt(item.quantity) || 0,
      alert_quantity: parseInt(item.alert_quantity) || 0,
      rack_number: item.rack_number || '',
      remarks: item.remarks || ''
    };
    setOriginalItemData(originalData);
    
    setEditFormData(originalData);
    // Fetch full item details to get image
    try {
      const response = await apiClient.get(`${config.api.items}/${item.id}`);
      if (response.data.item.image_base64) {
        setEditItemImagePreview(`data:image/jpeg;base64,${response.data.item.image_base64}`);
      } else {
        setEditItemImagePreview(null);
      }
    } catch (error) {
      console.error('Error fetching item image:', error);
      setEditItemImagePreview(null);
    } finally {
      setModalLoading(false);
    }
    setEditItemImage(null);
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editingItem || updating || !originalItemData) return;

    // Validation for fields that are being updated
    if (editFormData.product_name !== undefined) {
      if (!editFormData.product_name || editFormData.product_name.trim() === '') {
        toast.error('Product name is required');
        return;
      }
    }

    if (editFormData.sale_rate !== undefined) {
      if (!editFormData.sale_rate || editFormData.sale_rate <= 0) {
        toast.error('Sale rate is required and must be greater than 0');
        return;
      }
    }

    if (user?.role === 'super_admin' && editFormData.purchase_rate !== undefined) {
      if (!editFormData.purchase_rate || editFormData.purchase_rate <= 0) {
        toast.error('Purchase rate is required and must be greater than 0');
        return;
      }
    }

    // Validate sale_rate >= purchase_rate (check both current and original values)
    const finalSaleRate = editFormData.sale_rate !== undefined ? editFormData.sale_rate : originalItemData.sale_rate;
    const finalPurchaseRate = editFormData.purchase_rate !== undefined ? editFormData.purchase_rate : originalItemData.purchase_rate;
    if (finalSaleRate > 0 && finalPurchaseRate > 0 && parseFloat(finalSaleRate) < parseFloat(finalPurchaseRate)) {
      toast.error('Sale rate must be greater than or equal to purchase rate');
      return;
    }

    if (editFormData.quantity !== undefined && editFormData.quantity < 0) {
      toast.error('Quantity must be 0 or greater');
      return;
    }

    setUpdating(true);
    try {
      // Compare current form data with original data and only include changed fields
      const changedFields = {};
      
      Object.keys(editFormData).forEach(key => {
        const currentValue = editFormData[key];
        const originalValue = originalItemData[key];
        
        // Compare values (handle null/undefined and string trimming)
        const currentVal = currentValue !== null && currentValue !== undefined ? String(currentValue).trim() : '';
        const originalVal = originalValue !== null && originalValue !== undefined ? String(originalValue).trim() : '';
        
        // For numeric fields, compare as numbers
        if (['sale_rate', 'purchase_rate', 'quantity', 'alert_quantity', 'tax_rate'].includes(key)) {
          if (parseFloat(currentVal) !== parseFloat(originalVal)) {
            changedFields[key] = currentValue;
          }
        } else {
          // For string fields, compare as strings
          if (currentVal !== originalVal) {
            changedFields[key] = currentValue;
          }
        }
      });
      
      // Add image if a new one was selected
      if (editItemImage) {
        changedFields.image = editItemImage;
      }

      // If no fields changed, show message and return
      if (Object.keys(changedFields).length === 0) {
        toast.info('No changes detected');
        setUpdating(false);
        return;
      }

      // Create FormData for multipart/form-data (required for image upload)
      const formData = new FormData();
      Object.keys(changedFields).forEach(key => {
        if (key === 'image') {
          formData.append('image', changedFields[key]);
        } else if (changedFields[key] !== null && changedFields[key] !== undefined) {
          // Ensure numeric fields are sent as numbers (FormData will convert to string, but backend expects numeric strings)
          if (['sale_rate', 'purchase_rate', 'quantity', 'alert_quantity', 'tax_rate'].includes(key)) {
            const numValue = parseFloat(changedFields[key]);
            formData.append(key, isNaN(numValue) ? '0' : numValue.toString());
          } else {
            formData.append(key, changedFields[key]);
          }
        }
      });
      
      await apiClient.patch(`${config.api.items}/${editingItem.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Item updated successfully!');
      setShowEditModal(false);
      setEditingItem(null);
      setOriginalItemData(null);
      setEditItemImage(null);
      setEditItemImagePreview(null);
      fetchItems(); // Refresh the list
      if (user?.role === 'super_admin') {
        fetchTotalStockAmount();
      }
    } catch (error) {
      toast.error('Error updating item: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (itemId, productName) => {
    if (deleting) return;
    
    if (!window.confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      await apiClient.delete(`${config.api.items}/${itemId}`);
      toast.success('Item deleted successfully!');
      fetchItems(); // Refresh the list
      if (user?.role === 'super_admin') {
        fetchTotalStockAmount();
      }
    } catch (error) {
      toast.error('Error deleting item: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="dashboard">
        <div className="dashboard-header">
          <h2>Stock Dashboard</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {user?.role === 'super_admin' && (
              <button 
                onClick={async () => {
                  if (totalStockAmount === null) {
                    await fetchTotalStockAmount();
                  }
                  setShowStockAmountModal(true);
                }}
                className="btn btn-primary"
                style={{ 
                  padding: '10px 20px', 
                  fontWeight: 'bold',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {/* <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg> */}
                Total Stock Amount
              </button>
            )}
            <button 
              onClick={exportToExcel} 
              className="btn btn-success"
              disabled={exporting || items.length === 0}
            >
              {exporting ? 'Exporting...' : 'Export to Excel'}
            </button>
          </div>
        </div>

        <div className="search-container">
          <select
            value={searchField}
            onChange={(e) => setSearchField(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="product_name">Product Name</option>
            <option value="brand">Brand</option>
            <option value="remarks">Remarks</option>
          </select>
          <input
            type="text"
            placeholder="Quick Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            className="btn btn-secondary"
          >
            Advanced Search
          </button>
        </div>

        {showAdvancedSearch && (
          <div className="card advanced-search">
            <h3>Advanced Search</h3>
            <div className="search-container">
              <input
                type="text"
                placeholder="Product Name"
                value={advancedSearch.product_name}
                onChange={(e) => setAdvancedSearch({ ...advancedSearch, product_name: e.target.value })}
              />
              <input
                type="text"
                placeholder="Brand"
                value={advancedSearch.brand}
                onChange={(e) => setAdvancedSearch({ ...advancedSearch, brand: e.target.value })}
              />
              <input
                type="text"
                placeholder="Remarks"
                value={advancedSearch.remarks}
                onChange={(e) => setAdvancedSearch({ ...advancedSearch, remarks: e.target.value })}
              />
              <button 
                onClick={handleAdvancedSearch} 
                className="btn btn-primary"
                disabled={searching}
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
              <button
                onClick={() => {
                  setAdvancedSearch({ product_name: '', brand: '', remarks: '' });
                  fetchItems();
                }}
                className="btn btn-secondary"
                disabled={searching || loading}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <div className="dashboard-scrollable-content">
          <div className="pagination-controls">
            <label>
              Records per page:
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(e.target.value === 'all' ? 'all' : parseInt(e.target.value));
                  setPage(1);
                }}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                <option value="200">200 (Default)</option>
                <option value="500">500</option>
                <option value="2000">2000</option>
                <option value="all">All</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <>
              <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Product Name</th>
                    <th>Brand</th>
                    <th>HSN</th>
                    <th>Tax Rate</th>
                    <th>Sale Rate</th>
                    <th>Remarks</th>
                    <th>Quantity</th>
                    <th>Rack No</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center' }}>
                        No items found
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr key={item.id}>
                        <td>{(page - 1) * (typeof limit === 'number' ? limit : items.length) + index + 1}</td>
                        <td>{item.product_name}</td>
                        <td>{item.brand}</td>
                        <td>{item.hsn_number}</td>
                        <td>{item.tax_rate}%</td>
                        <td>₹{item.sale_rate}</td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.remarks || '-'}
                        </td>
                        <td>{item.quantity}</td>
                        <td>{item.rack_number}</td>
                        <td>
                          <div className="inline-action-buttons">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleView(item);
                              }}
                              disabled={modalLoading || updating || deleting || quickSaleLoading}
                              className="action-icon-btn"
                              title="View"
                              aria-label="View item"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                            </button>
                            {canEdit && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(item);
                                }}
                                disabled={modalLoading || updating || deleting || quickSaleLoading}
                                className="action-icon-btn"
                                title="Edit"
                                aria-label="Edit item"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickSale(item);
                              }}
                              disabled={modalLoading || updating || deleting || quickSaleLoading}
                              className="action-icon-btn"
                              title="Quick Sale"
                              aria-label="Quick sale"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 11l3 3L22 4"/>
                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                              </svg>
                            </button>
                            {canDelete && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(item.id, item.product_name);
                                }}
                                disabled={modalLoading || updating || deleting || quickSaleLoading}
                                className="action-icon-btn danger"
                                title="Delete"
                                aria-label="Delete item"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    Previous
                  </button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Edit Item Modal */}
        {showEditModal && editingItem && (
          <div className="modal-overlay" onClick={(e) => {
            // Prevent closing on backdrop click
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Edit Item: {editingItem.product_name}</h3>
                <button className="modal-close" onClick={() => {
                  setShowEditModal(false);
                  setEditingItem(null);
                  setOriginalItemData(null);
                  setEditItemImage(null);
                  setEditItemImagePreview(null);
                }}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    value={editFormData.product_name}
                    onChange={(e) => setEditFormData({ ...editFormData, product_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Product Code</label>
                  <input
                    type="text"
                    value={editFormData.product_code}
                    onChange={(e) => setEditFormData({ ...editFormData, product_code: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Brand</label>
                  <input
                    type="text"
                    value={editFormData.brand}
                    onChange={(e) => setEditFormData({ ...editFormData, brand: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>HSN Number</label>
                  <input
                    type="text"
                    value={editFormData.hsn_number}
                    onChange={(e) => setEditFormData({ ...editFormData, hsn_number: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  {user?.role === 'super_admin' && (
                    <div className="form-group">
                      <label>Purchase Rate *</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editFormData.purchase_rate === 0 ? '' : editFormData.purchase_rate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditFormData({ ...editFormData, purchase_rate: val === '' ? 0 : parseFloat(val) || 0 });
                          }}
                          required
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: editFormData.sale_rate > 0 && editFormData.purchase_rate > 0 && editFormData.sale_rate < editFormData.purchase_rate 
                              ? '2px solid #dc3545' 
                              : editFormData.sale_rate > 0 && editFormData.purchase_rate > 0 && editFormData.sale_rate >= editFormData.purchase_rate
                              ? '2px solid #28a745'
                              : '1px solid #ddd',
                            borderRadius: '6px',
                            fontSize: '14px',
                            transition: 'all 0.2s ease',
                            backgroundColor: editFormData.sale_rate > 0 && editFormData.purchase_rate > 0 && editFormData.sale_rate < editFormData.purchase_rate 
                              ? '#fff5f5' 
                              : editFormData.sale_rate > 0 && editFormData.purchase_rate > 0 && editFormData.sale_rate >= editFormData.purchase_rate
                              ? '#f0fff4'
                              : 'white'
                          }}
                        />
                        {editFormData.sale_rate > 0 && editFormData.purchase_rate > 0 && editFormData.sale_rate >= editFormData.purchase_rate && (
                          <span style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: '#28a745',
                            fontSize: '18px'
                          }}>✓</span>
                        )}
                      </div>
                      {editFormData.sale_rate > 0 && editFormData.purchase_rate > 0 && editFormData.sale_rate < editFormData.purchase_rate && (
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          marginTop: '6px',
                          padding: '8px 12px',
                          backgroundColor: '#fff5f5',
                          borderRadius: '6px',
                          border: '1px solid #fecaca'
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2" style={{ flexShrink: 0 }}>
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                          <small style={{ color: '#dc3545', fontSize: '13px', fontWeight: '500' }}>
                            Purchase rate (₹{parseFloat(editFormData.purchase_rate).toFixed(2)}) cannot exceed sale rate (₹{parseFloat(editFormData.sale_rate).toFixed(2)})
                          </small>
                        </div>
                      )}
                      {editFormData.sale_rate > 0 && editFormData.purchase_rate > 0 && editFormData.sale_rate >= editFormData.purchase_rate && (
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          marginTop: '6px',
                          padding: '8px 12px',
                          backgroundColor: '#f0fff4',
                          borderRadius: '6px',
                          border: '1px solid #c6f6d5'
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#28a745" strokeWidth="2" style={{ flexShrink: 0 }}>
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                          </svg>
                          <small style={{ color: '#28a745', fontSize: '13px', fontWeight: '500' }}>
                            Valid: Profit margin ₹{(editFormData.sale_rate - editFormData.purchase_rate).toFixed(2)} ({(editFormData.purchase_rate > 0 ? (((editFormData.sale_rate - editFormData.purchase_rate) / editFormData.purchase_rate) * 100).toFixed(2) : 0)}%)
                          </small>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="form-group">
                    <label>Tax Rate (%)</label>
                    <select
                      value={editFormData.tax_rate}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, tax_rate: parseFloat(e.target.value) || 18 });
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="5">5%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Sale Rate *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editFormData.sale_rate === 0 ? '' : editFormData.sale_rate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditFormData({ ...editFormData, sale_rate: val === '' ? 0 : parseFloat(val) || 0 });
                        }}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: editFormData.sale_rate > 0 && editFormData.purchase_rate > 0 && editFormData.sale_rate < editFormData.purchase_rate 
                            ? '2px solid #dc3545' 
                            : editFormData.sale_rate > 0 && editFormData.purchase_rate > 0 && editFormData.sale_rate >= editFormData.purchase_rate
                            ? '2px solid #28a745'
                            : '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'all 0.2s ease',
                          backgroundColor: editFormData.sale_rate > 0 && editFormData.purchase_rate > 0 && editFormData.sale_rate < editFormData.purchase_rate 
                            ? '#fff5f5' 
                            : editFormData.sale_rate > 0 && editFormData.purchase_rate > 0 && editFormData.sale_rate >= editFormData.purchase_rate
                            ? '#f0fff4'
                            : 'white'
                        }}
                      />
                      {editFormData.sale_rate > 0 && editFormData.purchase_rate > 0 && editFormData.sale_rate >= editFormData.purchase_rate && (
                        <span style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#28a745',
                          fontSize: '18px'
                        }}>✓</span>
                      )}
                    </div>
                    {editFormData.sale_rate > 0 && editFormData.purchase_rate > 0 && editFormData.sale_rate < editFormData.purchase_rate && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        marginTop: '6px',
                        padding: '8px 12px',
                        backgroundColor: '#fff5f5',
                        borderRadius: '6px',
                        border: '1px solid #fecaca'
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2" style={{ flexShrink: 0 }}>
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <small style={{ color: '#dc3545', fontSize: '13px', fontWeight: '500' }}>
                          Sale rate (₹{parseFloat(editFormData.sale_rate).toFixed(2)}) must be greater than or equal to purchase rate (₹{parseFloat(editFormData.purchase_rate).toFixed(2)})
                        </small>
                      </div>
                    )}
                    {editFormData.sale_rate > 0 && editFormData.purchase_rate > 0 && editFormData.sale_rate >= editFormData.purchase_rate && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        marginTop: '6px',
                        padding: '8px 12px',
                        backgroundColor: '#f0fff4',
                        borderRadius: '6px',
                        border: '1px solid #c6f6d5'
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#28a745" strokeWidth="2" style={{ flexShrink: 0 }}>
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <small style={{ color: '#28a745', fontSize: '13px', fontWeight: '500' }}>
                          Valid: Profit margin ₹{(editFormData.sale_rate - editFormData.purchase_rate).toFixed(2)} ({(editFormData.purchase_rate > 0 ? (((editFormData.sale_rate - editFormData.purchase_rate) / editFormData.purchase_rate) * 100).toFixed(2) : 0)}%)
                        </small>
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      min="0"
                      value={editFormData.quantity === 0 ? '' : editFormData.quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditFormData({ ...editFormData, quantity: val === '' ? 0 : parseInt(val) || 0 });
                      }}
                      required
                    />
                    <small style={{ color: '#666', fontSize: '12px' }}>Current stock quantity</small>
                  </div>
                  <div className="form-group">
                    <label>Alert Quantity</label>
                    <input
                      type="number"
                      min="0"
                      value={editFormData.alert_quantity === 0 ? '' : editFormData.alert_quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditFormData({ ...editFormData, alert_quantity: val === '' ? 0 : parseInt(val) || 0 });
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Rack Number</label>
                    <input
                      type="text"
                      value={editFormData.rack_number}
                      onChange={(e) => setEditFormData({ ...editFormData, rack_number: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Remarks (Max 200 characters)</label>
                  <textarea
                    value={editFormData.remarks}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 200) {
                        setEditFormData({ ...editFormData, remarks: value });
                      }
                    }}
                    rows="3"
                    maxLength={200}
                    placeholder="Enter remarks..."
                  />
                  <small style={{ color: '#666', fontSize: '12px' }}>
                    {editFormData.remarks?.length || 0}/200 characters
                  </small>
                </div>
                <div className="form-group">
                  <label>Product Image (Max 3MB)</label>
                  <input
                    id="edit-image-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        if (file.size > 3 * 1024 * 1024) {
                          toast.error('Image size must be less than 3MB');
                          e.target.value = '';
                          return;
                        }
                        setEditItemImage(file);
                        setEditItemImagePreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                  {(editItemImagePreview || editItemImage) && (
                    <div style={{ marginTop: '10px' }}>
                      <img 
                        src={editItemImagePreview} 
                        alt="Preview" 
                        style={{ maxWidth: '200px', maxHeight: '200px' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEditItemImage(null);
                          setEditItemImagePreview(null);
                          // Reset file input
                          const fileInput = document.querySelector('#edit-image-input');
                          if (fileInput) fileInput.value = '';
                        }}
                        style={{ marginLeft: '10px', padding: '5px 10px' }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {!editItemImagePreview && !editItemImage && (
                    <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                      Leave empty to keep current image, or select a new image to replace it
                    </small>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button onClick={() => {
                  setShowEditModal(false);
                  setEditingItem(null);
                  setOriginalItemData(null);
                  setEditItemImage(null);
                  setEditItemImagePreview(null);
                }} className="btn btn-secondary">
                  Cancel
                </button>
                <button 
                  onClick={handleUpdate} 
                  className="btn btn-primary"
                  disabled={updating}
                >
                  {updating ? 'Updating...' : 'Update Item'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Sale Modal */}
        {showQuickSaleModal && quickSaleItem && (
          <div className="modal-overlay" onClick={(e) => {
            // Prevent closing on backdrop click
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}>
            <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Quick Sale - {quickSaleItem.product_name}</h3>
                <button className="modal-close" onClick={() => {
                  setShowQuickSaleModal(false);
                  setQuickSaleItem(null);
                  setQuickSaleQuantity(1);
                }}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Product: {quickSaleItem.product_name}</label>
                </div>
                <div className="form-group">
                  <label>Brand: {quickSaleItem.brand || 'N/A'}</label>
                </div>
                <div className="form-group">
                  <label>Sale Rate: ₹{quickSaleItem.sale_rate}</label>
                </div>
                <div className="form-group">
                  <label>Available Quantity: {quickSaleItem.quantity}</label>
                </div>
                <div className="form-group">
                  <label>Quantity to Sell *</label>
                  <input
                    type="number"
                    min="1"
                    max={quickSaleItem.quantity}
                    value={quickSaleQuantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Allow empty string and intermediate states during typing
                      if (val === '') {
                        setQuickSaleQuantity('');
                        return;
                      }
                      const qty = parseInt(val);
                      // Allow any number during typing, we'll validate on blur
                      if (!isNaN(qty) && qty >= 0) {
                        // Clamp to max available quantity
                        const finalQty = Math.min(qty, quickSaleItem.quantity);
                        setQuickSaleQuantity(finalQty);
                      }
                    }}
                    onBlur={(e) => {
                      // Validate and set minimum value on blur
                      const val = e.target.value;
                      const qty = parseInt(val) || 0;
                      if (qty < 1) {
                        setQuickSaleQuantity(1);
                      } else if (qty > quickSaleItem.quantity) {
                        setQuickSaleQuantity(quickSaleItem.quantity);
                      } else {
                        setQuickSaleQuantity(qty);
                      }
                    }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Total Amount: ₹{((quickSaleItem.sale_rate || 0) * (parseInt(quickSaleQuantity) || 0)).toFixed(2)}</label>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '5px', marginTop: '10px' }}>
                  <strong>Note:</strong> This will be sold to the default "Retail Seller" party.
                </div>
              </div>
              <div className="modal-footer">
                <button onClick={() => {
                  setShowQuickSaleModal(false);
                  setQuickSaleItem(null);
                  setQuickSaleQuantity(1);
                }} className="btn btn-secondary">
                  Cancel
                </button>
                <button 
                  onClick={handleQuickSaleSubmit} 
                  className="btn btn-primary"
                  disabled={quickSaleLoading}
                >
                  {quickSaleLoading ? 'Processing...' : 'Confirm Sale'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Item Modal */}
        {showViewModal && viewItem && (
          <div className="modal-overlay" onClick={(e) => {
            // Prevent closing on backdrop click
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}>
            <div className="modal-content view-item-modal" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header" style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderBottom: 'none',
                padding: '25px 30px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>{viewItem.product_name}</h3>
                    <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                      {viewItem.product_code || 'No Product Code'}
                    </p>
                  </div>
                </div>
                <button className="modal-close" onClick={() => {
                  setShowViewModal(false);
                  setViewItem(null);
                }} style={{ color: 'white' }}>×</button>
              </div>
              <div className="modal-body" style={{ padding: '30px', background: '#f8f9fa' }}>
                {/* Image Section */}
                {viewItem.image_base64 && (
                  <div style={{
                    marginBottom: '30px',
                    textAlign: 'center',
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}>
                    <img 
                      src={`data:image/jpeg;base64,${viewItem.image_base64}`} 
                      alt={viewItem.product_name}
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '400px', 
                        borderRadius: '8px',
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                )}

                {/* Stock Status Card */}
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '25px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  borderLeft: `4px solid ${viewItem.quantity <= viewItem.alert_quantity ? '#f44336' : '#4caf50'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#333' }}>Stock Status</h4>
                    <span style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: viewItem.quantity <= viewItem.alert_quantity ? '#ffebee' : '#e8f5e9',
                      color: viewItem.quantity <= viewItem.alert_quantity ? '#c62828' : '#2e7d32'
                    }}>
                      {viewItem.quantity <= viewItem.alert_quantity ? '⚠️ Low Stock' : '✓ In Stock'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px', fontWeight: '500' }}>Current Quantity</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#333' }}>{viewItem.quantity}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px', fontWeight: '500' }}>Alert Quantity</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#666' }}>{viewItem.alert_quantity}</div>
                    </div>
                  </div>
                </div>

                {/* Product Information Card */}
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '25px',
                  marginBottom: '25px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}>
                  <h4 style={{ 
                    margin: '0 0 20px 0', 
                    fontSize: '18px', 
                    fontWeight: '600', 
                    color: '#333',
                    paddingBottom: '15px',
                    borderBottom: '2px solid #f0f0f0'
                  }}>
                    Product Information
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Brand</div>
                      <div style={{ fontSize: '16px', color: '#333', fontWeight: '500' }}>{viewItem.brand || 'N/A'}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>HSN Number</div>
                      <div style={{ fontSize: '16px', color: '#333', fontWeight: '500' }}>{viewItem.hsn_number || 'N/A'}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rack Number</div>
                      <div style={{ fontSize: '16px', color: '#333', fontWeight: '500' }}>{viewItem.rack_number || 'N/A'}</div>
                    </div>
                    {viewItem.remarks && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Remarks</div>
                        <div style={{ 
                          fontSize: '14px', 
                          color: '#555', 
                          padding: '12px',
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          lineHeight: '1.6'
                        }}>{viewItem.remarks}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pricing Information Card */}
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '25px',
                  marginBottom: '25px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}>
                  <h4 style={{ 
                    margin: '0 0 20px 0', 
                    fontSize: '18px', 
                    fontWeight: '600', 
                    color: '#333',
                    paddingBottom: '15px',
                    borderBottom: '2px solid #f0f0f0'
                  }}>
                    Pricing & Tax Information
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: user?.role === 'super_admin' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: '20px' }}>
                    {user?.role === 'super_admin' && (
                      <div style={{
                        padding: '15px',
                        background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                        borderRadius: '10px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', marginBottom: '8px' }}>Purchase Rate</div>
                        <div style={{ fontSize: '22px', fontWeight: '700', color: '#667eea' }}>₹{parseFloat(viewItem.purchase_rate || 0).toFixed(2)}</div>
                      </div>
                    )}
                    <div style={{
                      padding: '15px',
                      background: 'linear-gradient(135deg, #f093fb15 0%, #f5576c15 100%)',
                      borderRadius: '10px',
                      border: '1px solid #e0e0e0'
                    }}>
                      <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', marginBottom: '8px' }}>Tax Rate</div>
                      <div style={{ fontSize: '22px', fontWeight: '700', color: '#f5576c' }}>{viewItem.tax_rate}%</div>
                    </div>
                    <div style={{
                      padding: '15px',
                      background: 'linear-gradient(135deg, #4facfe15 0%, #00f2fe15 100%)',
                      borderRadius: '10px',
                      border: '1px solid #e0e0e0'
                    }}>
                      <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', marginBottom: '8px' }}>Sale Rate</div>
                      <div style={{ fontSize: '22px', fontWeight: '700', color: '#4facfe' }}>₹{parseFloat(viewItem.sale_rate || 0).toFixed(2)}</div>
                    </div>
                    {user?.role === 'super_admin' && viewItem.purchase_rate > 0 && (
                      <div style={{
                        padding: '15px',
                        background: 'linear-gradient(135deg, #43e97b15 0%, #38f9d715 100%)',
                        borderRadius: '10px',
                        border: '1px solid #e0e0e0',
                        gridColumn: '1 / -1'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', marginBottom: '8px' }}>Profit Margin</div>
                        <div style={{ fontSize: '22px', fontWeight: '700', color: '#43e97b' }}>
                          ₹{(parseFloat(viewItem.sale_rate || 0) - parseFloat(viewItem.purchase_rate || 0)).toFixed(2)} 
                          <span style={{ fontSize: '14px', marginLeft: '8px', color: '#666' }}>
                            ({((parseFloat(viewItem.sale_rate || 0) - parseFloat(viewItem.purchase_rate || 0)) / parseFloat(viewItem.purchase_rate || 1) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Audit Information Card */}
                {(viewItem.created_by_user || viewItem.created_at) && (
                  <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '25px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}>
                    <h4 style={{ 
                      margin: '0 0 20px 0', 
                      fontSize: '18px', 
                      fontWeight: '600', 
                      color: '#333',
                      paddingBottom: '15px',
                      borderBottom: '2px solid #f0f0f0'
                    }}>
                      Audit Information
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                      {viewItem.created_by_user && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created By</div>
                          <div style={{ fontSize: '15px', color: '#333', fontWeight: '500' }}>{viewItem.created_by_user}</div>
                        </div>
                      )}
                      {viewItem.created_at_formatted && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created At</div>
                          <div style={{ fontSize: '15px', color: '#333', fontWeight: '500' }}>{viewItem.created_at_formatted}</div>
                        </div>
                      )}
                      {viewItem.updated_by_user && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Updated By</div>
                          <div style={{ fontSize: '15px', color: '#333', fontWeight: '500' }}>{viewItem.updated_by_user}</div>
                        </div>
                      )}
                      {viewItem.updated_at_formatted && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#666', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Updated At</div>
                          <div style={{ fontSize: '15px', color: '#333', fontWeight: '500' }}>{viewItem.updated_at_formatted}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ 
                padding: '20px 30px',
                background: 'white',
                borderTop: '1px solid #f0f0f0',
                borderRadius: '0 0 12px 12px'
              }}>
                <button onClick={() => {
                  setShowViewModal(false);
                  setViewItem(null);
                }} className="btn btn-primary" style={{
                  padding: '12px 30px',
                  fontSize: '15px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Total Stock Amount Modal */}
        {showStockAmountModal && (
          <div className="modal-overlay" onClick={(e) => {
            // Prevent closing on backdrop click
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3>Total Stock Amount</h3>
                <button className="modal-close" onClick={() => setShowStockAmountModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                  <div style={{ 
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    {/* <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      backgroundColor: '#e8f5e9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2">
                        <line x1="12" y1="1" x2="12" y2="23"/>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                      </svg>
                    </div> */}
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
                      Total Value of All Stock Items
                    </p>
                    <h2 style={{ 
                      fontSize: '42px', 
                      color: '#4CAF50', 
                      margin: '10px 0',
                      fontWeight: 'bold',
                      fontFamily: 'monospace',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}>
                      <span style={{ fontSize: '42px' }}>₹</span>
                      <span>{totalStockAmount !== null && typeof totalStockAmount === 'number' ? totalStockAmount.toFixed(2) : '0.00'}</span>
                    </h2>
                  </div>
                  <div style={{ 
                    backgroundColor: '#f5f5f5', 
                    padding: '15px', 
                    borderRadius: '8px',
                    marginTop: '20px'
                  }}>
                    <p style={{ color: '#666', fontSize: '13px', margin: 0, lineHeight: '1.6' }}>
                      <strong>Calculation:</strong> Sum of (Purchase Rate × Quantity) for all items in inventory
                    </p>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  onClick={() => {
                    setShowStockAmountModal(false);
                    fetchTotalStockAmount(); // Refresh amount when closing
                  }} 
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;


