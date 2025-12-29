import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import './ReturnItem.css';

const ReturnItem = () => {
  const [sellerParties, setSellerParties] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedItems, setSuggestedItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [returnData, setReturnData] = useState({
    quantity: 1,
    return_amount: 0,
    reason: ''
  });

  useEffect(() => {
    fetchSellerParties();
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchItems();
    } else {
      setSuggestedItems([]);
    }
  }, [searchQuery]);

  const fetchSellerParties = async () => {
    try {
      const response = await apiClient.get(config.api.sellers);
      setSellerParties(response.data.parties);
    } catch (error) {
      console.error('Error fetching seller parties:', error);
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

  const selectItem = (item) => {
    setSelectedItem(item);
    setSearchQuery('');
    setSuggestedItems([]);
    setReturnData({
      quantity: 1,
      return_amount: 0,
      reason: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSeller) {
      alert('Please select a seller party');
      return;
    }
    if (!selectedItem) {
      alert('Please select an item');
      return;
    }
    if (returnData.quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }
    if (returnData.quantity > selectedItem.quantity) {
      alert('Return quantity cannot exceed available quantity');
      return;
    }

    try {
      await apiClient.post(config.api.return, {
        seller_party_id: selectedSeller,
        item_id: selectedItem.id,
        quantity: returnData.quantity,
        return_amount: returnData.return_amount,
        reason: returnData.reason
      });
      alert('Return processed successfully!');
      setSelectedItem(null);
      setSelectedSeller('');
      setReturnData({
        quantity: 1,
        return_amount: 0,
        reason: ''
      });
      setSearchQuery('');
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  return (
    <Layout>
      <div className="return-item">
        <h2>Return Item</h2>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Select Seller Party *</label>
              <select
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(e.target.value)}
                required
              >
                <option value="">-- Select Seller Party --</option>
                {sellerParties.map(party => (
                  <option key={party.id} value={party.id}>{party.party_name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Search Item *</label>
              <div className="search-wrapper">
                <input
                  type="text"
                  placeholder="Type item name to search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={!!selectedItem}
                />
                {selectedItem && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(null);
                      setSearchQuery('');
                    }}
                    className="btn btn-secondary"
                    style={{ marginTop: '10px' }}
                  >
                    Change Item
                  </button>
                )}
                {suggestedItems.length > 0 && !selectedItem && (
                  <div className="suggestions">
                    {suggestedItems.map(item => (
                      <div
                        key={item.id}
                        className="suggestion-item"
                        onClick={() => selectItem(item)}
                      >
                        {item.product_name} - {item.brand} (Available: {item.quantity})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedItem && (
              <div className="selected-item-info">
                <h3>Selected Item</h3>
                <p><strong>Product Name:</strong> {selectedItem.product_name}</p>
                <p><strong>Brand:</strong> {selectedItem.brand}</p>
                <p><strong>Available Quantity:</strong> {selectedItem.quantity}</p>
                <p><strong>Sale Rate:</strong> ₹{selectedItem.sale_rate}</p>
              </div>
            )}

            {selectedItem && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Return Quantity *</label>
                    <input
                      type="number"
                      value={returnData.quantity}
                      onChange={(e) => setReturnData({ ...returnData, quantity: parseInt(e.target.value) || 0 })}
                      min="1"
                      max={selectedItem.quantity}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Return Amount</label>
                    <input
                      type="number"
                      value={returnData.return_amount}
                      onChange={(e) => setReturnData({ ...returnData, return_amount: parseFloat(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Reason</label>
                  <textarea
                    value={returnData.reason}
                    onChange={(e) => setReturnData({ ...returnData, reason: e.target.value })}
                    rows="3"
                    placeholder="Enter return reason (optional)"
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  Process Return
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ReturnItem;


