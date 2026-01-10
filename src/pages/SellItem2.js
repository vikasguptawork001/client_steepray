import React, { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getLocalDateString } from '../utils/dateUtils';
import {
  searchItems,
  searchSellers,
  setItemSearchQuery,
  setSellerSearchQuery,
  selectSeller,
  addToCart,
  updateCartItemQuantity,
  updateCartItemRate,
  removeFromCart,
  clearCart,
  setPaymentStatus,
  setPaidAmount,
  toggleBillPreview,
  submitSale,
  generateBillPDF,
  resetForm,
  clearMessages
} from '../store/slices/sellItem2Slice';
import './SellItem2.css';

// Utility function to convert number to words
const numberToWords = (num) => {
  if (num === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  const convertHundreds = (n) => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertHundreds(n % 100) : '');
  };
  
  if (num < 0) return 'Negative ' + numberToWords(-num);
  if (num < 1000) return convertHundreds(num);
  if (num < 100000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    return convertHundreds(thousands) + ' Thousand' + (remainder ? ' ' + convertHundreds(remainder) : '');
  }
  if (num < 10000000) {
    const lakhs = Math.floor(num / 100000);
    const remainder = num % 100000;
    return convertHundreds(lakhs) + ' Lakh' + (remainder ? ' ' + numberToWords(remainder) : '');
  }
  
  const crores = Math.floor(num / 10000000);
  const remainder = num % 10000000;
  return convertHundreds(crores) + ' Crore' + (remainder ? ' ' + numberToWords(remainder) : '');
};

const SellItem2 = () => {
  const dispatch = useDispatch();
  const {
    itemSearchQuery,
    suggestedItems,
    itemSearchLoading,
    sellerSearchQuery,
    suggestedSellers,
    sellerSearchLoading,
    selectedSeller,
    cartItems,
    paymentStatus,
    paidAmount,
    showBillPreview,
    loading,
    error,
    successMessage
  } = useSelector((state) => state.sellItem2);
  
  const itemSearchTimeoutRef = useRef(null);
  const sellerSearchTimeoutRef = useRef(null);
  
  // Debounced item search
  const handleItemSearch = useCallback((query) => {
    dispatch(setItemSearchQuery(query));
    
    if (itemSearchTimeoutRef.current) {
      clearTimeout(itemSearchTimeoutRef.current);
    }
    
    if (query.trim().length >= 2) {
      itemSearchTimeoutRef.current = setTimeout(() => {
        dispatch(searchItems(query));
      }, 300);
    }
  }, [dispatch]);
  
  // Debounced seller search
  const handleSellerSearch = useCallback((query) => {
    dispatch(setSellerSearchQuery(query));
    
    if (sellerSearchTimeoutRef.current) {
      clearTimeout(sellerSearchTimeoutRef.current);
    }
    
    if (query.trim().length >= 2) {
      sellerSearchTimeoutRef.current = setTimeout(() => {
        dispatch(searchSellers(query));
      }, 300);
    }
  }, [dispatch]);
  
  // Calculate totals
  const calculations = React.useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    
    const itemDetails = cartItems.map(item => {
      const itemSubtotal = item.quantity * item.sale_rate;
      const itemTax = (itemSubtotal * item.tax_rate) / 100;
      const itemTotal = itemSubtotal + itemTax;
      
      subtotal += itemSubtotal;
      totalTax += itemTax;
      
      return {
        ...item,
        itemSubtotal,
        itemTax,
        itemTotal
      };
    });
    
    const grandTotal = subtotal + totalTax;
    const balanceAmount = grandTotal - paidAmount;
    
    return {
      itemDetails,
      subtotal,
      totalTax,
      grandTotal,
      paidAmount,
      balanceAmount
    };
  }, [cartItems, paidAmount]);
  
  // Auto-update paid amount when payment status changes
  useEffect(() => {
    if (paymentStatus === 'fully_paid') {
      dispatch(setPaidAmount(calculations.grandTotal));
    } else if (paymentStatus === 'partially_paid' && paidAmount === 0) {
      dispatch(setPaidAmount(0));
    }
  }, [paymentStatus, calculations.grandTotal, dispatch, paidAmount]);
  
  // Handle add item to cart
  const handleAddItem = (item) => {
    dispatch(addToCart(item));
    dispatch(setItemSearchQuery(''));
  };
  
  // Handle seller selection
  const handleSelectSeller = (seller) => {
    dispatch(selectSeller(seller));
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!selectedSeller) {
      alert('Please select a seller');
      return;
    }
    
    if (cartItems.length === 0) {
      alert('Please add items to cart');
      return;
    }
    
    if (paymentStatus === 'partially_paid' && paidAmount <= 0) {
      alert('Please enter paid amount for partial payment');
      return;
    }
    
    const saleData = {
      party_id: selectedSeller.party_id,
      party_type: 'seller',
      items: cartItems.map(item => ({
        item_id: item.item_id,
        quantity: item.quantity,
        rate: item.sale_rate,
        tax_rate: item.tax_rate
      })),
      payment_status: paymentStatus,
      paid_amount: paidAmount,
      transaction_date: getLocalDateString()
    };
    
    try {
      await dispatch(submitSale(saleData)).unwrap();
      
      // Generate PDF
      const billData = {
        seller: selectedSeller,
        items: calculations.itemDetails,
        subtotal: calculations.subtotal,
        totalTax: calculations.totalTax,
        grandTotal: calculations.grandTotal,
        paidAmount: calculations.paidAmount,
        balanceAmount: calculations.balanceAmount,
        paymentStatus,
        date: new Date().toLocaleDateString('en-IN'),
        invoiceNumber: `INV-${Date.now()}`
      };
      
      const pdfBlob = await dispatch(generateBillPDF(billData)).unwrap();
      
      // Download PDF
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bill_${billData.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error submitting sale:', err);
    }
  };
  
  // Clear messages after 3 seconds
  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        dispatch(clearMessages());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage, dispatch]);
  
  return (
    <div className="sell-item2-container">
      {/* Header */}
      <div className="sell-item2-header">
        <h1>📝 Create Sale Invoice</h1>
        <div className="header-actions">
          <button 
            className="btn-secondary"
            onClick={() => dispatch(toggleBillPreview())}
          >
            {showBillPreview ? '📋 Hide Preview' : '📋 Show Preview'}
          </button>
          <button 
            className="btn-danger"
            onClick={() => dispatch(resetForm())}
            disabled={loading}
          >
            🔄 Reset
          </button>
        </div>
      </div>
      
      {/* Messages */}
      {error && <div className="message message-error">{error}</div>}
      {successMessage && <div className="message message-success">{successMessage}</div>}
      
      {/* Main Content */}
      <div className="sell-item2-main">
        {/* Left Panel: Input & Cart */}
        <div className="sell-item2-left">
          {/* Seller Selection */}
          <div className="form-section">
            <h2>👤 Select Seller</h2>
            <div className="search-input-wrapper">
              <input
                type="text"
                className="search-input"
                placeholder="Search seller by name, mobile, email..."
                value={sellerSearchQuery}
                onChange={(e) => handleSellerSearch(e.target.value)}
              />
              {sellerSearchLoading && <span className="loading-spinner">⏳</span>}
            </div>
            
            {selectedSeller && (
              <div className="selected-party-card">
                <div className="party-info">
                  <h3>{selectedSeller.party_name}</h3>
                  <p>📞 {selectedSeller.mobile_number || 'N/A'}</p>
                  <p>📧 {selectedSeller.email || 'N/A'}</p>
                  {selectedSeller.gst_number && <p>🏢 GST: {selectedSeller.gst_number}</p>}
                </div>
                <button
                  className="btn-text"
                  onClick={() => dispatch(selectSeller(null))}
                >
                  Change
                </button>
              </div>
            )}
            
            {suggestedSellers.length > 0 && !selectedSeller && (
              <div className="suggestions-list">
                {suggestedSellers.map((seller) => (
                  <div
                    key={seller.party_id}
                    className="suggestion-item"
                    onClick={() => handleSelectSeller(seller)}
                  >
                    <div>
                      <strong>{seller.party_name}</strong>
                      <br />
                      <small>{seller.mobile_number}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Item Search */}
          <div className="form-section">
            <h2>🔍 Add Items</h2>
            <div className="search-input-wrapper">
              <input
                type="text"
                className="search-input"
                placeholder="Search items by name, barcode..."
                value={itemSearchQuery}
                onChange={(e) => handleItemSearch(e.target.value)}
              />
              {itemSearchLoading && <span className="loading-spinner">⏳</span>}
            </div>
            
            {suggestedItems.length > 0 && (
              <div className="suggestions-list">
                {suggestedItems.map((item) => (
                  <div
                    key={item.item_id}
                    className="suggestion-item"
                    onClick={() => handleAddItem(item)}
                  >
                    <div>
                      <strong>{item.item_name}</strong>
                      <br />
                      <small>Stock: {item.current_quantity} | Rate: ₹{item.sale_rate}</small>
                    </div>
                    <button className="btn-add">+</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Cart */}
          <div className="form-section cart-section">
            <div className="cart-header">
              <h2>🛒 Cart ({cartItems.length})</h2>
              {cartItems.length > 0 && (
                <button
                  className="btn-text btn-text-danger"
                  onClick={() => dispatch(clearCart())}
                >
                  Clear All
                </button>
              )}
            </div>
            
            {cartItems.length === 0 ? (
              <div className="empty-cart">
                <p>🛍️ Cart is empty</p>
                <small>Search and add items to get started</small>
              </div>
            ) : (
              <div className="cart-items">
                {cartItems.map((item) => (
                  <div key={item.item_id} className="cart-item">
                    <div className="cart-item-header">
                      <strong>{item.item_name}</strong>
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={() => dispatch(removeFromCart(item.item_id))}
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <div className="cart-item-details">
                      <div className="input-group">
                        <label>Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => dispatch(updateCartItemQuantity({
                            item_id: item.item_id,
                            quantity: parseInt(e.target.value) || 1
                          }))}
                        />
                      </div>
                      
                      <div className="input-group">
                        <label>Rate (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.sale_rate}
                          onChange={(e) => dispatch(updateCartItemRate({
                            item_id: item.item_id,
                            rate: parseFloat(e.target.value) || 0
                          }))}
                        />
                      </div>
                      
                      <div className="input-group">
                        <label>Tax Rate (%)</label>
                        <input
                          type="text"
                          value={item.tax_rate}
                          disabled
                        />
                      </div>
                    </div>
                    
                    <div className="cart-item-total">
                      <span>Total: </span>
                      <strong>₹{(item.quantity * item.sale_rate * (1 + item.tax_rate / 100)).toFixed(2)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Payment Section */}
          {cartItems.length > 0 && (
            <div className="form-section payment-section">
              <h2>💰 Payment Details</h2>
              
              <div className="payment-options">
                <label className="radio-label">
                  <input
                    type="radio"
                    value="fully_paid"
                    checked={paymentStatus === 'fully_paid'}
                    onChange={(e) => dispatch(setPaymentStatus(e.target.value))}
                  />
                  <span>Fully Paid</span>
                </label>
                
                <label className="radio-label">
                  <input
                    type="radio"
                    value="partially_paid"
                    checked={paymentStatus === 'partially_paid'}
                    onChange={(e) => dispatch(setPaymentStatus(e.target.value))}
                  />
                  <span>Partially Paid</span>
                </label>
              </div>
              
              {paymentStatus === 'partially_paid' && (
                <div className="input-group">
                  <label>Amount Paid (₹)</label>
                  <input
                    type="number"
                    min="0"
                    max={calculations.grandTotal}
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => dispatch(setPaidAmount(parseFloat(e.target.value) || 0))}
                  />
                </div>
              )}
              
              <div className="payment-summary">
                <div className="summary-row">
                  <span>Grand Total:</span>
                  <strong>₹{calculations.grandTotal.toFixed(2)}</strong>
                </div>
                <div className="summary-row">
                  <span>Paid Amount:</span>
                  <strong className="text-success">₹{calculations.paidAmount.toFixed(2)}</strong>
                </div>
                {calculations.balanceAmount > 0 && (
                  <div className="summary-row">
                    <span>Balance:</span>
                    <strong className="text-danger">₹{calculations.balanceAmount.toFixed(2)}</strong>
                  </div>
                )}
              </div>
              
              <button
                className="btn-primary btn-large"
                onClick={handleSubmit}
                disabled={loading || !selectedSeller || cartItems.length === 0}
              >
                {loading ? '⏳ Processing...' : '✅ Complete Sale & Generate Bill'}
              </button>
            </div>
          )}
        </div>
        
        {/* Right Panel: Bill Preview */}
        {showBillPreview && (
          <div className="sell-item2-right">
            <div className="bill-preview">
              <div className="bill-preview-header">
                <h2>📄 Bill Preview</h2>
              </div>
              
              <div className="bill-content">
                {/* Company Header */}
                <div className="bill-section bill-header-section">
                  <h1 className="company-name">YOUR COMPANY NAME</h1>
                  <p className="company-details">
                    Address Line 1, Address Line 2<br />
                    City, State - PIN CODE<br />
                    Phone: +91 XXXXXXXXXX | Email: info@company.com<br />
                    GSTIN: XXXXXXXXXXXX
                  </p>
                </div>
                
                <div className="bill-divider"></div>
                
                {/* Invoice Info */}
                <div className="bill-section bill-info-section">
                  <div>
                    <strong>Invoice No:</strong> INV-{Date.now()}
                  </div>
                  <div>
                    <strong>Date:</strong> {new Date().toLocaleDateString('en-IN')}
                  </div>
                </div>
                
                {/* Seller Info */}
                {selectedSeller && (
                  <>
                    <div className="bill-section bill-party-section">
                      <h3>Bill To:</h3>
                      <p>
                        <strong>{selectedSeller.party_name}</strong><br />
                        {selectedSeller.address && `${selectedSeller.address}`}<br />
                        Mobile: {selectedSeller.mobile_number || 'N/A'}<br />
                        {selectedSeller.email && `Email: ${selectedSeller.email}`}<br />
                        {selectedSeller.gst_number && `GSTIN: ${selectedSeller.gst_number}`}
                      </p>
                    </div>
                    
                    <div className="bill-divider"></div>
                  </>
                )}
                
                {/* Items Table */}
                {cartItems.length > 0 ? (
                  <>
                    <div className="bill-section">
                      <table className="bill-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Item Description</th>
                            <th>HSN</th>
                            <th>Qty</th>
                            <th>Rate</th>
                            <th>Tax%</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calculations.itemDetails.map((item, index) => (
                            <tr key={item.item_id}>
                              <td>{index + 1}</td>
                              <td>
                                <strong>{item.item_name}</strong>
                                {item.brand_name && <br />}
                                {item.brand_name && <small>{item.brand_name}</small>}
                              </td>
                              <td>{item.hsn_number || '-'}</td>
                              <td>{item.quantity}</td>
                              <td>₹{item.sale_rate.toFixed(2)}</td>
                              <td>{item.tax_rate}%</td>
                              <td>₹{item.itemTotal.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="bill-divider"></div>
                    
                    {/* Totals */}
                    <div className="bill-section bill-totals-section">
                      <div className="totals-row">
                        <span>Subtotal:</span>
                        <span>₹{calculations.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="totals-row">
                        <span>Total Tax:</span>
                        <span>₹{calculations.totalTax.toFixed(2)}</span>
                      </div>
                      <div className="totals-row grand-total-row">
                        <span>Grand Total:</span>
                        <span>₹{calculations.grandTotal.toFixed(2)}</span>
                      </div>
                      
                      {calculations.paidAmount > 0 && (
                        <div className="totals-row paid-row">
                          <span>Paid Amount:</span>
                          <span>₹{calculations.paidAmount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {calculations.balanceAmount > 0 && (
                        <div className="totals-row balance-row">
                          <span>Balance Due:</span>
                          <span>₹{calculations.balanceAmount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      <div className="amount-in-words">
                        <strong>Amount in Words:</strong><br />
                        {numberToWords(Math.floor(calculations.grandTotal))} Rupees Only
                      </div>
                    </div>
                    
                    <div className="bill-divider"></div>
                    
                    {/* Footer */}
                    <div className="bill-section bill-footer-section">
                      <div className="terms">
                        <strong>Terms & Conditions:</strong>
                        <ul>
                          <li>Goods once sold cannot be returned</li>
                          <li>Payment should be made within 7 days</li>
                          <li>Subject to local jurisdiction</li>
                        </ul>
                      </div>
                      
                      <div className="signature">
                        <p>For YOUR COMPANY NAME</p>
                        <br />
                        <br />
                        <p>Authorized Signatory</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bill-empty">
                    <p>Add items to see bill preview</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellItem2;

