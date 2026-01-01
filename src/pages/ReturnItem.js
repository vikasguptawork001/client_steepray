import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { useToast } from '../context/ToastContext';
import './ReturnItem.css';

const ReturnItem = () => {
  const toast = useToast();
  const [partyType, setPartyType] = useState('seller'); // 'seller' or 'buyer'
  const [sellerParties, setSellerParties] = useState([]);
  const [buyerParties, setBuyerParties] = useState([]);
  const [selectedParty, setSelectedParty] = useState('');
  const [selectedPartyInfo, setSelectedPartyInfo] = useState(null);
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [showPartySuggestions, setShowPartySuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedItems, setSuggestedItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]); // Array of items to return
  const [returnData, setReturnData] = useState({
    reason: '',
    return_type: 'cash' // 'cash' or 'adjust'
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    fetchSellerParties();
    fetchBuyerParties();
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchItems();
    } else {
      setSuggestedItems([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (selectedParty && partyType) {
      fetchPartyInfo();
      setShowPartySuggestions(false);
    } else {
      setSelectedPartyInfo(null);
    }
  }, [selectedParty, partyType]);

  // Filter parties based on search query
  const filteredSellerParties = sellerParties.filter(party =>
    party.party_name.toLowerCase().includes(partySearchQuery.toLowerCase()) ||
    (party.mobile_number && party.mobile_number.includes(partySearchQuery)) ||
    (party.email && party.email.toLowerCase().includes(partySearchQuery.toLowerCase()))
  );

  const filteredBuyerParties = buyerParties.filter(party =>
    party.party_name.toLowerCase().includes(partySearchQuery.toLowerCase()) ||
    (party.mobile_number && party.mobile_number.includes(partySearchQuery)) ||
    (party.email && party.email.toLowerCase().includes(partySearchQuery.toLowerCase()))
  );

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.party-search-wrapper')) {
        setShowPartySuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchPartyInfo = async () => {
    try {
      const endpoint = partyType === 'seller' 
        ? `${config.api.sellers}/${selectedParty}`
        : `${config.api.buyers}/${selectedParty}`;
      const response = await apiClient.get(endpoint);
      setSelectedPartyInfo(response.data.party);
    } catch (error) {
      console.error('Error fetching party info:', error);
      setSelectedPartyInfo(null);
    }
  };

  const fetchSellerParties = async () => {
    try {
      const response = await apiClient.get(config.api.sellers);
      setSellerParties(response.data.parties);
    } catch (error) {
      console.error('Error fetching seller parties:', error);
    }
  };

  const fetchBuyerParties = async () => {
    try {
      const response = await apiClient.get(config.api.buyers);
      setBuyerParties(response.data.parties);
    } catch (error) {
      console.error('Error fetching buyer parties:', error);
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

  const addItemToCart = async (item) => {
    try {
      // Fetch full item details
      const response = await apiClient.get(`${config.api.items}/${item.id}`);
      const fullItemData = response.data.item;

      // Check if item already exists in cart
      const existingItem = selectedItems.find(i => i.item_id === item.id);
      if (existingItem) {
        // Increment quantity if item already in cart
        setSelectedItems(selectedItems.map(i =>
          i.item_id === item.id ? { ...i, quantity: (i.quantity || 1) + 1 } : i
        ));
      } else {
        // Add new item to cart
        setSelectedItems([...selectedItems, {
          item_id: fullItemData.id,
          product_name: fullItemData.product_name,
          product_code: fullItemData.product_code || '',
          brand: fullItemData.brand || '',
          sale_rate: parseFloat(fullItemData.sale_rate || 0),
          quantity: 1,
          available_quantity: fullItemData.quantity || 0
        }]);
      }
      setSearchQuery('');
      setSuggestedItems([]);
      setShowPreview(false);
      setPreviewData(null);
    } catch (error) {
      console.error('Error fetching item details:', error);
      toast.error('Error loading item details');
    }
  };

  const updateItemQuantity = (itemId, quantity) => {
    const qty = quantity === '' ? 0 : parseInt(quantity) || 0;
    // Allow quantity to be 0, don't remove the item
    setSelectedItems(selectedItems.map(item =>
      item.item_id === itemId ? { ...item, quantity: qty } : item
    ));
    setShowPreview(false);
    setPreviewData(null);
  };

  const removeItem = (itemId) => {
    setSelectedItems(selectedItems.filter(item => item.item_id !== itemId));
    setShowPreview(false);
    setPreviewData(null);
  };

  const calculateTotal = () => {
    return selectedItems.reduce((sum, item) => {
      const saleRate = parseFloat(item.sale_rate) || 0;
      const quantity = parseInt(item.quantity) || 0;
      return sum + (saleRate * quantity);
    }, 0);
  };

  const getValidItemsCount = () => {
    return selectedItems.filter(item => item.quantity > 0).length;
  };

  const handlePreview = () => {
    if (!selectedParty) {
      toast.error(`Please select a ${partyType} party`);
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Please add at least one item to return');
      return;
    }

    // Filter out items with quantity 0 or less
    const validItems = selectedItems.filter(item => item.quantity > 0);
    
    if (validItems.length === 0) {
      toast.error('Please add at least one item with quantity greater than 0');
      return;
    }

    // Validate stock availability for buyer returns
    for (const item of validItems) {
      // For buyer returns, check if stock is available
      if (partyType === 'buyer' && item.quantity > item.available_quantity) {
        toast.error(`Insufficient stock for ${item.product_name}. Available: ${item.available_quantity}, Requested: ${item.quantity}`);
        return;
      }
    }
    const totalAmount = validItems.reduce((sum, item) => {
      const saleRate = parseFloat(item.sale_rate) || 0;
      const quantity = parseInt(item.quantity) || 0;
      return sum + (saleRate * quantity);
    }, 0);
    
    const items = validItems.map(item => ({
      item_id: item.item_id,
      product_name: item.product_name,
      brand: item.brand,
      product_code: item.product_code,
      sale_rate: item.sale_rate,
      quantity: item.quantity,
      return_amount: parseFloat(item.sale_rate || 0) * parseInt(item.quantity || 0),
      available_quantity: item.available_quantity
    }));

    const preview = {
      partyType,
      partyName: selectedPartyInfo?.party_name || '',
      partyInfo: selectedPartyInfo,
      items: items,
      reason: returnData.reason,
      returnType: returnData.return_type,
      totalAmount: totalAmount
    };

    setPreviewData(preview);
    setShowPreview(true);
  };

  const handleBackToEdit = () => {
    setShowPreview(false);
    setPreviewData(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!showPreview || !previewData) {
      toast.error('Please preview the return before submitting');
      return;
    }

    try {
      const requestData = {
        items: previewData.items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          return_amount: item.return_amount
        })),
        reason: returnData.reason,
        return_type: returnData.return_type,
        party_type: partyType
      };

      if (partyType === 'seller') {
        requestData.seller_party_id = selectedParty;
      } else {
        requestData.buyer_party_id = selectedParty;
      }

      await apiClient.post(config.api.return, requestData);
      toast.success('Return processed successfully!');
      
      // Reset form
      setSelectedItems([]);
      setSelectedParty('');
      setSelectedPartyInfo(null);
      setPartySearchQuery('');
      setShowPartySuggestions(false);
      setReturnData({
        reason: '',
        return_type: 'cash'
      });
      setSearchQuery('');
      setShowPreview(false);
      setPreviewData(null);
    } catch (error) {
      toast.error('Error: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  return (
    <Layout>
      <div className="return-item">
        <h2>Return Items</h2>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Return Type *</label>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                <label>
                  <input
                    type="radio"
                    value="seller"
                    checked={partyType === 'seller'}
                    onChange={(e) => {
                      setPartyType(e.target.value);
                      setSelectedParty('');
                      setSelectedPartyInfo(null);
                      setSelectedItems([]);
                      setShowPreview(false);
                      setPreviewData(null);
                    }}
                  />
                  Return from Seller
                </label>
                <label>
                  <input
                    type="radio"
                    value="buyer"
                    checked={partyType === 'buyer'}
                    onChange={(e) => {
                      setPartyType(e.target.value);
                      setSelectedParty('');
                      setSelectedPartyInfo(null);
                      setSelectedItems([]);
                      setShowPreview(false);
                      setPreviewData(null);
                    }}
                  />
                  Return from Buyer
                </label>
              </div>
            </div>
            <div className="form-group">
              <label>Select {partyType === 'seller' ? 'Seller' : 'Buyer'} Party *</label>
              <div className="search-wrapper party-search-wrapper" style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder={`Search ${partyType === 'seller' ? 'seller' : 'buyer'} party by name, mobile, or email...`}
                  value={selectedParty ? (partyType === 'seller' 
                    ? sellerParties.find(p => p.id === parseInt(selectedParty))?.party_name || ''
                    : buyerParties.find(p => p.id === parseInt(selectedParty))?.party_name || ''
                  ) : partySearchQuery}
                  onChange={(e) => {
                    setPartySearchQuery(e.target.value);
                    setSelectedParty('');
                    setSelectedPartyInfo(null);
                    setShowPartySuggestions(true);
                    setShowPreview(false);
                    setPreviewData(null);
                  }}
                  onFocus={() => {
                    if (!selectedParty) {
                      setShowPartySuggestions(true);
                    }
                  }}
                  required
                  disabled={showPreview}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
                {showPartySuggestions && (partySearchQuery ? (partyType === 'seller' ? filteredSellerParties : filteredBuyerParties) : (partyType === 'seller' ? sellerParties : buyerParties)).length > 0 && (
                  <div className="suggestions" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                    {(partySearchQuery ? (partyType === 'seller' ? filteredSellerParties : filteredBuyerParties) : (partyType === 'seller' ? sellerParties : buyerParties)).map(party => (
                      <div
                        key={party.id}
                        className="suggestion-item"
                        onClick={() => {
                          setSelectedParty(party.id.toString());
                          setPartySearchQuery('');
                          setShowPartySuggestions(false);
                          setShowPreview(false);
                          setPreviewData(null);
                        }}
                      >
                        {party.party_name}
                        {party.mobile_number && ` - ${party.mobile_number}`}
                      </div>
                    ))}
                  </div>
                )}
                {partySearchQuery && (partyType === 'seller' ? filteredSellerParties : filteredBuyerParties).length === 0 && (partyType === 'seller' ? sellerParties : buyerParties).length > 0 && (
                  <div className="suggestions" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000 }}>
                    <div className="suggestion-item">No {partyType === 'seller' ? 'seller' : 'buyer'} party found</div>
                  </div>
                )}
              </div>
              {selectedPartyInfo && (
                <div style={{ 
                  marginTop: '10px', 
                  padding: '12px', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '6px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                    <div><strong>Name:</strong> {selectedPartyInfo.party_name}</div>
                    {selectedPartyInfo.mobile_number && (
                      <div><strong>Mobile:</strong> {selectedPartyInfo.mobile_number}</div>
                    )}
                    {selectedPartyInfo.email && (
                      <div><strong>Email:</strong> {selectedPartyInfo.email}</div>
                    )}
                    {selectedPartyInfo.address && (
                      <div><strong>Address:</strong> {selectedPartyInfo.address}</div>
                    )}
                    <div><strong>Balance:</strong> ₹{parseFloat(selectedPartyInfo.balance_amount || 0).toFixed(2)}</div>
                    {selectedPartyInfo.gst_number && (
                      <div><strong>GST:</strong> {selectedPartyInfo.gst_number}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Search Item</label>
              <div className="search-wrapper">
                <input
                  type="text"
                  placeholder="Type item name to search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={showPreview}
                />
                {suggestedItems.length > 0 && !showPreview && (
                  <div className="suggestions">
                    {suggestedItems.map(item => (
                      <div
                        key={item.id}
                        className="suggestion-item"
                        onClick={() => addItemToCart(item)}
                      >
                        {item.product_name} - {item.brand} (Available: {item.quantity})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedItems.length > 0 && !showPreview && (
              <div style={{ marginTop: '20px' }}>
                <h3>Items to Return</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ marginTop: '10px' }}>
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Product Name</th>
                        <th>Brand</th>
                        <th>Available Qty</th>
                        <th>Sale Rate</th>
                        <th>Return Qty</th>
                        <th>Return Amount</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item, index) => (
                        <tr key={item.item_id} style={{ 
                          opacity: item.quantity === 0 ? 0.6 : 1,
                          backgroundColor: item.quantity === 0 ? '#fff3cd' : undefined
                        }}>
                          <td>{index + 1}</td>
                          <td>{item.product_name}</td>
                          <td>{item.brand || '-'}</td>
                          <td>{item.available_quantity}</td>
                          <td>₹{parseFloat(item.sale_rate || 0).toFixed(2)}</td>
                          <td>
                            <input
                              type="number"
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={(e) => updateItemQuantity(item.item_id, e.target.value)}
                              min="0"
                              max={partyType === 'buyer' ? item.available_quantity : undefined}
                              style={{ 
                                width: '80px', 
                                padding: '5px',
                                borderColor: item.quantity === 0 ? '#ffc107' : undefined,
                                backgroundColor: item.quantity === 0 ? '#fff3cd' : undefined
                              }}
                            />
                          </td>
                          <td>
                            {item.quantity > 0 
                              ? `₹${(parseFloat(item.sale_rate || 0) * parseInt(item.quantity || 0)).toFixed(2)}`
                              : <span style={{ color: '#999' }}>₹0.00</span>
                            }
                          </td>
                          <td>
                            <button
                              type="button"
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
                    <tfoot>
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          Total Return Amount ({getValidItemsCount()} {getValidItemsCount() === 1 ? 'item' : 'items'}):
                        </td>
                        <td style={{ fontWeight: 'bold' }}>₹{calculateTotal().toFixed(2)}</td>
                        <td></td>
                      </tr>
                      {selectedItems.some(item => item.quantity === 0) && (
                        <tr>
                          <td colSpan="8" style={{ padding: '10px', fontSize: '12px', color: '#856404', backgroundColor: '#fff3cd', textAlign: 'center' }}>
                            <strong>Note:</strong> Items with quantity 0 will not be included in the return
                          </td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>

                {partyType === 'seller' && (
                  <div className="form-group" style={{ marginTop: '20px' }}>
                    <label>Return Type *</label>
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          value="cash"
                          checked={returnData.return_type === 'cash'}
                          onChange={(e) => setReturnData({ ...returnData, return_type: e.target.value })}
                        />
                        Return Cash
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          value="adjust"
                          checked={returnData.return_type === 'adjust'}
                          onChange={(e) => setReturnData({ ...returnData, return_type: e.target.value })}
                        />
                        Adjust in Account
                      </label>
                    </div>
                    <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                      {returnData.return_type === 'cash' 
                        ? 'Return amount will be paid in cash. Balance will not be updated.'
                        : 'Return amount will be adjusted in account. Balance will be updated accordingly.'}
                    </small>
                  </div>
                )}
                {partyType === 'buyer' && (
                  <div className="form-group" style={{ marginTop: '20px' }}>
                    <small style={{ color: '#666', fontSize: '12px', display: 'block', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                      <strong>Note:</strong> For buyer returns, only stock quantity will be decreased. No balance transactions will be recorded.
                    </small>
                  </div>
                )}
                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label>Reason</label>
                  <textarea
                    value={returnData.reason}
                    onChange={(e) => setReturnData({ ...returnData, reason: e.target.value })}
                    rows="3"
                    placeholder="Enter return reason (optional)"
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={handlePreview}
                  >
                    Preview Return
                  </button>
                </div>
              </div>
            )}

            {showPreview && previewData && (
              <div className="return-preview" style={{
                marginTop: '20px',
                padding: '20px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #dee2e6'
              }}>
                <h3 style={{ marginBottom: '20px', color: '#333' }}>Return Preview</h3>
                
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ marginBottom: '10px', color: '#555' }}>Party Information</h4>
                  <div style={{ 
                    padding: '15px', 
                    backgroundColor: 'white', 
                    borderRadius: '6px',
                    border: '1px solid #dee2e6'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                      <div><strong>Name:</strong> {previewData.partyName}</div>
                      <div><strong>Type:</strong> {previewData.partyType === 'seller' ? 'Seller Return' : 'Buyer Return'}</div>
                      {previewData.partyInfo?.mobile_number && (
                        <div><strong>Mobile:</strong> {previewData.partyInfo.mobile_number}</div>
                      )}
                      {previewData.partyInfo?.email && (
                        <div><strong>Email:</strong> {previewData.partyInfo.email}</div>
                      )}
                      <div><strong>Current Balance:</strong> ₹{parseFloat(previewData.partyInfo?.balance_amount || 0).toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ marginBottom: '10px', color: '#555' }}>Return Items</h4>
                  <div style={{ 
                    padding: '15px', 
                    backgroundColor: 'white', 
                    borderRadius: '6px',
                    border: '1px solid #dee2e6'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                          <th style={{ padding: '10px', textAlign: 'left' }}>S.No</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Product Name</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Brand</th>
                          <th style={{ padding: '10px', textAlign: 'right' }}>Quantity</th>
                          <th style={{ padding: '10px', textAlign: 'right' }}>Sale Rate</th>
                          <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.items.map((item, index) => (
                          <tr key={item.item_id}>
                            <td style={{ padding: '10px' }}>{index + 1}</td>
                            <td style={{ padding: '10px' }}>{item.product_name}</td>
                            <td style={{ padding: '10px' }}>{item.brand || '-'}</td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>{item.quantity}</td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>₹{parseFloat(item.sale_rate || 0).toFixed(2)}</td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>₹{parseFloat(item.return_amount || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: '#f8f9fa', borderTop: '2px solid #dee2e6', fontWeight: 'bold' }}>
                          <td colSpan="5" style={{ padding: '10px', textAlign: 'right' }}>Total Return Amount</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            ₹{parseFloat(previewData.totalAmount || 0).toFixed(2)}
                          </td>
                        </tr>
                        {previewData.reason && (
                          <tr>
                            <td colSpan="6" style={{ padding: '10px' }}>
                              <strong>Reason:</strong> {previewData.reason}
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td colSpan="6" style={{ padding: '10px', fontSize: '12px', color: '#666' }}>
                            {previewData.partyType === 'seller' ? (
                              <>
                                <div style={{ marginBottom: '8px' }}>
                                  <strong>Return Type:</strong> {previewData.returnType === 'cash' ? 'Return Cash' : 'Adjust in Account'}
                                </div>
                                {previewData.returnType === 'adjust' 
                                  ? 'Note: This amount will be deducted from seller balance and items will be added to stock.'
                                  : 'Note: Return amount will be paid in cash. Balance will not be updated. Items will be added to stock.'}
                              </>
                            ) : (
                              'Note: For buyer returns, only stock quantity will be decreased. No balance transactions will be recorded. Items will be removed from stock.'
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={handleBackToEdit}
                  >
                    Back to Edit
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                  >
                    Confirm Return
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ReturnItem;
