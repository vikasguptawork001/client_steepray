import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import TransactionLoader from '../components/TransactionLoader';
import ItemSearchModal from '../components/ItemSearchModal';
import ActionMenu from '../components/ActionMenu';
import './AddItem.css';

const AddItem = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const itemSearchInputRef = useRef(null);
  const [buyerParties, setBuyerParties] = useState([]);
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [buyerInfo, setBuyerInfo] = useState(null);
  const [buyerSearchQuery, setBuyerSearchQuery] = useState('');
  const [filteredBuyerParties, setFilteredBuyerParties] = useState([]);
  const [showBuyerSuggestions, setShowBuyerSuggestions] = useState(false);
  const [loadingBuyerParties, setLoadingBuyerParties] = useState(true);
  const [buyerPartiesError, setBuyerPartiesError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [suggestedItems, setSuggestedItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set()); // For multi-select
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [newItem, setNewItem] = useState({
    product_name: '',
    product_code: '',
    brand: '',
    hsn_number: '',
    tax_rate: 18,
    sale_rate: 0,
    purchase_rate: 0,
    quantity: 1,
    alert_quantity: 0,
    rack_number: '',
    remarks: ''
  });
  const [itemImage, setItemImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  const [purchasePaymentStatus, setPurchasePaymentStatus] = useState('partially_paid');
  const [purchasePaidAmount, setPurchasePaidAmount] = useState(0);

  const purchaseTotal = selectedItems.reduce((sum, it) => {
    const qty = parseInt(it.quantity) || 0;
    const rate = parseFloat(it.purchase_rate) || 0;
    return sum + qty * rate;
  }, 0);
  // Round purchase total to whole number
  const roundedPurchaseTotal = Math.round(purchaseTotal);
  // Round paid amount to whole number (no decimals)
  const purchasePaidNow = purchasePaymentStatus === 'fully_paid' ? roundedPurchaseTotal : Math.max(0, Math.round(purchasePaidAmount || 0));
  // Calculate balance using rounded values
  const purchaseBalance = Math.max(0, roundedPurchaseTotal - purchasePaidNow);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  useEffect(() => {
    if (selectedBuyer) {
      fetchBuyerInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuyer]);

  useEffect(() => {
    if (buyerSearchQuery.trim() === '') {
      setFilteredBuyerParties(buyerParties);
      setShowBuyerSuggestions(false);
    } else {
      const trimmedQuery = buyerSearchQuery.trim().toLowerCase();
      const filtered = buyerParties.filter(party =>
        (party.party_name || '').toLowerCase().includes(trimmedQuery) ||
        (party.mobile_number && party.mobile_number.includes(buyerSearchQuery.trim())) ||
        (party.address && (party.address || '').toLowerCase().includes(trimmedQuery))
      );
      setFilteredBuyerParties(filtered);
      setShowBuyerSuggestions(true);
    }
  }, [buyerSearchQuery, buyerParties]);

  const [showItemSearchModal, setShowItemSearchModal] = useState(false);

  // Debounce search query - update debouncedSearchQuery after 1 second of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmedQuery = searchQuery.trim();
      setDebouncedSearchQuery(trimmedQuery);
    }, 1000); // 1 second delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const trimmedQuery = debouncedSearchQuery.trim();
    if (trimmedQuery.length >= 2) {
      searchItems();
      setShowItemSearchModal(true);
    } else {
      setSuggestedItems([]);
      // Don't close modal when search is cleared - only close explicitly
      // setShowItemSearchModal(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery]);

  const fetchBuyerParties = async () => {
    setLoadingBuyerParties(true);
    setBuyerPartiesError(null);
    try {
      const response = await apiClient.get(config.api.buyers);
      setBuyerParties(response.data.parties || []);
    } catch (error) {
      console.error('Error fetching buyer parties:', error);
      setBuyerPartiesError(error.response?.data?.error || 'Server error. Please try again.');
      toast.error('Error fetching buyer parties: ' + (error.response?.data?.error || 'Server error'));
    } finally {
      setLoadingBuyerParties(false);
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
      const trimmedQuery = debouncedSearchQuery.trim();
      const response = await apiClient.get(config.api.itemsSearch, {
        params: { 
          q: trimmedQuery,
          include_purchase_rate: 'true' // AddItem is for buyer purchase, needs purchase_rate
        }
      });
      setSuggestedItems(response.data.items);
    } catch (error) {
      console.error('Error searching items:', error);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleToggleItemSelection = (itemId) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // eslint-disable-next-line no-unused-vars
  const handleAddSelectedItems = async () => {
    if (selectedItemIds.size === 0) {
      toast.warning('Please select at least one item');
      return;
    }

    const itemsToAdd = suggestedItems.filter(item => selectedItemIds.has(item.id));
    let successCount = 0;
    let errorCount = 0;
    
    try {
      // Fetch all item details in a single batch API call
      const itemIds = itemsToAdd.map(item => item.id);
      const response = await apiClient.post(config.api.itemsDetails, {
        item_ids: itemIds,
        include_purchase_rate: true // AddItem is for buyer purchase, needs purchase_rate
      });

      // Create a map of item_id -> item details for quick lookup
      const itemsDetailsMap = new Map();
      if (response.data && response.data.items) {
        response.data.items.forEach(item => {
          itemsDetailsMap.set(item.id, item);
        });
      }

      // Add items to cart using batch API data
      setSelectedItems(prev => {
        const updatedItems = [...prev];
        itemsToAdd.forEach(item => {
          const itemDetails = itemsDetailsMap.get(item.id);
          if (!itemDetails) {
            errorCount++;
            return;
          }

          // Parse tax_rate
          const taxRateValue = itemDetails.tax_rate !== undefined && itemDetails.tax_rate !== null
            ? parseFloat(itemDetails.tax_rate)
            : 18;
          const validTaxRates = [5, 18, 28];
          const finalTaxRate = !isNaN(taxRateValue) && validTaxRates.includes(taxRateValue) 
            ? taxRateValue 
            : 18;

          const existingItemIndex = updatedItems.findIndex(i => i.item_id === item.id);
          if (existingItemIndex >= 0) {
            // If item already in cart, just increment quantity
            updatedItems[existingItemIndex] = {
              ...updatedItems[existingItemIndex],
              quantity: updatedItems[existingItemIndex].quantity + 1
            };
          } else {
            // Add new item to cart - use search data which now includes purchase_rate
            // Note: current_quantity should be the actual stock from the database
            // The quantity field is the purchase quantity (how many we're buying)
            updatedItems.push({
              item_id: itemDetails.id,
              product_name: itemDetails.product_name,
              product_code: itemDetails.product_code || '',
              brand: itemDetails.brand || '',
              hsn_number: itemDetails.hsn_number || '',
              tax_rate: finalTaxRate,
              sale_rate: parseFloat(itemDetails.sale_rate) || 0,
              purchase_rate: parseFloat(itemDetails.purchase_rate) || 0,
              quantity: 1, // Purchase quantity (how many we're buying) - starts at 1
              alert_quantity: 0, // Will be set when submitting
              rack_number: '', // Will be set when submitting
              remarks: '', // Will be set when submitting
              current_quantity: parseInt(itemDetails.quantity) || 0 // Actual stock from database
            });
          }
          successCount++;
        });
        return updatedItems;
      });
    } catch (error) {
      console.error('Error fetching batch item details:', error);
      toast.error('Error loading item details');
      errorCount += itemsToAdd.length;
    }
    
    if (successCount > 0) {
      toast.success(`✓ Added ${successCount} item${successCount !== 1 ? 's' : ''} to purchase list`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to add ${errorCount} item${errorCount !== 1 ? 's' : ''}`);
    }
    
    setSelectedItemIds(new Set());
    setSearchQuery('');
    setSuggestedItems([]);
  };

  const addItemToCart = async (item) => {
    try {
      // Note: We allow adding items even if out of stock, since this is for filling inventory
      // Use search data directly (which now includes purchase_rate) instead of making another API call
      // The search API already returns all necessary fields including purchase_rate
      
      // Parse tax_rate to ensure it's a number (backend might send it as string)
      const taxRateValue = item.tax_rate !== undefined && item.tax_rate !== null
        ? parseFloat(item.tax_rate)
        : 18;
      const validTaxRates = [5, 18, 28];
      const finalTaxRate = !isNaN(taxRateValue) && validTaxRates.includes(taxRateValue) 
        ? taxRateValue 
        : 18;
      
      const existingItem = selectedItems.find(i => i.item_id === item.id);
      if (existingItem) {
        // If item already in cart, just increment quantity
        setSelectedItems(prev => prev.map(i =>
          i.item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        ));
      } else {
        // Add item using search data (which includes purchase_rate)
        // Note: current_quantity should be the actual stock from the database
        // The quantity field is the purchase quantity (how many we're buying)
        setSelectedItems(prev => [...prev, {
          item_id: item.id,
          product_name: item.product_name,
          product_code: item.product_code || '',
          brand: item.brand || '',
          hsn_number: item.hsn_number || '',
          tax_rate: finalTaxRate, // Use the parsed and validated tax rate
          sale_rate: parseFloat(item.sale_rate) || 0,
          purchase_rate: parseFloat(item.purchase_rate) || 0,
          quantity: 1, // Purchase quantity (how many we're buying) - starts at 1
          alert_quantity: 0, // Will be set when submitting
          rack_number: '', // Will be set when submitting
          remarks: '', // Will be set when submitting
          current_quantity: parseInt(item.quantity) || 0 // Actual stock from database (for reference only)
        }]);
      }
      
      // Don't clear search or close modal - allow adding multiple items
      // Keep UX smooth: no toast spam on every item add
    } catch (error) {
      console.error('Error fetching item details:', error);
      toast.error('Error loading item details');
    }
  };

  const handleModalClose = () => {
    setShowItemSearchModal(false);
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

    if (!newItem.quantity || newItem.quantity <= 0) {
      toast.error('Quantity is required and must be greater than 0');
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
      
      // Fetch the created item to get all saved data, then add to cart with specified quantity
      const createdItemResponse = await apiClient.get(`${config.api.items}/${response.data.id}`);
      const createdItem = createdItemResponse.data.item;
      
      // Add item to cart
      // For existing items in cart, increment the editable quantity by 1
      const itemQuantity = parseInt(newItem.quantity) || 1; // This is the quantity entered when creating the item
      const existingItem = selectedItems.find(i => i.item_id === createdItem.id);
      if (existingItem) {
        // If item already in cart, increment the editable quantity by 1
        setSelectedItems(selectedItems.map(i =>
          i.item_id === createdItem.id ? { ...i, quantity: i.quantity + 1 } : i
        ));
      } else {
        // Parse tax_rate
        const taxRateValue = createdItem.tax_rate !== undefined && createdItem.tax_rate !== null
          ? parseFloat(createdItem.tax_rate)
          : 18;
        const validTaxRates = [5, 18, 28];
        const finalTaxRate = !isNaN(taxRateValue) && validTaxRates.includes(taxRateValue) 
          ? taxRateValue 
          : 18;
        
        // Add new item to cart
        // Note: current_quantity should be the quantity from API (or the entered quantity for new items)
        // The quantity field (editable in table) should default to 1
        const apiQuantity = parseInt(createdItem.quantity) || itemQuantity; // Use API quantity or entered quantity
        setSelectedItems([...selectedItems, {
          item_id: createdItem.id,
          product_name: createdItem.product_name,
          product_code: createdItem.product_code || '',
          brand: createdItem.brand || '',
          hsn_number: createdItem.hsn_number || '',
          tax_rate: finalTaxRate,
          sale_rate: parseFloat(createdItem.sale_rate) || 0,
          purchase_rate: parseFloat(createdItem.purchase_rate) || 0,
          quantity: 1, // Editable quantity in table - defaults to 1
          alert_quantity: parseInt(createdItem.alert_quantity) || 0,
          rack_number: createdItem.rack_number || '',
          remarks: createdItem.remarks || '',
          current_quantity: apiQuantity // Current stock from API (or entered quantity for new items)
        }]);
      }
      
      // Reset form
      setNewItem({
        product_name: '',
        product_code: '',
        brand: '',
        hsn_number: '',
        tax_rate: 18,
        sale_rate: 0,
        purchase_rate: 0,
        quantity: 1,
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
        items: selectedItems,
        payment_status: purchasePaymentStatus,
        paid_amount: purchasePaidNow // Already rounded to whole number
      });
      toast.success('Items added successfully!');
      setSelectedItems([]);
      setSelectedBuyer('');
      setBuyerInfo(null);
      setPurchasePaymentStatus('partially_paid');
      setPurchasePaidAmount(0);
      setShowItemSearchModal(false); // Close item search modal
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
      <TransactionLoader isLoading={isSubmitting} type="purchase" />
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
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      <span style={{ fontWeight: '600' }}>{party.party_name}</span>
                      {party.mobile_number && (
                        <span style={{ fontSize: '12px', color: '#6c757d', whiteSpace: 'nowrap' }}>
                          📱 {party.mobile_number}
                        </span>
                      )}
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
            {loadingBuyerParties ? (
              <p style={{ color: '#666', fontSize: '14px', marginTop: '5px' }}>
                Fetching buyer parties...
              </p>
            ) : buyerPartiesError ? (
              <p style={{ color: '#ff6b6b', fontSize: '14px', marginTop: '5px' }}>
                {buyerPartiesError}
              </p>
            ) : buyerParties.length === 0 ? (
              <p style={{ color: '#ff6b6b', fontSize: '14px', marginTop: '5px' }}>
                No buyer parties found. Please <Link to="/add-buyer-party">add a buyer party</Link> first.
              </p>
            ) : null}
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
                placeholder="🔍 Type product name, brand, or HSN to search and add items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                ref={itemSearchInputRef}
              />
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
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={newItem.quantity === 0 ? '' : newItem.quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewItem({ ...newItem, quantity: val === '' ? 0 : parseInt(val) || 0 });
                    }}
                    placeholder="1"
                    required
                  />
                  <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                    Number of items to add to inventory
                  </small>
                </div>
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
                    {newItem.purchase_rate > 0 && (
                      <div>
                        <strong>Purchase Rate:</strong> ₹{parseFloat(newItem.purchase_rate).toFixed(2)}
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
                    {newItem.quantity > 0 && (
                      <div>
                        <strong>Quantity:</strong> {newItem.quantity}
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
                    quantity: 1,
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
                    <th style={{ textAlign: 'left' }}>Product Name</th>
                    <th style={{ textAlign: 'left' }}>Product Code</th>
                    <th style={{ textAlign: 'left' }}>Brand</th>
                    <th style={{ textAlign: 'left' }}>HSN</th>
                    <th style={{ textAlign: 'right' }}>Purchase Rate</th>
                    <th style={{ textAlign: 'right' }}>Tax Rate</th>
                    <th style={{ textAlign: 'right' }}>Sale Rate</th>
                    <th style={{ textAlign: 'right' }}>Quantity</th>

                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((item, index) => (
                    <tr key={index}>
                      <td style={{ textAlign: 'left' }}>{item.product_name}</td>
                      <td style={{ textAlign: 'left' }}>
                        <span style={{ padding: '5px', display: 'inline-block' }}>{item.product_code || '-'}</span>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <span style={{ padding: '5px', display: 'inline-block' }}>{item.brand || '-'}</span>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <span style={{ padding: '5px', display: 'inline-block' }}>{item.hsn_number || '-'}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ padding: '5px', display: 'inline-block' }}>₹{parseFloat(item.purchase_rate || 0).toFixed(2)}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ padding: '5px', display: 'inline-block' }}>{item.tax_rate || 0}%</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ padding: '5px', display: 'inline-block' }}>₹{parseFloat(item.sale_rate || 0).toFixed(2)}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
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

                      <td style={{ textAlign: 'center', padding: '8px 4px', display: 'table-cell', verticalAlign: 'middle' }}>
                        <ActionMenu
                          itemId={item.item_id}
                          itemName={item.product_name}
                          actions={[
                            {
                              label: 'Remove',
                              icon: '🗑️',
                              danger: true,
                              onClick: (id) => removeItem(id)
                            }
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Action Buttons */}
              <div style={{ 
                marginTop: '25px', 
                display: 'flex', 
                gap: '15px', 
                alignItems: 'center',
                padding: '18px',
                background: '#f8f9fa',
                borderRadius: '10px',
                border: '1px solid #e1e8ed',
                flexWrap: 'wrap'
              }}>
                <button 
                  onClick={() => {
                    setShowItemSearchModal(true);
                  }} 
                  className="btn btn-secondary" 
                  style={{
                    padding: '12px 28px',
                    fontSize: '15px',
                    fontWeight: '600',
                    flex: '1 1 auto',
                    minWidth: '180px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(102, 126, 234, 0.3)';
                  }}
                >
                  ➕ Add More Item
                </button>
              </div>
              
              {/* Payment section (Buyer purchase) */}
              <div style={{
                marginTop: '16px',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                background: '#fafafa'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '13px', color: '#555' }}>Cart Amount</div>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>₹{purchaseTotal.toFixed(2)}</div>
                  </div>
                  {Math.abs(roundedPurchaseTotal - purchaseTotal) > 0.0001 && (
                    <div>
                      <div style={{ fontSize: '13px', color: '#555' }}>
                        Rounded Off ({roundedPurchaseTotal - purchaseTotal > 0 ? '+' : '-'})
                      </div>
                      <div style={{ 
                        fontSize: '18px', 
                        fontWeight: 700, 
                        color: (roundedPurchaseTotal - purchaseTotal) > 0 ? '#28a745' : '#dc3545' 
                      }}>
                        {roundedPurchaseTotal - purchaseTotal > 0 ? '+' : ''}₹{Math.abs(roundedPurchaseTotal - purchaseTotal).toFixed(2)}
                      </div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '13px', color: '#555' }}>Total Purchase</div>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>₹{roundedPurchaseTotal.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', color: '#555' }}>Paid Now</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f766e' }}>₹{purchasePaidNow.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', color: '#555' }}>Balance (Added to Buyer)</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#b45309' }}>₹{purchaseBalance.toFixed(2)}</div>
                  </div>
                </div>

                <div style={{ marginTop: '12px', display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="radio"
                      name="purchase_payment_status"
                      value="fully_paid"
                      checked={purchasePaymentStatus === 'fully_paid'}
                      onChange={() => {
                        setPurchasePaymentStatus('fully_paid');
                        setPurchasePaidAmount(roundedPurchaseTotal);
                      }}
                      disabled={isSubmitting || isAddingNewItem}
                    />
                    Full Payment
                  </label>
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="radio"
                      name="purchase_payment_status"
                      value="partially_paid"
                      checked={purchasePaymentStatus === 'partially_paid'}
                      onChange={() => setPurchasePaymentStatus('partially_paid')}
                      disabled={isSubmitting || isAddingNewItem}
                    />
                    Partial Payment
                  </label>

                  {purchasePaymentStatus === 'partially_paid' && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: '#555' }}>Paid Amount:</span>
                      <input
                        type="number"
                        min="0"
                        max={roundedPurchaseTotal}
                        value={purchasePaidAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setPurchasePaidAmount(0);
                            return;
                          }
                          // Only allow whole numbers (no decimals, no leading zeros)
                          // Prevent values like 0.5, 0.25, etc.
                          if (!/^\d+$/.test(val)) return;
                          // Prevent leading zero (like 01, 02, etc.) unless it's just "0"
                          if (val.length > 1 && val.startsWith('0')) return;
                          const num = parseInt(val) || 0;
                          setPurchasePaidAmount(Math.min(Math.max(0, num), roundedPurchaseTotal));
                        }}
                        onKeyDown={(e) => {
                          // Prevent decimal point, comma, and mathematical signs
                          if (['+', '-', '*', '/', 'e', 'E', '.', ','].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        disabled={isSubmitting || isAddingNewItem}
                        style={{ width: '140px', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '6px' }}
                      />
                    </div>
                  )}
                </div>
              </div>

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
      {/* Item Search Modal */}
      <ItemSearchModal
        isOpen={showItemSearchModal}
        onClose={handleModalClose}
        items={suggestedItems}
        onItemSelect={addItemToCart}
        onItemDeselect={removeItem}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        title="Search Items to Purchase"
        selectedItems={selectedItems}
        allowOutOfStock={true}
      />
    </Layout>
  );
};

export default AddItem;


