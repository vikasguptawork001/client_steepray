import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { useAuth } from '../context/AuthContext';
import './SellItem.css';

const SellItem = () => {
  const { user } = useAuth();
  const [sellerParties, setSellerParties] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState('');
  const [sellerInfo, setSellerInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedItems, setSuggestedItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [itemStockInfo, setItemStockInfo] = useState({}); // Store stock info for each item
  const [previewData, setPreviewData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('fully_paid');
  const [paidAmount, setPaidAmount] = useState(0);

  useEffect(() => {
    fetchSellerParties();
  }, []);

  useEffect(() => {
    if (selectedSeller) {
      fetchSellerInfo();
    }
  }, [selectedSeller]);

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

  const fetchSellerInfo = async () => {
    try {
      const response = await apiClient.get(`${config.api.sellers}/${selectedSeller}`);
      setSellerInfo(response.data.party);
    } catch (error) {
      console.error('Error fetching seller info:', error);
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
    // Fetch current stock info for the item
    try {
      const response = await apiClient.get(`${config.api.items}/${item.id}`);
      const currentStock = response.data.item.quantity;
      
      // Store stock info
      setItemStockInfo(prev => ({
        ...prev,
        [item.id]: currentStock
      }));

      const existingItem = selectedItems.find(i => i.item_id === item.id);
      if (existingItem) {
        setSelectedItems(selectedItems.map(i =>
          i.item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        ));
      } else {
        setSelectedItems([...selectedItems, {
          item_id: item.id,
          product_name: item.product_name,
          sale_rate: item.sale_rate,
          quantity: 1,
          available_quantity: currentStock
        }]);
      }
      setSearchQuery('');
      setSuggestedItems([]);
    } catch (error) {
      console.error('Error fetching item details:', error);
      alert('Error fetching item details');
    }
  };

  const updateQuantity = (itemId, quantity) => {
    const qty = parseInt(quantity) || 0;
    if (qty <= 0) {
      removeItem(itemId);
    } else {
      setSelectedItems(selectedItems.map(item =>
        item.item_id === itemId ? { ...item, quantity: qty } : item
      ));
    }
  };

  const updateQuantityInPreview = (itemId, quantity) => {
    const qty = parseInt(quantity) || 0;
    if (qty <= 0) {
      removeFromPreview(itemId);
    } else {
      const updatedItems = previewData.items.map(item =>
        item.item_id === itemId ? { ...item, quantity: qty } : item
      );
      const total = updatedItems.reduce((sum, item) => sum + (item.sale_rate * item.quantity), 0);
      setPreviewData({
        ...previewData,
        items: updatedItems,
        total,
        paidAmount: paymentStatus === 'fully_paid' ? total : Math.min(previewData.paidAmount, total)
      });
      // Also update selectedItems to keep them in sync
      setSelectedItems(updatedItems);
    }
  };

  const removeItem = (itemId) => {
    setSelectedItems(selectedItems.filter(item => item.item_id !== itemId));
  };

  const calculateTotal = () => {
    return selectedItems.reduce((sum, item) => sum + (item.sale_rate * item.quantity), 0);
  };

  const handlePreview = async () => {
    if (!selectedSeller) {
      alert('Please select a seller party');
      return;
    }
    if (selectedItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    // Fetch latest stock info for all items before preview
    const itemsWithStock = await Promise.all(selectedItems.map(async (item) => {
      try {
        const response = await apiClient.get(`${config.api.items}/${item.item_id}`);
        return {
          ...item,
          available_quantity: response.data.item.quantity
        };
      } catch (error) {
        return {
          ...item,
          available_quantity: item.available_quantity || 0
        };
      }
    }));

    const total = itemsWithStock.reduce((sum, item) => sum + (item.sale_rate * item.quantity), 0);
    setPreviewData({
      seller: sellerInfo,
      items: itemsWithStock,
      total,
      paymentStatus,
      paidAmount: paymentStatus === 'fully_paid' ? total : paidAmount,
      selectedSeller: selectedSeller // Store for persistence
    });
    // Update selectedItems with stock info
    setSelectedItems(itemsWithStock);
  };

  const handleSubmit = async () => {
    if (!previewData) {
      handlePreview();
      return;
    }

    try {
      // Validate stock before submitting
      for (const item of previewData.items) {
        const availableQty = item.available_quantity || 0;
        if (item.quantity > availableQty) {
          alert(`Insufficient stock for ${item.product_name}. Available: ${availableQty}, Requested: ${item.quantity}`);
          return;
        }
      }

      const response = await apiClient.post(config.api.sale, {
        seller_party_id: previewData.selectedSeller || selectedSeller,
        items: previewData.items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          sale_rate: item.sale_rate
        })),
        payment_status: previewData.paymentStatus,
        paid_amount: previewData.paidAmount
      });

      // Store transaction ID and bill number for PDF download
      const transactionId = response.data.transaction?.id;
      const billNumber = response.data.transaction?.bill_number;
      if (transactionId) {
        setPreviewData({ ...previewData, transactionId, billNumber });
        alert('Sale completed successfully! You can now download the PDF.');
      } else {
        alert('Sale completed successfully!');
        setSelectedItems([]);
        setSelectedSeller('');
        setSellerInfo(null);
        setPreviewData(null);
        setPaymentStatus('fully_paid');
        setPaidAmount(0);
      }
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  const handlePrint = () => {
    // Create a print-friendly window with proper template
    const printContent = document.getElementById('bill-print-content');
    if (!printContent) {
      alert('Print content not found');
      return;
    }
    
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - Steepray Info Solutions</title>
          <style>
            @media print {
              @page {
                size: A4;
                margin: 20mm;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              color: #333;
            }
            .print-header {
              text-align: center;
              border-bottom: 3px solid #333;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .print-header h1 {
              margin: 0;
              font-size: 28px;
              color: #2c3e50;
              font-weight: bold;
            }
            .print-header h2 {
              margin: 10px 0 0 0;
              font-size: 22px;
              color: #34495e;
            }
            .print-header p {
              margin: 5px 0;
              font-size: 14px;
              color: #7f8c8d;
            }
            .bill-info {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
            }
            .bill-info-left, .bill-info-right {
              flex: 1;
            }
            .bill-info-right {
              text-align: right;
            }
            .party-info {
              margin-bottom: 30px;
              padding: 15px;
              background-color: #f8f9fa;
              border-radius: 5px;
            }
            .party-info h3 {
              margin: 0 0 10px 0;
              font-size: 16px;
              color: #2c3e50;
            }
            .party-info p {
              margin: 5px 0;
              font-size: 14px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            table th {
              background-color: #34495e;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: bold;
            }
            table td {
              padding: 10px;
              border-bottom: 1px solid #ddd;
            }
            table tbody tr:hover {
              background-color: #f5f5f5;
            }
            table tfoot {
              border-top: 2px solid #333;
            }
            table tfoot td {
              font-weight: bold;
              padding: 15px 10px;
            }
            .total-row {
              font-size: 16px;
            }
            .payment-info {
              margin-top: 30px;
              padding: 20px;
              background-color: #ecf0f1;
              border-radius: 5px;
            }
            .payment-info h3 {
              margin: 0 0 15px 0;
              font-size: 18px;
              color: #2c3e50;
            }
            .payment-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
            }
            .payment-row.total {
              font-size: 18px;
              font-weight: bold;
              border-top: 2px solid #2c3e50;
              padding-top: 15px;
              margin-top: 10px;
            }
            .footer {
              margin-top: 50px;
              text-align: center;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              color: #7f8c8d;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleDownloadPDF = async () => {
    if (!previewData || !previewData.transactionId) {
      alert('Please complete the sale first to download PDF');
      return;
    }
    try {
      const response = await apiClient.get(config.api.billPdf(previewData.transactionId), {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bill_${previewData.transactionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error downloading PDF: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  const removeFromPreview = (itemId) => {
    const updatedItems = previewData.items.filter(item => item.item_id !== itemId);
    const total = updatedItems.reduce((sum, item) => sum + (item.sale_rate * item.quantity), 0);
    setPreviewData({
      ...previewData,
      items: updatedItems,
      total,
      paidAmount: paymentStatus === 'fully_paid' ? total : Math.min(previewData.paidAmount, total)
    });
    setSelectedItems(updatedItems);
  };

  const handleBackToEdit = () => {
    // Restore all state from previewData to make it persistent
    if (previewData) {
      setSelectedItems(previewData.items);
      setSelectedSeller(previewData.selectedSeller || selectedSeller);
      setPaymentStatus(previewData.paymentStatus);
      setPaidAmount(previewData.paidAmount);
      // Keep sellerInfo if it exists
      if (previewData.seller) {
        setSellerInfo(previewData.seller);
      }
    }
    setPreviewData(null);
  };

  if (previewData) {
    return (
      <Layout>
        <div className="sell-item">
          <div className="preview-header">
            <h2>Bill Preview</h2>
            <div className="preview-actions">
              <button 
                onClick={() => {
                  if (previewData.transactionId) {
                    // New sale - reset everything
                    setPreviewData(null);
                    setSelectedItems([]);
                    setSelectedSeller('');
                    setSellerInfo(null);
                    setPaymentStatus('fully_paid');
                    setPaidAmount(0);
                  } else {
                    // Back to edit - keep all data
                    handleBackToEdit();
                  }
                }} 
                className="btn btn-secondary"
              >
                {previewData.transactionId ? 'New Sale' : 'Back to Edit'}
              </button>
              <button onClick={handlePrint} className="btn btn-primary">
                Print
              </button>
              <button onClick={handleDownloadPDF} className="btn btn-success">
                Download PDF
              </button>
              <button onClick={handleSubmit} className="btn btn-primary">
                Confirm Sale
              </button>
            </div>
          </div>

          <div className="bill-preview" id="bill-print-content">
            <div className="bill-header">
              <h1>STEEPRAY INFO SOLUTIONS</h1>
              <h3>INVOICE</h3>
              <div className="bill-info">
                <div className="bill-info-left">
                  <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                  {previewData.billNumber && <p><strong>Bill No:</strong> {previewData.billNumber}</p>}
                </div>
              </div>
            </div>

            <div className="bill-party-info">
              <h4>Bill To:</h4>
              <p><strong>Name:</strong> {previewData.seller.party_name}</p>
              {previewData.seller.mobile_number && <p><strong>Mobile:</strong> {previewData.seller.mobile_number}</p>}
              {previewData.seller.address && <p><strong>Address:</strong> {previewData.seller.address}</p>}
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Product Name</th>
                  <th>Quantity</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {previewData.items.map((item, index) => {
                  const availableQty = item.available_quantity || 0;
                  const isOverStock = item.quantity > availableQty;
                  return (
                    <tr key={item.item_id} style={isOverStock ? { backgroundColor: '#ffebee' } : {}}>
                      <td>{index + 1}</td>
                      <td>{item.product_name}</td>
                      <td>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQuantityInPreview(item.item_id, e.target.value)}
                          style={{
                            width: '80px',
                            border: isOverStock ? '2px solid #f44336' : '1px solid #ddd',
                            backgroundColor: isOverStock ? '#ffcdd2' : 'white'
                          }}
                          min="1"
                        />
                        {isOverStock && (
                          <div style={{ color: '#f44336', fontSize: '12px', marginTop: '5px', fontWeight: 'bold' }}>
                            ⚠️ Available: {availableQty}
                          </div>
                        )}
                        {!isOverStock && availableQty > 0 && (
                          <div style={{ color: '#666', fontSize: '11px', marginTop: '5px' }}>
                            Available: {availableQty}
                          </div>
                        )}
                      </td>
                      <td>₹{item.sale_rate}</td>
                      <td>₹{(item.sale_rate * item.quantity).toFixed(2)}</td>
                      <td>
                        <button
                          onClick={() => removeFromPreview(item.item_id)}
                          className="btn btn-danger"
                          style={{ padding: '5px 10px' }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan="4" style={{ textAlign: 'right', fontWeight: 'bold' }}>Total Amount:</td>
                  <td style={{ fontWeight: 'bold' }}>₹{previewData.total.toFixed(2)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan="4" style={{ textAlign: 'right' }}>Paid Amount:</td>
                  <td>₹{previewData.paidAmount.toFixed(2)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan="4" style={{ textAlign: 'right', fontWeight: 'bold' }}>Balance Amount:</td>
                  <td style={{ fontWeight: 'bold' }}>₹{(previewData.total - previewData.paidAmount).toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            {!previewData.transactionId && (
              <div className="payment-section">
                <h4>Payment Details</h4>
                <div className="form-group">
                  <label>
                    <input
                      type="radio"
                      value="fully_paid"
                      checked={paymentStatus === 'fully_paid'}
                      onChange={(e) => {
                        setPaymentStatus(e.target.value);
                        setPreviewData({ ...previewData, paymentStatus: e.target.value, paidAmount: previewData.total });
                      }}
                    />
                    Fully Paid
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="partially_paid"
                      checked={paymentStatus === 'partially_paid'}
                      onChange={(e) => {
                        setPaymentStatus(e.target.value);
                        setPreviewData({ ...previewData, paymentStatus: e.target.value });
                      }}
                    />
                    Partially Paid
                  </label>
                </div>
                {paymentStatus === 'partially_paid' && (
                  <div className="form-group">
                    <label>Paid Amount</label>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => {
                        const amount = parseFloat(e.target.value) || 0;
                        setPaidAmount(amount);
                        setPreviewData({ ...previewData, paidAmount: amount });
                      }}
                      max={previewData.total}
                    />
                  </div>
                )}
              </div>
            )}
            {previewData.transactionId && (
              <div className="payment-section">
                <h4>Payment Summary</h4>
                <div className="payment-summary">
                  <p><strong>Payment Status:</strong> {previewData.paymentStatus === 'fully_paid' ? 'Fully Paid' : 'Partially Paid'}</p>
                  <p><strong>Total Amount:</strong> ₹{previewData.total.toFixed(2)}</p>
                  <p><strong>Paid Amount:</strong> ₹{previewData.paidAmount.toFixed(2)}</p>
                  <p><strong>Balance Amount:</strong> ₹{(previewData.total - previewData.paidAmount).toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="sell-item">
        <h2>Sell Item</h2>

        <div className="card">
          <div className="form-group">
            <label>Select Seller Party</label>
            <select
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
            >
              <option value="">-- Select Seller Party --</option>
              {sellerParties.map(party => (
                <option key={party.id} value={party.id}>{party.party_name}</option>
              ))}
            </select>
          </div>

          {sellerInfo && (
            <div className="seller-info">
              <h3>Seller Information</h3>
              <p><strong>Name:</strong> {sellerInfo.party_name}</p>
              <p><strong>Mobile:</strong> {sellerInfo.mobile_number}</p>
              <p><strong>Address:</strong> {sellerInfo.address}</p>
              <p><strong>Balance Amount:</strong> ₹{sellerInfo.balance_amount}</p>
              <p><strong>Paid Amount:</strong> ₹{sellerInfo.paid_amount}</p>
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
                      {item.product_name} - {item.brand} (Available: {item.quantity})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedItems.length > 0 && (
            <div className="selected-items">
              <h3>Selected Items</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Sale Rate</th>
                    <th>Quantity</th>
                    <th>Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((item) => {
                    const availableQty = item.available_quantity || itemStockInfo[item.item_id] || 0;
                    const isOverStock = item.quantity > availableQty;
                    return (
                      <tr key={item.item_id} style={isOverStock ? { backgroundColor: '#ffebee' } : {}}>
                        <td>{item.product_name}</td>
                        <td>₹{item.sale_rate}</td>
                        <td>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.item_id, e.target.value)}
                            style={{
                              width: '80px',
                              border: isOverStock ? '2px solid #f44336' : '1px solid #ddd',
                              backgroundColor: isOverStock ? '#ffcdd2' : 'white'
                            }}
                            min="1"
                          />
                          {isOverStock && (
                            <div style={{ color: '#f44336', fontSize: '12px', marginTop: '5px', fontWeight: 'bold' }}>
                              ⚠️ Available: {availableQty}
                            </div>
                          )}
                          {!isOverStock && availableQty > 0 && (
                            <div style={{ color: '#666', fontSize: '11px', marginTop: '5px' }}>
                              Available: {availableQty}
                            </div>
                          )}
                        </td>
                        <td>₹{(item.sale_rate * item.quantity).toFixed(2)}</td>
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
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold' }}>Total:</td>
                    <td style={{ fontWeight: 'bold' }}>₹{calculateTotal().toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <button onClick={handlePreview} className="btn btn-primary" style={{ marginTop: '20px' }}>
                Preview Bill
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SellItem;

