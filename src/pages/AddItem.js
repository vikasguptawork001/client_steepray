import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './AddItem.css';

const AddItem = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [buyerParties, setBuyerParties] = useState([]);
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [buyerInfo, setBuyerInfo] = useState(null);
  const [buyerSearchQuery, setBuyerSearchQuery] = useState('');
  const [filteredBuyerParties, setFilteredBuyerParties] = useState([]);
  const [showBuyerSuggestions, setShowBuyerSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedItems, setSuggestedItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [newItem, setNewItem] = useState({
    product_name: '',
    product_code: '',
    brand: '',
    hsn_number: '',
    tax_rate: 18,
    sale_rate: 0,
    purchase_rate: 0,
    alert_quantity: 0,
    rack_number: '',
    remarks: ''
  });
  const [itemImage, setItemImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);

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
    if (buyerSearchQuery.trim() === '') {
      setFilteredBuyerParties(buyerParties);
      setShowBuyerSuggestions(false);
    } else {
      const filtered = buyerParties.filter(party =>
        party.party_name.toLowerCase().includes(buyerSearchQuery.toLowerCase()) ||
        (party.mobile_number && party.mobile_number.includes(buyerSearchQuery)) ||
        (party.address && party.address.toLowerCase().includes(buyerSearchQuery.toLowerCase()))
      );
      setFilteredBuyerParties(filtered);
      setShowBuyerSuggestions(true);
    }
  }, [buyerSearchQuery, buyerParties]);

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
      setBuyerSearchQuery(response.data.party.party_name);
      setShowBuyerSuggestions(false);
    } catch (error) {
      console.error('Error fetching buyer info:', error);
    }
  };

  const selectBuyerParty = (party) => {
    setSelectedBuyer(party.id);
    setBuyerSearchQuery(party.party_name);
    setShowBuyerSuggestions(false);
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

  const addItemToCart = async (item) => {
    try {
      // Fetch full item details from database to get all saved data
      const response = await apiClient.get(`${config.api.items}/${item.id}`);
      const fullItemData = response.data.item;
      
      // Parse tax_rate to ensure it's a number (backend might send it as string)
      const taxRateValue = fullItemData.tax_rate !== undefined && fullItemData.tax_rate !== null
        ? parseFloat(fullItemData.tax_rate)
        : 18;
      const validTaxRates = [5, 18, 28];
      const finalTaxRate = !isNaN(taxRateValue) && validTaxRates.includes(taxRateValue) 
        ? taxRateValue 
        : 18;
      
      console.log('addItemToCart - tax_rate from backend:', fullItemData.tax_rate, 'Type:', typeof fullItemData.tax_rate, 'Parsed:', taxRateValue, 'Final:', finalTaxRate);
      
      const existingItem = selectedItems.find(i => i.item_id === item.id);
      if (existingItem) {
        // If item already in cart, just increment quantity
        setSelectedItems(selectedItems.map(i =>
          i.item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        ));
      } else {
        // Add item with all saved data from database, only quantity is editable
        setSelectedItems([...selectedItems, {
          item_id: fullItemData.id,
          product_name: fullItemData.product_name,
          product_code: fullItemData.product_code || '',
          brand: fullItemData.brand || '',
          hsn_number: fullItemData.hsn_number || '',
          tax_rate: finalTaxRate, // Use the parsed and validated tax rate
          sale_rate: fullItemData.sale_rate,
          purchase_rate: fullItemData.purchase_rate || 0,
          quantity: 1, // Only this field will be editable
          alert_quantity: fullItemData.alert_quantity || 0,
          rack_number: fullItemData.rack_number || '',
          remarks: fullItemData.remarks || '',
          current_quantity: fullItemData.quantity || 0 // Store current quantity for reference
        }]);
      }
      setSearchQuery('');
      setSuggestedItems([]);
    } catch (error) {
      console.error('Error fetching item details:', error);
      toast.error('Error loading item details');
    }
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
    if (isAddingNewItem || isSubmitting) return;
    
    // Validation
    if (!newItem.product_name || newItem.product_name.trim() === '') {
      toast.error('Product name is required');
      return;
    }

    if (!newItem.sale_rate || newItem.sale_rate <= 0) {
      toast.error('Sale rate is required and must be greater than 0');
      return;
    }

    if (!newItem.purchase_rate || newItem.purchase_rate <= 0) {
      toast.error('Purchase rate is required and must be greater than 0');
      return;
    }

    // Validate sale_rate >= purchase_rate
    if (parseFloat(newItem.sale_rate) < parseFloat(newItem.purchase_rate)) {
      toast.error('Sale rate must be greater than or equal to purchase rate');
      return;
    }

    setIsAddingNewItem(true);
    try {
      // Create FormData for image upload
      const formData = new FormData();
      
      // Ensure tax_rate is explicitly handled - it should be a number (5, 18, or 28)
      const taxRateValue = newItem.tax_rate;
      const validTaxRates = [5, 18, 28];
      const finalTaxRate = validTaxRates.includes(taxRateValue) ? taxRateValue : 18;
      
      Object.keys(newItem).forEach(key => {
        if (key === 'tax_rate') {
          // Explicitly set tax_rate value
          formData.append(key, finalTaxRate.toString());
        } else if (key === 'sale_rate' || key === 'purchase_rate' || key === 'alert_quantity') {
          // Ensure numeric fields are sent as numbers
          const numValue = parseFloat(newItem[key]);
          formData.append(key, isNaN(numValue) ? '0' : numValue.toString());
        } else {
          formData.append(key, newItem[key] || '');
        }
      });
      if (itemImage) {
        formData.append('image', itemImage);
      }
      
      // Debug log to verify tax_rate is being sent correctly
      console.log('Sending tax_rate:', finalTaxRate, 'Original value:', taxRateValue);

      const response = await apiClient.post(config.api.items, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Fetch the created item to get all saved data, then add to cart
      const createdItemResponse = await apiClient.get(`${config.api.items}/${response.data.id}`);
      addItemToCart(createdItemResponse.data.item);
      
      // Reset form
      setNewItem({
        product_name: '',
        product_code: '',
        brand: '',
        hsn_number: '',
        tax_rate: 18,
        sale_rate: 0,
        purchase_rate: 0,
        alert_quantity: 0,
        rack_number: '',
        remarks: ''
      });
      setItemImage(null);
      setShowAddItemForm(false);
      
      // Show success message
      toast.success(`Product "${newItem.product_name}" added successfully! You can now set the quantity and add it to inventory.`);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Unknown error occurred';
      toast.error('Error adding item: ' + errorMessage);
    } finally {
      setIsAddingNewItem(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || isAddingNewItem) return;
    
    if (!selectedBuyer) {
      alert('Please select a buyer party');
      return;
    }
    if (selectedItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post(config.api.itemsPurchase, {
        buyer_party_id: selectedBuyer,
        items: selectedItems
      });
      toast.success('Items added successfully!');
      setSelectedItems([]);
      setSelectedBuyer('');
      setBuyerInfo(null);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Unknown error occurred';
      toast.error('Error saving items: ' + errorMessage);
    } finally {
      setIsSubmitting(false);
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
            <div className="search-wrapper" style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search buyer party by name, mobile, or address..."
                value={buyerSearchQuery}
                onChange={(e) => {
                  setBuyerSearchQuery(e.target.value);
                  if (!e.target.value) {
                    setSelectedBuyer('');
                    setBuyerInfo(null);
                  }
                }}
                onFocus={() => {
                  if (buyerSearchQuery) {
                    setShowBuyerSuggestions(true);
                  }
                }}
                required
              />
              {showBuyerSuggestions && filteredBuyerParties.length > 0 && (
                <div className="suggestions" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                  {filteredBuyerParties.map(party => (
                    <div
                      key={party.id}
                      className="suggestion-item"
                      onClick={() => selectBuyerParty(party)}
                    >
                      {party.party_name} {party.mobile_number && `- ${party.mobile_number}`}
                    </div>
                  ))}
                </div>
              )}
              {buyerSearchQuery && filteredBuyerParties.length === 0 && (
                <div className="suggestions" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000 }}>
                  <div className="suggestion-item">No buyer party found</div>
                </div>
              )}
            </div>
            {buyerParties.length === 0 && (
              <p style={{ color: '#ff6b6b', fontSize: '14px', marginTop: '5px' }}>
                No buyer parties found. Please <Link to="/add-buyer-party">add a buyer party</Link> first.
              </p>
            )}
          </div>

          {buyerInfo && (
            <div className="buyer-info" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '15px',
              marginTop: '15px',
              padding: '15px',
              backgroundColor: '#f9f9f9',
              borderRadius: '5px'
            }}>
              <div><strong>Name:</strong> {buyerInfo.party_name}</div>
              <div><strong>Mobile:</strong> {buyerInfo.mobile_number || 'N/A'}</div>
              <div><strong>Address:</strong> {buyerInfo.address || 'N/A'}</div>
              {buyerInfo.gst_number && <div><strong>GST Number:</strong> {buyerInfo.gst_number}</div>}
              <div><strong>Balance Amount:</strong> ₹{buyerInfo.balance_amount || 0}</div>
              <div><strong>Paid Amount:</strong> ₹{buyerInfo.paid_amount || 0}</div>
            </div>
          )}

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ margin: 0 }}>Search Item</label>
              <button
                type="button"
                onClick={() => setShowAddItemForm(!showAddItemForm)}
                className="btn btn-primary"
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: showAddItemForm ? '#95a5a6' : '#3498db',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>+</span>
                {showAddItemForm ? 'Hide Add Item Form' : 'Add New Item'}
              </button>
            </div>
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
                  <select
                    value={newItem.tax_rate}
                    onChange={(e) => {
                      const selectedTaxRate = parseFloat(e.target.value);
                      const validTaxRates = [5, 18, 28];
                      const finalTaxRate = validTaxRates.includes(selectedTaxRate) ? selectedTaxRate : 18;
                      console.log('Tax rate changed:', e.target.value, 'Parsed:', selectedTaxRate, 'Final:', finalTaxRate);
                      setNewItem({ ...newItem, tax_rate: finalTaxRate });
                    }}
                  >
                    <option value="5">5%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                  <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                    Selected: {newItem.tax_rate}%
                  </small>
                </div>
                <div className="form-group">
                  <label>Sale Rate *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.sale_rate === 0 ? '' : newItem.sale_rate}
                    onChange={(e) => {
                      const val = e.target.value;
                      const saleRate = val === '' ? 0 : parseFloat(val) || 0;
                      setNewItem({ ...newItem, sale_rate: saleRate });
                    }}
                    placeholder="0.00"
                    required
                    style={{
                      borderColor: newItem.sale_rate > 0 && newItem.purchase_rate > 0 && newItem.sale_rate < newItem.purchase_rate ? '#dc3545' : undefined
                    }}
                  />
                  {newItem.sale_rate > 0 && newItem.purchase_rate > 0 && newItem.sale_rate < newItem.purchase_rate && (
                    <small style={{ color: '#dc3545', display: 'block', marginTop: '5px' }}>
                      ⚠️ Sale rate must be ≥ purchase rate
                    </small>
                  )}
                </div>
                <div className="form-group">
                  <label>Purchase Rate *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.purchase_rate === 0 ? '' : newItem.purchase_rate}
                    onChange={(e) => {
                      const val = e.target.value;
                      const purchaseRate = val === '' ? 0 : parseFloat(val) || 0;
                      setNewItem({ ...newItem, purchase_rate: purchaseRate });
                    }}
                    placeholder="0.00"
                    required
                    style={{
                      borderColor: newItem.sale_rate > 0 && newItem.purchase_rate > 0 && newItem.sale_rate < newItem.purchase_rate ? '#dc3545' : undefined
                    }}
                  />
                  {newItem.sale_rate > 0 && newItem.purchase_rate > 0 && newItem.sale_rate < newItem.purchase_rate && (
                    <small style={{ color: '#dc3545', display: 'block', marginTop: '5px' }}>
                      ⚠️ Purchase rate cannot be greater than sale rate
                    </small>
                  )}
                  {newItem.sale_rate > 0 && newItem.purchase_rate > 0 && newItem.sale_rate >= newItem.purchase_rate && (
                    <small style={{ color: '#28a745', display: 'block', marginTop: '5px' }}>
                      ✓ Valid: Profit margin: ₹{(newItem.sale_rate - newItem.purchase_rate).toFixed(2)} ({(newItem.purchase_rate > 0 ? (((newItem.sale_rate - newItem.purchase_rate) / newItem.purchase_rate) * 100).toFixed(2) : 0)}%)
                    </small>
                  )}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Alert Quantity</label>
                  <input
                    type="number"
                    value={newItem.alert_quantity === 0 ? '' : newItem.alert_quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewItem({ ...newItem, alert_quantity: val === '' ? 0 : parseInt(val) || 0 });
                    }}
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
              <div className="form-group">
                <label>Remarks (Max 200 characters)</label>
                <textarea
                  value={newItem.remarks}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 200) {
                      setNewItem({ ...newItem, remarks: value });
                    }
                  }}
                  rows="3"
                  maxLength={200}
                  placeholder="Enter remarks..."
                />
                <small style={{ color: '#666', fontSize: '12px' }}>
                  {newItem.remarks?.length || 0}/200 characters
                </small>
              </div>
              <div className="form-group">
                <label>Product Image (Max 3MB)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      if (file.size > 3 * 1024 * 1024) {
                        alert('Image size must be less than 3MB');
                        e.target.value = '';
                        return;
                      }
                      setItemImage(file);
                    }
                  }}
                />
                {itemImage && (
                  <div style={{ marginTop: '10px' }}>
                    <img 
                      src={URL.createObjectURL(itemImage)} 
                      alt="Preview" 
                      style={{ maxWidth: '200px', maxHeight: '200px' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setItemImage(null);
                        document.querySelector('input[type="file"]').value = '';
                      }}
                      style={{ marginLeft: '10px', padding: '5px 10px' }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Preview Section */}
              {(newItem.product_name || newItem.sale_rate > 0 || newItem.purchase_rate > 0) && (
                <div style={{ 
                  marginTop: '20px', 
                  padding: '15px', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '5px',
                  border: '1px solid #dee2e6'
                }}>
                  <h4 style={{ marginTop: 0, marginBottom: '15px', color: '#495057' }}>Preview</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                    {newItem.product_name && (
                      <div>
                        <strong>Product Name:</strong> {newItem.product_name}
                      </div>
                    )}
                    {newItem.product_code && (
                      <div>
                        <strong>Product Code:</strong> {newItem.product_code}
                      </div>
                    )}
                    {newItem.brand && (
                      <div>
                        <strong>Brand:</strong> {newItem.brand}
                      </div>
                    )}
                    {newItem.hsn_number && (
                      <div>
                        <strong>HSN:</strong> {newItem.hsn_number}
                      </div>
                    )}
                    {newItem.tax_rate > 0 && (
                      <div>
                        <strong>Tax Rate:</strong> {newItem.tax_rate}%
                      </div>
                    )}
                    {newItem.sale_rate > 0 && (
                      <div>
                        <strong>Sale Rate:</strong> ₹{parseFloat(newItem.sale_rate).toFixed(2)}
                      </div>
                    )}
                    {newItem.purchase_rate > 0 && (
                      <div>
                        <strong>Purchase Rate:</strong> ₹{parseFloat(newItem.purchase_rate).toFixed(2)}
                      </div>
                    )}
                    {newItem.sale_rate > 0 && newItem.purchase_rate > 0 && (
                      <div style={{
                        gridColumn: '1 / -1',
                        padding: '10px',
                        backgroundColor: newItem.sale_rate >= newItem.purchase_rate ? '#d4edda' : '#f8d7da',
                        borderRadius: '5px',
                        border: `1px solid ${newItem.sale_rate >= newItem.purchase_rate ? '#c3e6cb' : '#f5c6cb'}`
                      }}>
                        <strong>Profit Analysis:</strong>
                        {newItem.sale_rate >= newItem.purchase_rate ? (
                          <div style={{ color: '#155724', marginTop: '5px' }}>
                            ✓ Profit Margin: ₹{(newItem.sale_rate - newItem.purchase_rate).toFixed(2)}
                            {newItem.purchase_rate > 0 && (
                              <span> ({(newItem.purchase_rate > 0 ? (((newItem.sale_rate - newItem.purchase_rate) / newItem.purchase_rate) * 100).toFixed(2) : 0)}%)</span>
                            )}
                          </div>
                        ) : (
                          <div style={{ color: '#721c24', marginTop: '5px' }}>
                            ⚠️ Invalid: Sale rate is less than purchase rate (Loss: ₹{(newItem.purchase_rate - newItem.sale_rate).toFixed(2)})
                          </div>
                        )}
                      </div>
                    )}
                    {newItem.alert_quantity > 0 && (
                      <div>
                        <strong>Alert Quantity:</strong> {newItem.alert_quantity}
                      </div>
                    )}
                    {newItem.rack_number && (
                      <div>
                        <strong>Rack Number:</strong> {newItem.rack_number}
                      </div>
                    )}
                    {newItem.remarks && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <strong>Remarks:</strong> {newItem.remarks}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button 
                  onClick={handleAddNewItem} 
                  className="btn btn-primary"
                  disabled={isAddingNewItem || isSubmitting}
                  style={{
                    opacity: (isAddingNewItem || isSubmitting) ? 0.6 : 1,
                    cursor: (isAddingNewItem || isSubmitting) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isAddingNewItem ? 'Adding...' : 'Add Product'}
                </button>
                <button onClick={() => {
                  setShowAddItemForm(false);
                  setNewItem({
                    product_name: '',
                    product_code: '',
                    brand: '',
                    hsn_number: '',
                    tax_rate: 18,
                    sale_rate: 0,
                    purchase_rate: 0,
                    alert_quantity: 0,
                    rack_number: '',
                    remarks: ''
                  });
                  setItemImage(null);
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
                    <th>Remarks</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((item, index) => (
                    <tr key={index}>
                      <td>{item.product_name}</td>
                      <td>
                        <span style={{ padding: '5px', display: 'inline-block' }}>{item.product_code || '-'}</span>
                      </td>
                      <td>
                        <span style={{ padding: '5px', display: 'inline-block' }}>{item.brand || '-'}</span>
                      </td>
                      <td>
                        <span style={{ padding: '5px', display: 'inline-block' }}>{item.hsn_number || '-'}</span>
                      </td>
                      <td>
                        <span style={{ padding: '5px', display: 'inline-block' }}>{item.tax_rate || 0}%</span>
                      </td>
                      <td>
                        <span style={{ padding: '5px', display: 'inline-block' }}>₹{parseFloat(item.sale_rate || 0).toFixed(2)}</span>
                      </td>
                      <td>
                        <span style={{ padding: '5px', display: 'inline-block' }}>₹{parseFloat(item.purchase_rate || 0).toFixed(2)}</span>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={(e) => {
                            const val = e.target.value;
                            const qty = val === '' ? 0 : parseInt(val) || 0;
                            if (qty >= 0) {
                              updateItem(item.item_id, 'quantity', qty);
                            }
                          }}
                          style={{ width: '80px', fontWeight: 'bold' }}
                          placeholder="Qty"
                        />
                        {item.current_quantity !== undefined && (
                          <small style={{ display: 'block', color: '#666', fontSize: '11px', marginTop: '2px' }}>
                            Current: {item.current_quantity}
                          </small>
                        )}
                      </td>
                      <td>
                        <span style={{ padding: '5px', display: 'inline-block' }}>{item.alert_quantity || 0}</span>
                      </td>
                      <td>
                        <span style={{ padding: '5px', display: 'inline-block' }}>{item.rack_number || '-'}</span>
                      </td>
                      <td>
                        <span style={{ padding: '5px', display: 'inline-block', fontSize: '12px' }} title={item.remarks || ''}>
                          {item.remarks ? (item.remarks.length > 20 ? item.remarks.substring(0, 20) + '...' : item.remarks) : '-'}
                        </span>
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
              <button 
                onClick={handleSubmit} 
                className="btn btn-primary" 
                disabled={isSubmitting || isAddingNewItem}
                style={{ 
                  marginTop: '20px',
                  opacity: (isSubmitting || isAddingNewItem) ? 0.6 : 1,
                  cursor: (isSubmitting || isAddingNewItem) ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? 'Saving...' : 'Save Items'}
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AddItem;


