import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AddItem.css';

const AddItem = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [buyerParties, setBuyerParties] = useState([]);
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [buyerInfo, setBuyerInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedItems, setSuggestedItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [newItem, setNewItem] = useState({
    product_name: '',
    product_code: '',
    brand: '',
    hsn_number: '',
    tax_rate: 0,
    sale_rate: 0,
    purchase_rate: 0,
    alert_quantity: 0,
    rack_number: ''
  });

  useEffect(() => {
    // Check if user has permission to add items
    if (user) {
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        alert('Access Denied: Only Admin and Super Admin can add items to inventory.');
        navigate('/dashboard');
        return;
      }
      fetchBuyerParties();
    }
  }, [user, navigate]);

  useEffect(() => {
    if (selectedBuyer) {
      fetchBuyerInfo();
    }
  }, [selectedBuyer]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchItems();
    } else {
      setSuggestedItems([]);
    }
  }, [searchQuery]);

  const fetchBuyerParties = async () => {
    try {
      const response = await apiClient.get(config.api.buyers);
      setBuyerParties(response.data.parties);
    } catch (error) {
      console.error('Error fetching buyer parties:', error);
    }
  };

  const fetchBuyerInfo = async () => {
    try {
      const response = await apiClient.get(`${config.api.buyers}/${selectedBuyer}`);
      setBuyerInfo(response.data.party);
    } catch (error) {
      console.error('Error fetching buyer info:', error);
    }
  };

  const searchItems = async () => {
    try {
      const response = await apiClient.get(config.api.itemsSearch, {
        params: { q: searchQuery }
      });
      setSuggestedItems(response.data.items);
    } catch (error) {
      console.error('Error searching items:', error);
    }
  };

  const addItemToCart = (item) => {
    const existingItem = selectedItems.find(i => i.item_id === item.id);
    if (existingItem) {
      setSelectedItems(selectedItems.map(i =>
        i.item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setSelectedItems([...selectedItems, {
        item_id: item.id,
        product_name: item.product_name,
        product_code: item.product_code || '',
        brand: item.brand || '',
        hsn_number: '',
        tax_rate: 0,
        sale_rate: item.sale_rate,
        purchase_rate: 0,
        quantity: 1,
        alert_quantity: 0,
        rack_number: ''
      }]);
    }
    setSearchQuery('');
    setSuggestedItems([]);
  };

  const updateItem = (itemId, field, value) => {
    setSelectedItems(selectedItems.map(item =>
      item.item_id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (itemId) => {
    setSelectedItems(selectedItems.filter(item => item.item_id !== itemId));
  };

  const handleAddNewItem = async () => {
    // Validation
    if (!newItem.product_name || newItem.product_name.trim() === '') {
      alert('Product name is required');
      return;
    }

    if (!newItem.sale_rate || newItem.sale_rate <= 0) {
      alert('Sale rate is required and must be greater than 0');
      return;
    }

    if (!newItem.purchase_rate || newItem.purchase_rate <= 0) {
      alert('Purchase rate is required and must be greater than 0');
      return;
    }

    try {
      const response = await apiClient.post(config.api.items, newItem);
      
      // Add the newly created item to cart with quantity 1 (user can adjust)
      addItemToCart({ 
        ...newItem, 
        id: response.data.id,
        quantity: 1  // Default quantity, user can adjust
      });
      
      // Reset form
      setNewItem({
        product_name: '',
        product_code: '',
        brand: '',
        hsn_number: '',
        tax_rate: 0,
        sale_rate: 0,
        purchase_rate: 0,
        alert_quantity: 0,
        rack_number: ''
      });
      setShowAddItemForm(false);
      
      // Show success message
      alert('Product "' + newItem.product_name + '" added successfully! You can now set the quantity and add it to inventory.');
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Unknown error occurred';
      alert('Error adding item: ' + errorMessage);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBuyer) {
      alert('Please select a buyer party');
      return;
    }
    if (selectedItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    try {
      await apiClient.post(config.api.itemsPurchase, {
        buyer_party_id: selectedBuyer,
        items: selectedItems
      });
      alert('Items added successfully!');
      setSelectedItems([]);
      setSelectedBuyer('');
      setBuyerInfo(null);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Unknown error occurred';
      alert('Error saving items: ' + errorMessage);
    }
  };

  // Show access denied message if sales user somehow reaches here
  if (user && user.role !== 'admin' && user.role !== 'super_admin') {
    return (
      <Layout>
        <div className="add-item">
          <div style={{ padding: '20px', textAlign: 'center', color: '#ff6b6b' }}>
            <h2>Access Denied</h2>
            <p>Only Admin and Super Admin can add items to inventory.</p>
            <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: '20px' }}>
              Go to Dashboard
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="add-item">
        <h2>Add Item to Inventory</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Add new products to your inventory through purchase transactions. You can search for existing products or add new ones.
        </p>

        <div className="card">
          <div className="form-group">
            <label>Select Buyer Party *</label>
            <select
              value={selectedBuyer}
              onChange={(e) => setSelectedBuyer(e.target.value)}
              required
            >
              <option value="">-- Select Buyer Party --</option>
              {buyerParties.map(party => (
                <option key={party.id} value={party.id}>{party.party_name}</option>
              ))}
            </select>
            {buyerParties.length === 0 && (
              <p style={{ color: '#ff6b6b', fontSize: '14px', marginTop: '5px' }}>
                No buyer parties found. Please <Link to="/add-buyer-party">add a buyer party</Link> first.
              </p>
            )}
          </div>

          {buyerInfo && (
            <div className="buyer-info">
              <h3>Buyer Information</h3>
              <p><strong>Name:</strong> {buyerInfo.party_name}</p>
              <p><strong>Mobile:</strong> {buyerInfo.mobile_number}</p>
              <p><strong>Address:</strong> {buyerInfo.address}</p>
              <p><strong>Balance Amount:</strong> ₹{buyerInfo.balance_amount}</p>
              <p><strong>Paid Amount:</strong> ₹{buyerInfo.paid_amount}</p>
            </div>
          )}

          <div className="form-group">
            <label>Search Item</label>
            <div className="search-wrapper">
              <input
                type="text"
                placeholder="Type item name to search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {suggestedItems.length > 0 && (
                <div className="suggestions">
                  {suggestedItems.map(item => (
                    <div
                      key={item.id}
                      className="suggestion-item"
                      onClick={() => addItemToCart(item)}
                    >
                      {item.product_name} - {item.brand} (Qty: {item.quantity})
                    </div>
                  ))}
                </div>
              )}
              {searchQuery.length >= 2 && suggestedItems.length === 0 && (
                <div className="suggestions">
                  <div className="suggestion-item">
                    Item not found. <Link to="#" onClick={(e) => {
                      e.preventDefault();
                      setShowAddItemForm(true);
                    }}>Add New Product</Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {showAddItemForm && (
            <div className="card new-item-form">
              <h3>Add New Product</h3>
              <p style={{ color: '#666', marginBottom: '15px', fontSize: '14px' }}>
                Fill in the product details below. Fields marked with * are required.
              </p>
              <div className="form-row">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    value={newItem.product_name}
                    onChange={(e) => setNewItem({ ...newItem, product_name: e.target.value })}
                    placeholder="Enter product name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Product Code</label>
                  <input
                    type="text"
                    value={newItem.product_code}
                    onChange={(e) => setNewItem({ ...newItem, product_code: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Brand</label>
                  <input
                    type="text"
                    value={newItem.brand}
                    onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>HSN Number</label>
                  <input
                    type="text"
                    value={newItem.hsn_number}
                    onChange={(e) => setNewItem({ ...newItem, hsn_number: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Tax Rate (%)</label>
                  <input
                    type="number"
                    value={newItem.tax_rate}
                    onChange={(e) => setNewItem({ ...newItem, tax_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label>Sale Rate *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.sale_rate}
                    onChange={(e) => setNewItem({ ...newItem, sale_rate: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Purchase Rate *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.purchase_rate}
                    onChange={(e) => setNewItem({ ...newItem, purchase_rate: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Alert Quantity</label>
                  <input
                    type="number"
                    value={newItem.alert_quantity}
                    onChange={(e) => setNewItem({ ...newItem, alert_quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label>Rack Number</label>
                  <input
                    type="text"
                    value={newItem.rack_number}
                    onChange={(e) => setNewItem({ ...newItem, rack_number: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button onClick={handleAddNewItem} className="btn btn-primary">Add Product</button>
                <button onClick={() => {
                  setShowAddItemForm(false);
                  setNewItem({
                    product_name: '',
                    product_code: '',
                    brand: '',
                    hsn_number: '',
                    tax_rate: 0,
                    sale_rate: 0,
                    purchase_rate: 0,
                    alert_quantity: 0,
                    rack_number: ''
                  });
                }} className="btn btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {selectedItems.length > 0 && (
            <div className="selected-items">
              <h3>Selected Items</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Product Code</th>
                    <th>Brand</th>
                    <th>HSN</th>
                    <th>Tax Rate</th>
                    <th>Sale Rate</th>
                    <th>Purchase Rate</th>
                    <th>Quantity</th>
                    <th>Alert Qty</th>
                    <th>Rack No</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((item, index) => (
                    <tr key={index}>
                      <td>{item.product_name}</td>
                      <td>
                        <input
                          type="text"
                          value={item.product_code}
                          onChange={(e) => updateItem(item.item_id, 'product_code', e.target.value)}
                          style={{ width: '100px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.brand}
                          onChange={(e) => updateItem(item.item_id, 'brand', e.target.value)}
                          style={{ width: '100px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.hsn_number}
                          onChange={(e) => updateItem(item.item_id, 'hsn_number', e.target.value)}
                          style={{ width: '80px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={item.tax_rate}
                          onChange={(e) => updateItem(item.item_id, 'tax_rate', parseFloat(e.target.value) || 0)}
                          style={{ width: '80px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={item.sale_rate}
                          onChange={(e) => updateItem(item.item_id, 'sale_rate', parseFloat(e.target.value) || 0)}
                          style={{ width: '100px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={item.purchase_rate}
                          onChange={(e) => updateItem(item.item_id, 'purchase_rate', parseFloat(e.target.value) || 0)}
                          style={{ width: '100px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.item_id, 'quantity', parseInt(e.target.value) || 0)}
                          style={{ width: '80px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={item.alert_quantity}
                          onChange={(e) => updateItem(item.item_id, 'alert_quantity', parseInt(e.target.value) || 0)}
                          style={{ width: '80px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.rack_number}
                          onChange={(e) => updateItem(item.item_id, 'rack_number', e.target.value)}
                          style={{ width: '80px' }}
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => removeItem(item.item_id)}
                          className="btn btn-danger"
                          style={{ padding: '5px 10px' }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={handleSubmit} className="btn btn-primary" style={{ marginTop: '20px' }}>
                Save Items
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AddItem;


