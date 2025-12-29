import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
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
    product_code: ''
  });
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);

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
    try {
      setLoading(true);
      const response = await apiClient.post(config.api.itemsAdvancedSearch, advancedSearch);
      setItems(response.data.items);
      setTotalPages(1);
    } catch (error) {
      console.error('Error in advanced search:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const data = items.map(item => ({
      'Product Name': item.product_name,
      'Product Code': item.product_code,
      'Brand': item.brand,
      'HSN Number': item.hsn_number,
      'Tax Rate': item.tax_rate,
      'Sale Rate': item.sale_rate,
      'Purchase Rate': user?.role === 'super_admin' ? item.purchase_rate : 'N/A',
      'Quantity': item.quantity,
      'Alert Quantity': item.alert_quantity,
      'Rack Number': item.rack_number
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Items');
    XLSX.writeFile(wb, 'stock_items.xlsx');
  };

  const shouldShowPurchaseRate = user?.role === 'super_admin';
  const canEdit = user?.role === 'admin' || user?.role === 'super_admin';
  const canDelete = user?.role === 'super_admin';

  const handleEdit = (item) => {
    setEditingItem(item);
    setEditFormData({
      product_name: item.product_name || '',
      product_code: item.product_code || '',
      brand: item.brand || '',
      hsn_number: item.hsn_number || '',
      tax_rate: item.tax_rate || 0,
      sale_rate: item.sale_rate || 0,
      purchase_rate: item.purchase_rate || 0,
      quantity: item.quantity || 0,
      alert_quantity: item.alert_quantity || 0,
      rack_number: item.rack_number || ''
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editingItem) return;

    // Validation
    if (!editFormData.product_name || editFormData.product_name.trim() === '') {
      alert('Product name is required');
      return;
    }

    if (!editFormData.sale_rate || editFormData.sale_rate <= 0) {
      alert('Sale rate is required and must be greater than 0');
      return;
    }

    if (user?.role === 'super_admin' && (!editFormData.purchase_rate || editFormData.purchase_rate <= 0)) {
      alert('Purchase rate is required and must be greater than 0');
      return;
    }

    if (editFormData.quantity === undefined || editFormData.quantity < 0) {
      alert('Quantity must be 0 or greater');
      return;
    }

    try {
      await apiClient.put(`${config.api.items}/${editingItem.id}`, editFormData);
      alert('Item updated successfully!');
      setShowEditModal(false);
      setEditingItem(null);
      fetchItems(); // Refresh the list
    } catch (error) {
      alert('Error updating item: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  const handleDelete = async (itemId, productName) => {
    if (!window.confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.delete(`${config.api.items}/${itemId}`);
      alert('Item deleted successfully!');
      fetchItems(); // Refresh the list
    } catch (error) {
      alert('Error deleting item: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  return (
    <Layout>
      <div className="dashboard">
        <div className="dashboard-header">
          <h2>Stock Dashboard</h2>
          <button onClick={exportToExcel} className="btn btn-success">
            Export to Excel
          </button>
        </div>

        <div className="search-container">
          <select
            value={searchField}
            onChange={(e) => setSearchField(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="product_name">Product Name</option>
            <option value="brand">Brand</option>
            <option value="product_code">Product Code</option>
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
                placeholder="Product Code"
                value={advancedSearch.product_code}
                onChange={(e) => setAdvancedSearch({ ...advancedSearch, product_code: e.target.value })}
              />
              <button onClick={handleAdvancedSearch} className="btn btn-primary">
                Search
              </button>
              <button
                onClick={() => {
                  setAdvancedSearch({ product_name: '', brand: '', product_code: '' });
                  fetchItems();
                }}
                className="btn btn-secondary"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <div className="pagination-controls">
          <label>
            Records per page:
            <select
              value={limit}
              onChange={(e) => {
                setLimit(e.target.value === 'all' ? 10000 : parseInt(e.target.value));
                setPage(1);
              }}
              style={{ marginLeft: '10px', padding: '5px' }}
            >
              <option value="200">200</option>
              <option value="100">100</option>
              <option value="50">50</option>
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
                    <th>Product Code</th>
                    <th>Brand</th>
                    <th>HSN</th>
                    <th>Tax Rate</th>
                    <th>Sale Rate</th>
                    {shouldShowPurchaseRate && <th>Purchase Rate</th>}
                    <th>Quantity</th>
                    <th>Alert Qty</th>
                    <th>Rack No</th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={shouldShowPurchaseRate ? (canEdit ? 12 : 11) : (canEdit ? 11 : 10)} style={{ textAlign: 'center' }}>
                        No items found
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr key={item.id}>
                        <td>{(page - 1) * limit + index + 1}</td>
                        <td>{item.product_name}</td>
                        <td>{item.product_code}</td>
                        <td>{item.brand}</td>
                        <td>{item.hsn_number}</td>
                        <td>{item.tax_rate}%</td>
                        <td>₹{item.sale_rate}</td>
                        {shouldShowPurchaseRate && <td>₹{item.purchase_rate}</td>}
                        <td>{item.quantity}</td>
                        <td>{item.alert_quantity}</td>
                        <td>{item.rack_number}</td>
                        {canEdit && (
                          <td>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button
                                onClick={() => handleEdit(item)}
                                className="btn btn-primary"
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                              >
                                Edit
                              </button>
                              {canDelete && (
                                <button
                                  onClick={() => handleDelete(item.id, item.product_name)}
                                  className="btn btn-danger"
                                  style={{ padding: '5px 10px', fontSize: '12px' }}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        )}
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

        {/* Edit Item Modal */}
        {showEditModal && editingItem && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Edit Item: {editingItem.product_name}</h3>
                <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
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
                  <div className="form-group">
                    <label>Tax Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editFormData.tax_rate}
                      onChange={(e) => setEditFormData({ ...editFormData, tax_rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Sale Rate *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editFormData.sale_rate}
                      onChange={(e) => setEditFormData({ ...editFormData, sale_rate: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  {shouldShowPurchaseRate && (
                    <div className="form-group">
                      <label>Purchase Rate *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editFormData.purchase_rate}
                        onChange={(e) => setEditFormData({ ...editFormData, purchase_rate: parseFloat(e.target.value) || 0 })}
                        required
                      />
                    </div>
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      min="0"
                      value={editFormData.quantity}
                      onChange={(e) => setEditFormData({ ...editFormData, quantity: parseInt(e.target.value) || 0 })}
                      required
                    />
                    <small style={{ color: '#666', fontSize: '12px' }}>Current stock quantity</small>
                  </div>
                  <div className="form-group">
                    <label>Alert Quantity</label>
                    <input
                      type="number"
                      min="0"
                      value={editFormData.alert_quantity}
                      onChange={(e) => setEditFormData({ ...editFormData, alert_quantity: parseInt(e.target.value) || 0 })}
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
              </div>
              <div className="modal-footer">
                <button onClick={() => setShowEditModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleUpdate} className="btn btn-primary">
                  Update Item
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


