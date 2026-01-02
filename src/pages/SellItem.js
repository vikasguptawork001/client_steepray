import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  fetchSellerParties,
  fetchSellerInfo,
  searchItems,
  calculatePreview,
  submitSale,
  setSelectedSeller,
  setSellerSearchQuery,
  setShowSellerSuggestions,
  selectSellerParty,
  setSearchQuery,
  clearSuggestedItems,
  addItemToCart,
  updateItemQuantity,
  removeItem,
  setPaymentStatus,
  setPaidAmount,
  setWithGst,
  setPreviousBalancePaid,
  setPayPreviousBalance,
  setPrintDisabled,
  setPrintClicked,
  resetAfterSale,
  clearPreview,
  updatePreviewItemQuantity,
  removePreviewItem,
  updatePreviewItemDiscount,
  resetSellItem
} from '../store/slices/sellItemSlice';
import './SellItem.css';

const SellItem = () => {
  const toast = useToast();
  const dispatch = useDispatch();
  
  // Redux state
  const {
    sellerParties,
    selectedSeller,
    sellerInfo,
    sellerSearchQuery,
    filteredSellerParties,
    showSellerSuggestions,
    searchQuery,
    suggestedItems,
    selectedItems,
    previewData,
    previewLoading,
    paymentStatus,
    paidAmount,
    withGst,
    previousBalancePaid,
    payPreviousBalance,
    printDisabled,
    printClicked,
    loading,
    errors
  } = useSelector((state) => state.sellItem);

  useEffect(() => {
    dispatch(fetchSellerParties()).catch((error) => {
      console.error('Error fetching seller parties:', error);
      toast.error('Failed to load seller parties');
    });
  }, [dispatch, toast]);

  useEffect(() => {
    if (selectedSeller) {
      dispatch(fetchSellerInfo(selectedSeller)).catch((error) => {
        console.error('Error fetching seller info:', error);
        toast.error('Failed to load seller information');
      });
    }
  }, [selectedSeller, dispatch, toast]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      dispatch(searchItems(searchQuery));
    } else {
      dispatch(clearSuggestedItems());
    }
  }, [searchQuery, dispatch]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSellerSuggestions && !event.target.closest('.search-wrapper')) {
        dispatch(setShowSellerSuggestions(false));
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        if (showSellerSuggestions) {
          dispatch(setShowSellerSuggestions(false));
        }
        if (suggestedItems.length > 0) {
          dispatch(clearSuggestedItems());
          dispatch(setSearchQuery(''));
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showSellerSuggestions, suggestedItems.length, dispatch]);

  const handleAddItemToCart = async (item) => {
    try {
      const response = await apiClient.get(`${config.api.items}/${item.id}`);
      const itemData = response.data.item;
      dispatch(addItemToCart({ ...item, ...itemData }));
      dispatch(setSearchQuery(''));
      dispatch(clearSuggestedItems());
    } catch (error) {
      console.error('Error fetching item details:', error);
      toast.error('Error fetching item details');
    }
  };

  const handleUpdateQuantity = (itemId, quantity) => {
    if (quantity === '' || quantity === null || quantity === undefined) {
      dispatch(updateItemQuantity({ itemId, quantity: '' }));
      return;
    }
    const qty = parseInt(quantity) || 0;
    dispatch(updateItemQuantity({ itemId, quantity: qty <= 0 ? '' : qty }));
  };

  const updateQuantityInPreview = (itemId, quantity) => {
    dispatch(updatePreviewItemQuantity({ itemId, quantity }));
  };

  const handleRemoveItem = (itemId) => {
    dispatch(removeItem(itemId));
  };

  const calculateTotal = () => {
    return selectedItems.reduce((sum, item) => {
      const saleRate = parseFloat(item.sale_rate) || 0;
      const quantity = parseInt(item.quantity) || 0;
      return sum + (saleRate * quantity);
    }, 0);
  };

  /**
   * Recalculate preview bill.
   * IMPORTANT: Many UI handlers dispatch Redux updates and then immediately call this.
   * Redux state updates are async, so we accept override values to avoid using stale state.
   */
  const handlePreview = async (overrideWithGst = null, overrides = {}) => {
    // Validation checks
    if (!selectedSeller) {
      toast.warning('⚠️ Please select a seller party first');
      return;
    }
    
    if (selectedItems.length === 0) {
      toast.warning('⚠️ Please add at least one item to the cart');
      return;
    }

    // Validate all items have valid quantities
    const invalidItems = [];
    let hasStockIssue = false;
    
    for (const item of selectedItems) {
      const quantity = parseInt(item.quantity) || 0;
      const availableQty = item.available_quantity || 0;
      
      if (quantity <= 0) {
        invalidItems.push(item.product_name);
      } else if (quantity > availableQty) {
        hasStockIssue = true;
        toast.error(`❌ Insufficient stock for "${item.product_name}". Available: ${availableQty}, Requested: ${quantity}`);
      }
    }
    
    if (invalidItems.length > 0) {
      toast.error(`❌ Invalid quantity for: ${invalidItems.join(', ')}. Quantity must be greater than 0`);
      return;
    }
    
    if (hasStockIssue) {
      return;
    }

    // Ensure sellerInfo is available before calculating preview
    let currentSellerInfo = sellerInfo;
    if (!currentSellerInfo || currentSellerInfo.id !== selectedSeller) {
      try {
        const sellerInfoResult = await dispatch(fetchSellerInfo(selectedSeller)).unwrap();
        currentSellerInfo = sellerInfoResult;
      } catch (error) {
        console.error('Error fetching seller info:', error);
        toast.error('❌ Failed to load seller information. Please try again.');
        return;
      }
    }

    if (!currentSellerInfo) {
      toast.error('❌ Seller information is not available. Please select a seller party again.');
      return;
    }

    const currentWithGst = overrideWithGst !== null ? overrideWithGst : withGst;
    const effectivePayPreviousBalance =
      overrides.payPreviousBalance !== undefined ? overrides.payPreviousBalance : payPreviousBalance;
    const effectivePreviousBalancePaid =
      overrides.previousBalancePaid !== undefined ? overrides.previousBalancePaid : previousBalancePaid;
    const effectivePaymentStatus =
      overrides.paymentStatus !== undefined ? overrides.paymentStatus : paymentStatus;
    const effectivePaidAmount = overrides.paidAmount !== undefined ? overrides.paidAmount : paidAmount;
    
    // Preserve discount values from previewData if it exists
    const itemsToProcess = previewData && previewData.items ? previewData.items.map(pItem => {
      const selectedItem = selectedItems.find(sItem => sItem.item_id === pItem.item_id);
      if (selectedItem) {
        return {
          ...selectedItem,
          discount: pItem.discount !== undefined ? pItem.discount : selectedItem.discount,
          discount_type: pItem.discount_type || selectedItem.discount_type || 'percentage',
          discount_percentage: pItem.discount_percentage !== undefined ? pItem.discount_percentage : selectedItem.discount_percentage
        };
      }
      return selectedItem;
    }).filter(Boolean) : selectedItems;

    try {
      await dispatch(calculatePreview({
        selectedItems: itemsToProcess,
        sellerInfo: currentSellerInfo,
        withGst: currentWithGst,
        payPreviousBalance: effectivePayPreviousBalance,
        previousBalancePaid: effectivePreviousBalancePaid,
        paymentStatus: effectivePaymentStatus,
        paidAmount: effectivePaidAmount
      })).unwrap();
      
      if (overrideWithGst !== null) {
        dispatch(setWithGst(currentWithGst));
      }
      
      toast.success('✅ Bill preview generated successfully');
    } catch (error) {
      console.error('Error in handlePreview:', error);
      toast.error('❌ ' + (error || 'Error calculating preview'));
    }
  };

  const handleSubmit = async () => {
    if (!previewData) {
      toast.warning('⚠️ Please generate bill preview first');
      handlePreview();
      return;
    }

    // Prevent double submission with multiple checks
    if (loading.submit || actionInProgress) {
      toast.warning('⏳ Transaction is already being processed...');
      return;
    }

    try {
      // Comprehensive validation
      if (!previewData.items || previewData.items.length === 0) {
        toast.error('❌ Please add at least one item to the sale');
        return;
      }

      // Validate stock and quantities
      let hasIssues = false;
      for (const item of previewData.items) {
        const availableQty = item.available_quantity || 0;
        const quantity = parseInt(item.quantity) || 0;
        
        if (quantity <= 0) {
          toast.error(`❌ Invalid quantity for "${item.product_name}". Quantity must be greater than 0`);
          hasIssues = true;
        } else if (quantity > availableQty) {
          toast.error(`❌ Insufficient stock for "${item.product_name}". Available: ${availableQty}, Requested: ${quantity}`);
          hasIssues = true;
        }
      }
      
      if (hasIssues) {
        return;
      }

      // Validate payment info
      if (!previewData.paymentStatus) {
        toast.error('❌ Please select a payment status (Fully Paid or Partially Paid)');
        return;
      }

      if (previewData.paymentStatus === 'partially_paid') {
        const paidAmt = parseFloat(previewData.paidAmount) || 0;
        const grandTotal = previewData.grandTotal || previewData.total || 0;
        
        if (paidAmt <= 0) {
          toast.error('❌ Paid amount must be greater than 0 for partially paid transactions');
          return;
        }
        
        if (paidAmt > grandTotal) {
          toast.error(`❌ Paid amount (₹${paidAmt.toFixed(2)}) cannot exceed grand total (₹${grandTotal.toFixed(2)})`);
          return;
        }
      }

      toast.info('⏳ Processing your sale transaction...');
      const result = await dispatch(submitSale({ previewData, selectedSeller })).unwrap();
      
      // Refresh seller info to get updated balance
      if (selectedSeller) {
        dispatch(fetchSellerInfo(selectedSeller)).catch((error) => {
          console.error('Error refreshing seller info:', error);
        });
      }
      
      if (result.transactionId) {
        dispatch(setPrintDisabled(false));
        toast.success(`✅ Sale completed successfully! Bill Number: ${result.billNumber || 'N/A'}. You can now print or download the bill.`);
      } else {
        toast.success('✅ Sale completed successfully!');
        dispatch(resetAfterSale());
      }
    } catch (error) {
      const errorMessage = error || 'Unknown error occurred';
      console.error('Sale submission error:', error);
      toast.error('❌ Transaction failed: ' + errorMessage);
    }
  };

  const handlePrint = () => {
    if (printDisabled || printClicked) {
      toast.warning('⚠️ Please confirm the sale first to enable printing');
      return;
    }
    dispatch(setPrintClicked(true));
    toast.info('🖨️ Preparing print preview...');
    
    // Create a print-friendly window with proper template
    const printContent = document.getElementById('bill-print-content');
    if (!printContent) {
      toast.error('❌ Print content not found');
      dispatch(setPrintClicked(false));
      return;
    }
    
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error('❌ Unable to open print window. Please check your popup blocker settings.');
      dispatch(setPrintClicked(false));
      return;
    }
    
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
            .previous-balance {
              font-weight: bold;
              color: #e65100;
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px solid #ddd;
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
    
    // Wait for content to load before printing
    setTimeout(() => {
      try {
        printWindow.print();
        toast.success('✅ Print dialog opened');
      } catch (printError) {
        console.error('Print error:', printError);
        toast.error('❌ Failed to open print dialog');
        dispatch(setPrintClicked(false));
      }
      // Keep print disabled after clicking
    }, 250);
  };

  const handleDownloadPDF = async () => {
    if (!previewData || !previewData.transactionId) {
      toast.warning('⚠️ Please complete the sale first to download PDF');
      return;
    }
    try {
      toast.info('📥 Preparing PDF download...');
      const response = await apiClient.get(config.api.billPdf(previewData.transactionId), {
        responseType: 'blob',
        timeout: 30000 // 30 second timeout
      });
      
      if (!response.data || response.data.size === 0) {
        toast.error('❌ Received empty PDF file');
        return;
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bill_${previewData.billNumber || previewData.transactionId}_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('✅ PDF downloaded successfully');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      toast.error('❌ Error downloading PDF: ' + errorMsg);
    }
  };

  const handleRemoveFromPreview = (itemId) => {
    dispatch(removePreviewItem(itemId));
  };

  const handleBackToEdit = async () => {
    // Restore all state from previewData to make it persistent
    if (previewData) {
      // Items are already synced in Redux from calculatePreview
      if (previewData.selectedSeller) {
        dispatch(setSelectedSeller(previewData.selectedSeller));
        // Ensure sellerInfo is fetched when going back to edit
        if (!sellerInfo || sellerInfo.id !== previewData.selectedSeller) {
          try {
            await dispatch(fetchSellerInfo(previewData.selectedSeller));
          } catch (error) {
            console.error('Error fetching seller info:', error);
          }
        }
      }
      dispatch(setPaymentStatus(previewData.paymentStatus));
      dispatch(setPaidAmount(previewData.paidAmount));
      // Restore previous balance state if it was set
      if (previewData.previousBalancePaid !== undefined) {
        dispatch(setPreviousBalancePaid(previewData.previousBalancePaid));
        dispatch(setPayPreviousBalance(previewData.previousBalancePaid > 0));
      }
    }
    dispatch(clearPreview());
  };

  // Local state for button actions to prevent double-clicks and race conditions
  const [actionInProgress, setActionInProgress] = useState(false);

  const handleBackToEditClick = async () => {
    if (actionInProgress) return;
    setActionInProgress(true);
    try {
      await handleBackToEdit();
    } finally {
      setActionInProgress(false);
    }
  };

  const handleNewSaleClick = () => {
    if (actionInProgress) return;

    // "Soft refresh" – reset state without reloading the page
    // This clears any old preview/payment/cart/seller selection and brings the UI back to initial state.
    dispatch(resetSellItem());
    dispatch(clearPreview());
    dispatch(fetchSellerParties());

    // Reset local UI flags
    setActionInProgress(false);

    // Nice UX: jump to top so user starts from seller selection again
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });

    toast.info('✨ Ready for new sale');
  };

  const handlePrintClick = () => {
    if (actionInProgress || printDisabled || printClicked) return;
    handlePrint();
  };

  const handleDownloadPDFClick = async () => {
    if (actionInProgress || !previewData?.transactionId) return;
    setActionInProgress(true);
    try {
      await handleDownloadPDF();
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSubmitClick = async () => {
    if (actionInProgress || previewData?.transactionId || loading.submit) return;
    setActionInProgress(true);
    try {
      await handleSubmit();
    } finally {
      setActionInProgress(false);
    }
  };

  if (previewData) {
    const isTransactionComplete = !!previewData.transactionId;
    const isProcessing = loading.submit || actionInProgress || previewLoading;

    return (
      <Layout>
        <div className="sell-item">
          {/* Preview Header with Action Buttons */}
          <div className="preview-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            marginBottom: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>Bill Preview</h2>
            <div className="preview-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {/* Back/New Sale Button */}
              <button 
                onClick={isTransactionComplete ? handleNewSaleClick : handleBackToEditClick}
                className="btn btn-secondary"
                disabled={isProcessing}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  borderRadius: '6px',
                  border: '1px solid #6c757d',
                  backgroundColor: isProcessing ? '#e9ecef' : '#6c757d',
                  color: 'white',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: isProcessing ? 0.6 : 1
                }}
              >
                {isTransactionComplete ? 'New Sale' : 'Back to Edit'}
              </button>

              {/* Print Button */}
              {isTransactionComplete && (
                <button 
                  onClick={handlePrintClick}
                  className="btn btn-primary"
                  disabled={printDisabled || printClicked || isProcessing}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: (printDisabled || printClicked || isProcessing) ? '#95a5a6' : '#3498db',
                    color: 'white',
                    cursor: (printDisabled || printClicked || isProcessing) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: (printDisabled || printClicked || isProcessing) ? 0.6 : 1
                  }}
                >
                  {printClicked ? 'Printing...' : 'Print'}
                </button>
              )}

              {/* Download PDF Button */}
              {isTransactionComplete && (
                <button 
                  onClick={handleDownloadPDFClick}
                  className="btn btn-success"
                  disabled={!previewData.transactionId || isProcessing}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: (!previewData.transactionId || isProcessing) ? '#95a5a6' : '#27ae60',
                    color: 'white',
                    cursor: (!previewData.transactionId || isProcessing) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: (!previewData.transactionId || isProcessing) ? 0.6 : 1
                  }}
                >
                  Download PDF
                </button>
              )}

              {/* Confirm Sale Button */}
              {!isTransactionComplete && (
                <button 
                  onClick={handleSubmitClick}
                  className="btn btn-primary"
                  disabled={isProcessing}
                  style={{
                    padding: '10px 24px',
                    fontSize: '14px',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: isProcessing ? '#95a5a6' : '#2ecc71',
                    color: 'white',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: isProcessing ? 0.6 : 1,
                    boxShadow: isProcessing ? 'none' : '0 2px 4px rgba(46, 204, 113, 0.3)'
                  }}
                >
                  {loading.submit ? 'Processing...' : 'Confirm Sale'}
                </button>
              )}

              {/* Sale Confirmed Badge */}
              {isTransactionComplete && (
                <span style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  borderRadius: '6px',
                  backgroundColor: '#d4edda',
                  color: '#155724',
                  border: '1px solid #c3e6cb'
                }}>
                  ✓ Sale Confirmed
                </span>
              )}
            </div>
          </div>

          {previewLoading && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <LoadingSpinner />
              <p style={{ marginTop: '20px', fontSize: '16px' }}>Calculating preview...</p>
            </div>
          )}
          {previewData && !previewLoading && (
            <div className="bill-preview" id="bill-print-content">
            <div className="bill-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                  <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', fontWeight: 'bold' }}>STEEPRAY INFO SOLUTIONS</h1>
                  <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>Insert Company Address</p>
                </div>
                <div style={{ textAlign: 'right', flex: 1 }}>
                  <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>GSTIN:</strong> <span style={{ color: '#999' }}>Insert GSTIN</span></p>
                  <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Location:</strong> <span style={{ color: '#999' }}>Insert Location</span></p>
                </div>
              </div>
              <div style={{ textAlign: 'center', margin: '20px 0' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '10px 0' }}>TAX INVOICE</h2>
              </div>
              <div className="bill-info" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                <div className="bill-info-left" style={{ flex: 1 }}>
                  <p style={{ margin: '5px 0' }}><strong>Invoice No:</strong> {previewData.billNumber || 'Pending'}</p>
                  <p style={{ margin: '5px 0' }}><strong>Cust. ID:</strong> {previewData.seller?.id || '-'}</p>
                  <p style={{ margin: '5px 0' }}><strong>Name:</strong> {previewData.seller?.party_name || '-'}</p>
                  <p style={{ margin: '5px 0' }}><strong>Address:</strong> {previewData.seller?.address || '-'}</p>
                </div>
                <div className="bill-info-right" style={{ flex: 1, textAlign: 'right' }}>
                  <p style={{ margin: '5px 0' }}><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                  <p style={{ margin: '5px 0' }}><strong>Type:</strong> {previewData.withGst ? 'GST' : 'Non-GST'}</p>
                  <p style={{ margin: '5px 0' }}><strong>Due Date:</strong> {new Date().toLocaleDateString()}</p>
                  {previewData.seller?.gst_number && <p style={{ margin: '5px 0' }}><strong>GSTIN:</strong> {previewData.seller.gst_number}</p>}
                  <p style={{ margin: '5px 0' }}><strong>POS:</strong> <span style={{ color: '#999' }}>Insert POS</span></p>
                </div>
              </div>
            </div>

            <div className="bill-party-info" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
              <div className="previous-balance" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ddd' }}>
                <p style={{ margin: '5px 0', fontWeight: 'bold', color: '#e65100' }}><strong>Previous Balance:</strong> ₹{parseFloat(previewData.seller?.balance_amount || 0).toFixed(2)}</p>
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Product Name</th>
                  {previewData.withGst && <th>HSN</th>}
                  <th>Quantity</th>
                  <th>Rate</th>
                  {previewData.withGst ? (
                    <>
                      <th>Rate (After Discount)</th>
                      <th>Taxable Value</th>
                      <th>GST%</th>
                      <th>GST Value</th>
                      <th>Discount</th>
                      <th>Amount</th>
                    </>
                  ) : (
                    <>
                      <th>Rate (After Discount)</th>
                      <th>Discount</th>
                      <th>Amount</th>
                    </>
                  )}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {previewData.items.map((item, index) => {
                  const availableQty = item.available_quantity || 0;
                  const quantity = item.quantity === '' ? 0 : parseInt(item.quantity) || 0;
                  const isOverStock = quantity > availableQty;
                  const saleRate = parseFloat(item.sale_rate) || 0;
                  const itemTotal = saleRate * quantity;
                  return (
                    <tr key={item.item_id} style={isOverStock ? { backgroundColor: '#ffebee' } : {}}>
                      <td>{index + 1}</td>
                      <td>{item.product_name}</td>
                      {previewData.withGst && <td>{item.hsn_number || '-'}</td>}
                      <td>
                        <input
                          type="number"
                          value={item.quantity === '' ? '' : item.quantity}
                          onChange={(e) => updateQuantityInPreview(item.item_id, e.target.value)}
                          onBlur={(e) => {
                            // When user leaves the field, ensure it has a valid value
                            const val = e.target.value;
                            if (val === '' || parseInt(val) <= 0) {
                              updateQuantityInPreview(item.item_id, '1');
                            }
                          }}
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
                      <td>
                        {/* Original Rate */}
                        <span>₹{parseFloat(item.sale_rate || 0).toFixed(2)}</span>
                      </td>
                      {previewData.withGst ? (
                        <>
                          {/* Rate (After Discount) */}
                          <td>
                            <span>₹{parseFloat(item.effectiveRate || item.sale_rate || 0).toFixed(2)}</span>
                          </td>
                          {/* Taxable Value */}
                          <td>₹{parseFloat(item.taxableValue || 0).toFixed(2)}</td>
                          {/* GST% */}
                          <td>{parseFloat(item.tax_rate || 0).toFixed(2)}%</td>
                          {/* GST Value */}
                          <td>₹{parseFloat(item.taxAmount || 0).toFixed(2)}</td>
                          {/* Discount */}
                          <td>
                            {!previewData.transactionId && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <select
                                  value={item.discount_type || 'percentage'}
                                  onChange={(e) => {
                                    const newDiscountType = e.target.value;
                                    dispatch(updatePreviewItemDiscount({
                                      itemId: item.item_id,
                                      discountType: newDiscountType,
                                      discount: newDiscountType === 'amount' ? (item.discount || 0) : 0,
                                      discountPercentage: newDiscountType === 'percentage' ? (item.discount_percentage || null) : null
                                    }));
                                  }}
                                  style={{ width: '100px', fontSize: '12px' }}
                                >
                                  <option value="percentage">%</option>
                                  <option value="amount">Amount</option>
                                </select>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  min="0"
                                  max={item.discount_type === 'percentage' ? 100 : (item.itemTotal || 0)}
                                  value={item.discount_type === 'percentage' ? (item.discount_percentage !== null && item.discount_percentage !== undefined ? item.discount_percentage : '') : (item.discount || 0)}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    // Allow only numbers and decimal point
                                    if (val !== '' && !/^[\d.]*$/.test(val)) {
                                      return;
                                    }
                                    // Prevent multiple decimal points
                                    if ((val.match(/\./g) || []).length > 1) {
                                      return;
                                    }
                                    // Update discount immediately to preserve input value
                                    if (item.discount_type === 'percentage') {
                                      const numVal = val === '' ? null : (val === '.' ? 0 : (isNaN(parseFloat(val)) ? null : parseFloat(val)));
                                      // Validate percentage doesn't exceed 100
                                      if (numVal !== null && numVal > 100) {
                                        return;
                                      }
                                      dispatch(updatePreviewItemDiscount({
                                        itemId: item.item_id,
                                        discountPercentage: numVal
                                      }));
                                    } else {
                                      const numVal = val === '' ? 0 : (val === '.' ? 0 : (isNaN(parseFloat(val)) ? 0 : parseFloat(val)));
                                      // Validate amount doesn't exceed item total
                                      if (numVal > (item.itemTotal || 0)) {
                                        return;
                                      }
                                      dispatch(updatePreviewItemDiscount({
                                        itemId: item.item_id,
                                        discount: numVal
                                      }));
                                    }
                                    // Note: updatePreviewItemDiscount already recalculates totals immediately
                                  }}
                                  onBlur={(e) => {
                                    // Finalize the value on blur - ensure it's a valid number
                                    const val = e.target.value;
                                    // Finalize discount value on blur
                                    if (item.discount_type === 'percentage') {
                                      const newDiscountPct = val === '' ? null : (parseFloat(val) || 0);
                                      dispatch(updatePreviewItemDiscount({
                                        itemId: item.item_id,
                                        discountPercentage: newDiscountPct
                                      }));
                                    } else {
                                      const newDiscount = val === '' ? 0 : (parseFloat(val) || 0);
                                      dispatch(updatePreviewItemDiscount({
                                        itemId: item.item_id,
                                        discount: newDiscount
                                      }));
                                    }
                                    // Note: updatePreviewItemDiscount already recalculates totals, so no need to call handlePreview
                                  }}
                                  style={{ width: '100px', fontSize: '12px' }}
                                  placeholder={item.discount_type === 'percentage' ? '%' : '₹'}
                                />
                                {(item.itemDiscount || 0) > 0 && (
                                  <small style={{ color: '#28a745', fontSize: '10px' }}>
                                    -₹{(item.itemDiscount || 0).toFixed(2)}
                                  </small>
                                )}
                              </div>
                            )}
                            {previewData.transactionId && (item.itemDiscount || 0) > 0 && (
                              <span style={{ color: '#28a745' }}>-₹{(item.itemDiscount || 0).toFixed(2)}</span>
                            )}
                            {previewData.transactionId && (!item.itemDiscount || item.itemDiscount === 0) && <span>-</span>}
                          </td>
                          <td>₹{parseFloat(item.itemTotalAfterDiscount || itemTotal || 0).toFixed(2)}</td>
                        </>
                      ) : (
                        <>
                          {/* Rate (After Discount) - for non-GST */}
                          <td>
                            <span>₹{parseFloat(item.effectiveRate || item.sale_rate || 0).toFixed(2)}</span>
                          </td>
                          {/* Discount - for non-GST */}
                          <td>
                            {!previewData.transactionId && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <select
                                  value={item.discount_type || 'percentage'}
                                  onChange={(e) => {
                                    const newDiscountType = e.target.value;
                                    dispatch(updatePreviewItemDiscount({
                                      itemId: item.item_id,
                                      discountType: newDiscountType,
                                      discount: newDiscountType === 'amount' ? (item.discount || 0) : 0,
                                      discountPercentage: newDiscountType === 'percentage' ? (item.discount_percentage || null) : null
                                    }));
                                  }}
                                  style={{ width: '100px', fontSize: '12px' }}
                                >
                                  <option value="percentage">%</option>
                                  <option value="amount">Amount</option>
                                </select>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  min="0"
                                  max={item.discount_type === 'percentage' ? 100 : (item.itemTotal || 0)}
                                  value={item.discount_type === 'percentage' ? (item.discount_percentage !== null && item.discount_percentage !== undefined ? item.discount_percentage : '') : (item.discount || 0)}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    // Allow only numbers and decimal point
                                    if (val !== '' && !/^[\d.]*$/.test(val)) {
                                      return;
                                    }
                                    // Prevent multiple decimal points
                                    if ((val.match(/\./g) || []).length > 1) {
                                      return;
                                    }
                                    // Update discount immediately to preserve input value
                                    if (item.discount_type === 'percentage') {
                                      const numVal = val === '' ? null : (val === '.' ? 0 : (isNaN(parseFloat(val)) ? null : parseFloat(val)));
                                      // Validate percentage doesn't exceed 100
                                      if (numVal !== null && numVal > 100) {
                                        return;
                                      }
                                      dispatch(updatePreviewItemDiscount({
                                        itemId: item.item_id,
                                        discountPercentage: numVal
                                      }));
                                    } else {
                                      const numVal = val === '' ? 0 : (val === '.' ? 0 : (isNaN(parseFloat(val)) ? 0 : parseFloat(val)));
                                      // Validate amount doesn't exceed item total
                                      if (numVal > (item.itemTotal || 0)) {
                                        return;
                                      }
                                      dispatch(updatePreviewItemDiscount({
                                        itemId: item.item_id,
                                        discount: numVal
                                      }));
                                    }
                                    // Note: updatePreviewItemDiscount already recalculates totals immediately
                                  }}
                                  onBlur={(e) => {
                                    // Finalize the value on blur - ensure it's a valid number
                                    const val = e.target.value;
                                    // Finalize discount value on blur
                                    if (item.discount_type === 'percentage') {
                                      const newDiscountPct = val === '' ? null : (parseFloat(val) || 0);
                                      dispatch(updatePreviewItemDiscount({
                                        itemId: item.item_id,
                                        discountPercentage: newDiscountPct
                                      }));
                                    } else {
                                      const newDiscount = val === '' ? 0 : (parseFloat(val) || 0);
                                      dispatch(updatePreviewItemDiscount({
                                        itemId: item.item_id,
                                        discount: newDiscount
                                      }));
                                    }
                                    // Note: updatePreviewItemDiscount already recalculates totals, so no need to call handlePreview
                                  }}
                                  style={{ width: '100px', fontSize: '12px' }}
                                  placeholder={item.discount_type === 'percentage' ? '%' : '₹'}
                                />
                                {(item.itemDiscount || 0) > 0 && (
                                  <small style={{ color: '#28a745', fontSize: '10px' }}>
                                    -₹{(item.itemDiscount || 0).toFixed(2)}
                                  </small>
                                )}
                              </div>
                            )}
                            {previewData.transactionId && (item.itemDiscount || 0) > 0 && (
                              <span style={{ color: '#28a745' }}>-₹{(item.itemDiscount || 0).toFixed(2)}</span>
                            )}
                            {previewData.transactionId && (!item.itemDiscount || item.itemDiscount === 0) && <span>-</span>}
                          </td>
                          {/* Amount - for non-GST */}
                          <td>₹{parseFloat(item.itemTotalAfterDiscount || itemTotal || 0).toFixed(2)}</td>
                        </>
                      )}
                      <td>
                        <button
                          onClick={() => handleRemoveFromPreview(item.item_id)}
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
              <tfoot style={{ backgroundColor: '#f8f9fa' }}>
                {/* Subtotal/Taxable Amount Row */}
                {previewData.withGst ? (
                  <tr style={{ borderTop: '2px solid #2c3e50' }}>
                    <td colSpan={5} style={{ textAlign: 'right', padding: '12px', fontWeight: '600', color: '#2c3e50' }}>
                      Taxable Amount:
                    </td>
                    <td colSpan={4} style={{ padding: '12px', fontWeight: '600', fontSize: '15px', color: '#2c3e50' }}>
                      ₹{(previewData.subtotal || 0).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                ) : (
                  <tr style={{ borderTop: '2px solid #2c3e50' }}>
                    <td colSpan={4} style={{ textAlign: 'right', padding: '12px', fontWeight: '600', color: '#2c3e50' }}>
                      Subtotal:
                    </td>
                    <td style={{ padding: '12px', fontWeight: '600', fontSize: '15px', color: '#2c3e50' }}>
                      ₹{(previewData.subtotal || 0).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                )}

                {/* GST Amount Row (only for GST invoices) */}
                {previewData.withGst && (previewData.taxAmount || 0) > 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'right', padding: '10px', fontWeight: '500', color: '#6c757d' }}>
                      Total GST Amount:
                    </td>
                    <td colSpan={4} style={{ padding: '10px', fontWeight: '600', color: '#495057' }}>
                      ₹{(previewData.taxAmount || 0).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                )}

                {/* Invoice Amount Row */}
                <tr style={{ backgroundColor: '#e9ecef' }}>
                  <td colSpan={previewData.withGst ? 5 : 4} style={{ textAlign: 'right', padding: '12px', fontWeight: '700', fontSize: '16px', color: '#2c3e50' }}>
                    Invoice Amount:
                  </td>
                  <td colSpan={previewData.withGst ? 4 : 1} style={{ padding: '12px', fontWeight: '700', fontSize: '16px', color: '#2c3e50' }}>
                    ₹{(previewData.total || 0).toFixed(2)}
                  </td>
                  <td></td>
                </tr>

                {/* Previous Balance Paid Row */}
                {(previewData.previousBalancePaid || 0) > 0 && (
                  <tr>
                    <td colSpan={previewData.withGst ? 6 : 5} style={{ textAlign: 'right', padding: '10px', fontWeight: '600', color: '#155724' }}>
                      Previous Balance Paid:
                    </td>
                    <td colSpan={previewData.withGst ? 1 : 1} style={{ padding: '10px', fontWeight: '600', color: '#155724' }}>
                      +₹{(previewData.previousBalancePaid || 0).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                )}

                {/* Grand Total Row */}
                <tr style={{ backgroundColor: '#28a745', color: 'white' }}>
                  <td colSpan={previewData.withGst ? 6 : 5} style={{ textAlign: 'right', padding: '15px', fontWeight: '700', fontSize: '18px' }}>
                    Grand Total:
                  </td>
                  <td colSpan={previewData.withGst ? 1 : 1} style={{ padding: '15px', fontWeight: '700', fontSize: '20px' }}>
                    ₹{((previewData.grandTotal || previewData.total) || 0).toFixed(2)}
                  </td>
                  <td></td>
                </tr>

                {/* Amount Paid Row */}
                <tr style={{ backgroundColor: '#d4edda' }}>
                  <td colSpan={previewData.withGst ? 6 : 5} style={{ textAlign: 'right', padding: '10px', fontWeight: '600', color: '#155724' }}>
                    Amount Paid:
                  </td>
                  <td colSpan={previewData.withGst ? 1 : 1} style={{ padding: '10px', fontWeight: '600', color: '#155724' }}>
                    ₹{(previewData.paidAmount || 0).toFixed(2)}
                  </td>
                  <td></td>
                </tr>

                {/* Balance Due Row */}
                <tr style={{
                  backgroundColor: ((previewData.grandTotal || previewData.total || 0) - (previewData.paidAmount || 0)) > 0 ? '#f8d7da' : '#d4edda'
                }}>
                  <td colSpan={previewData.withGst ? 6 : 5} style={{
                    textAlign: 'right',
                    padding: '12px',
                    fontWeight: '700',
                    fontSize: '16px',
                    color: ((previewData.grandTotal || previewData.total || 0) - (previewData.paidAmount || 0)) > 0 ? '#721c24' : '#155724'
                  }}>
                    Balance Due:
                  </td>
                  <td colSpan={previewData.withGst ? 1 : 1} style={{
                    padding: '12px',
                    fontWeight: '700',
                    fontSize: '16px',
                    color: ((previewData.grandTotal || previewData.total || 0) - (previewData.paidAmount || 0)) > 0 ? '#721c24' : '#155724'
                  }}>
                    ₹{(((previewData.grandTotal || previewData.total) || 0) - (previewData.paidAmount || 0)).toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            {!previewData.transactionId && (
              <div className="payment-section" style={{
                marginTop: '30px',
                padding: '25px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '2px solid #dee2e6'
              }}>
                <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50', fontSize: '20px', fontWeight: '600' }}>
                  💳 Payment Configuration
                </h3>

                {/* GST Selection */}
                <div style={{
                  marginBottom: '25px',
                  padding: '15px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #dee2e6'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: '500'
                  }}>
                    <input
                      type="checkbox"
                      checked={withGst}
                      onChange={async (e) => {
                        if (actionInProgress || previewLoading) return;
                        setActionInProgress(true);
                        try {
                          const newWithGst = e.target.checked;
                          dispatch(setWithGst(newWithGst));
                          await handlePreview(newWithGst);
                        } finally {
                          setActionInProgress(false);
                        }
                      }}
                      disabled={previewLoading || actionInProgress}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: (previewLoading || actionInProgress) ? 'not-allowed' : 'pointer'
                      }}
                    />
                    <span style={{ color: '#2c3e50' }}>
                      Include GST in calculations
                      {withGst && <span style={{ color: '#28a745', marginLeft: '10px' }}>✓ GST Applied</span>}
                    </span>
                  </label>
                </div>

                {/* Previous Balance Payment */}
                {previewData.seller && previewData.seller.balance_amount > 0 && (
                  <div style={{
                    marginBottom: '25px',
                    padding: '18px',
                    backgroundColor: '#fff3cd',
                    borderRadius: '6px',
                    border: '2px solid #ffc107'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '24px' }}>⚠️</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', fontSize: '16px', color: '#856404' }}>
                          Previous Outstanding Balance
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#e65100', marginTop: '4px' }}>
                          ₹{parseFloat(previewData.seller?.balance_amount || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      fontSize: '15px',
                      fontWeight: '500',
                      marginBottom: payPreviousBalance ? '15px' : '0'
                    }}>
                      <input
                        type="checkbox"
                        checked={payPreviousBalance}
                        onChange={async (e) => {
                          if (actionInProgress) return;
                          setActionInProgress(true);
                          try {
                            const isChecked = e.target.checked;
                            const currentBalance = parseFloat((sellerInfo?.balance_amount || previewData.seller?.balance_amount || 0));
                            const nextPrevPaid = isChecked ? currentBalance : 0;
                            
                            dispatch(setPayPreviousBalance(isChecked));
                            if (isChecked) {
                              dispatch(setPreviousBalancePaid(nextPrevPaid));
                            } else {
                              dispatch(setPreviousBalancePaid(0));
                            }
                            await handlePreview(null, {
                              payPreviousBalance: isChecked,
                              previousBalancePaid: nextPrevPaid
                            });
                          } finally {
                            setActionInProgress(false);
                          }
                        }}
                        disabled={actionInProgress}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: actionInProgress ? 'not-allowed' : 'pointer'
                        }}
                      />
                      <span style={{ color: '#856404' }}>
                        Pay previous balance with this transaction
                      </span>
                    </label>

                    {payPreviousBalance && (
                      <div style={{
                        marginTop: '15px',
                        padding: '15px',
                        backgroundColor: 'white',
                        borderRadius: '5px',
                        border: '1px solid #ffc107'
                      }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#856404' }}>
                          Amount to Pay from Previous Balance
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={sellerInfo?.balance_amount || previewData.seller?.balance_amount || 0}
                          value={previousBalancePaid === 0 ? '' : previousBalancePaid}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              dispatch(setPreviousBalancePaid(0));
                              return;
                            }
                            const amount = parseFloat(val) || 0;
                            const maxAmount = parseFloat((sellerInfo?.balance_amount || previewData.seller?.balance_amount || 0));
                            const finalAmount = Math.min(Math.max(0, amount), maxAmount);
                            dispatch(setPreviousBalancePaid(finalAmount));
                          }}
                          onBlur={async (e) => {
                            if (actionInProgress) return;
                            setActionInProgress(true);
                            try {
                              const val = e.target.value;
                              const amount = val === '' ? 0 : parseFloat(val) || 0;
                              const maxAmount = parseFloat((sellerInfo?.balance_amount || previewData.seller?.balance_amount || 0));
                              const finalAmount = Math.min(Math.max(0, amount), maxAmount);
                              dispatch(setPreviousBalancePaid(finalAmount));
                              await handlePreview(null, {
                                payPreviousBalance: true,
                                previousBalancePaid: finalAmount
                              });
                            } finally {
                              setActionInProgress(false);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.target.blur();
                            }
                          }}
                          disabled={actionInProgress}
                          style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '16px',
                            fontWeight: '500',
                            border: '2px solid #ffc107',
                            borderRadius: '5px',
                            backgroundColor: actionInProgress ? '#f5f5f5' : 'white'
                          }}
                          placeholder="Enter amount"
                        />
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginTop: '10px',
                          fontSize: '13px',
                          color: '#856404'
                        }}>
                          <span>Remaining Balance:</span>
                          <strong>₹{Math.max(0, (sellerInfo?.balance_amount || previewData.seller?.balance_amount || 0) - (previousBalancePaid || 0)).toFixed(2)}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Payment Status */}
                <div style={{
                  padding: '18px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #dee2e6'
                }}>
                  <h4 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>
                    Payment Status for This Invoice
                  </h4>
                  
                  <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
                    <label style={{
                      flex: '1',
                      minWidth: '200px',
                      padding: '15px',
                      border: paymentStatus === 'fully_paid' ? '3px solid #28a745' : '2px solid #dee2e6',
                      borderRadius: '6px',
                      backgroundColor: paymentStatus === 'fully_paid' ? '#d4edda' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                      <input
                        type="radio"
                        value="fully_paid"
                        checked={paymentStatus === 'fully_paid'}
                        onChange={async (e) => {
                          if (actionInProgress) return;
                          setActionInProgress(true);
                          try {
                            const newStatus = e.target.value;
                            dispatch(setPaymentStatus(newStatus));
                            await handlePreview(null, { paymentStatus: newStatus });
                          } finally {
                            setActionInProgress(false);
                          }
                        }}
                        disabled={actionInProgress}
                        style={{ marginRight: '10px' }}
                      />
                      <span style={{ fontWeight: '600', color: paymentStatus === 'fully_paid' ? '#155724' : '#495057' }}>
                        ✓ Fully Paid
                      </span>
                      <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px', marginLeft: '24px' }}>
                        Customer pays the full amount now
                      </div>
                    </label>

                    <label style={{
                      flex: '1',
                      minWidth: '200px',
                      padding: '15px',
                      border: paymentStatus === 'partially_paid' ? '3px solid #ffc107' : '2px solid #dee2e6',
                      borderRadius: '6px',
                      backgroundColor: paymentStatus === 'partially_paid' ? '#fff3cd' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                      <input
                        type="radio"
                        value="partially_paid"
                        checked={paymentStatus === 'partially_paid'}
                        onChange={async (e) => {
                          if (actionInProgress) return;
                          setActionInProgress(true);
                          try {
                            const newStatus = e.target.value;
                            const currentGrand = (previewData.grandTotal || previewData.total) || 0;
                            const nextPaidAmount = (paidAmount === currentGrand) ? 0 : paidAmount;
                            dispatch(setPaymentStatus(newStatus));
                            // Initialize paidAmount to 0 when switching to partially_paid
                            if (paidAmount === currentGrand) {
                              dispatch(setPaidAmount(0));
                            }
                            await handlePreview(null, { paymentStatus: newStatus, paidAmount: nextPaidAmount });
                          } finally {
                            setActionInProgress(false);
                          }
                        }}
                        disabled={actionInProgress}
                        style={{ marginRight: '10px' }}
                      />
                      <span style={{ fontWeight: '600', color: paymentStatus === 'partially_paid' ? '#856404' : '#495057' }}>
                        ⚡ Partially Paid
                      </span>
                      <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px', marginLeft: '24px' }}>
                        Customer pays part now, rest later
                      </div>
                    </label>
                  </div>

                  {paymentStatus === 'partially_paid' && (
                    <div style={{
                      marginTop: '15px',
                      padding: '15px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '5px',
                      border: '1px solid #dee2e6'
                    }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#2c3e50' }}>
                        Amount Paid Now (for this invoice)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={previewData.grandTotal || previewData.total}
                        value={paidAmount === 0 ? '' : paidAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            dispatch(setPaidAmount(0));
                            return;
                          }
                          const amount = parseFloat(val) || 0;
                          const maxAmount = previewData.grandTotal || previewData.total || 0;
                          const finalAmount = Math.min(Math.max(0, amount), maxAmount);
                          dispatch(setPaidAmount(finalAmount));
                        }}
                        onBlur={async (e) => {
                          if (actionInProgress) return;
                          setActionInProgress(true);
                          try {
                            const val = e.target.value;
                            const amount = val === '' ? 0 : parseFloat(val) || 0;
                            const maxAmount = previewData.grandTotal || previewData.total || 0;
                            const finalAmount = Math.min(Math.max(0, amount), maxAmount);
                            dispatch(setPaidAmount(finalAmount));
                            await handlePreview(null, {
                              paymentStatus: 'partially_paid',
                              paidAmount: finalAmount
                            });
                          } finally {
                            setActionInProgress(false);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.target.blur();
                          }
                        }}
                        disabled={actionInProgress}
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: '16px',
                          fontWeight: '500',
                          border: '2px solid #007bff',
                          borderRadius: '5px',
                          backgroundColor: actionInProgress ? '#f5f5f5' : 'white'
                        }}
                        placeholder="Enter paid amount"
                      />
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '10px',
                        fontSize: '13px',
                        color: '#6c757d'
                      }}>
                        <span>Total to Pay:</span>
                        <strong style={{ color: '#2c3e50' }}>₹{(previewData.grandTotal || previewData.total || 0).toFixed(2)}</strong>
                      </div>
                      {paidAmount > 0 && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginTop: '5px',
                          fontSize: '13px',
                          color: '#dc3545',
                          fontWeight: '600'
                        }}>
                          <span>Balance Due:</span>
                          <span>₹{Math.max(0, (previewData.grandTotal || previewData.total || 0) - paidAmount).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {previewData.transactionId && (
              <div className="payment-section" style={{
                marginTop: '30px',
                padding: '25px',
                backgroundColor: '#d4edda',
                borderRadius: '8px',
                border: '2px solid #28a745'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '32px' }}>✅</span>
                  <div>
                    <h3 style={{ margin: 0, color: '#155724', fontSize: '20px', fontWeight: '600' }}>
                      Transaction Completed Successfully
                    </h3>
                    <p style={{ margin: '5px 0 0 0', color: '#155724', fontSize: '14px' }}>
                      Bill Number: <strong>{previewData.billNumber || 'N/A'}</strong>
                    </p>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '15px',
                  padding: '20px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #c3e6cb'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '5px' }}>Payment Status</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#155724' }}>
                      {previewData.paymentStatus === 'fully_paid' ? '✓ Fully Paid' : '⚡ Partially Paid'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '5px' }}>Invoice Amount</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>
                      ₹{(previewData.total || 0).toFixed(2)}
                    </div>
                  </div>
                  {(previewData.previousBalancePaid || 0) > 0 && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '5px' }}>Previous Balance Paid</div>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#28a745' }}>
                        ₹{(previewData.previousBalancePaid || 0).toFixed(2)}
                      </div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '5px' }}>Amount Paid</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#28a745' }}>
                      ₹{(previewData.paidAmount || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '5px' }}>Balance Due</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: ((previewData.grandTotal || previewData.total || 0) - (previewData.paidAmount || 0)) > 0 ? '#dc3545' : '#28a745' }}>
                      ₹{((previewData.grandTotal || previewData.total || 0) - (previewData.paidAmount || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Summary Box */}
            <div className="summary-box" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '30px',
              marginTop: '40px'
            }}>
              <div style={{
                padding: '20px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #dee2e6'
              }}>
                <h4 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>
                  📝 Remarks & Notes
                </h4>
                <p style={{ color: '#6c757d', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                  Thank you for your business. For any queries, please contact us.
                </p>
                <p style={{ color: '#495057', fontSize: '13px', marginTop: '15px', fontStyle: 'italic' }}>
                  Terms & Conditions Apply
                </p>
              </div>

              <div style={{
                padding: '25px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '3px solid #2c3e50',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h4 style={{
                  margin: '0 0 20px 0',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#2c3e50',
                  borderBottom: '2px solid #2c3e50',
                  paddingBottom: '10px'
                }}>
                  💰 Amount Summary
                </h4>

                {/* Subtotal/Taxable */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #e9ecef',
                  fontSize: '14px'
                }}>
                  <span style={{ color: '#6c757d' }}>{previewData.withGst ? 'Taxable Amount:' : 'Subtotal:'}</span>
                  <span style={{ fontWeight: '600', color: '#495057' }}>₹{(previewData.subtotal || 0).toFixed(2)}</span>
                </div>

                {/* GST */}
                {previewData.withGst && (previewData.taxAmount || 0) > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: '1px solid #e9ecef',
                    fontSize: '14px'
                  }}>
                    <span style={{ color: '#6c757d' }}>Total GST:</span>
                    <span style={{ fontWeight: '600', color: '#495057' }}>₹{(previewData.taxAmount || 0).toFixed(2)}</span>
                  </div>
                )}

                {/* Invoice Total */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '2px solid #2c3e50',
                  fontSize: '15px'
                }}>
                  <span style={{ fontWeight: '600', color: '#2c3e50' }}>Invoice Amount:</span>
                  <span style={{ fontWeight: '700', color: '#2c3e50', fontSize: '16px' }}>₹{(previewData.total || 0).toFixed(2)}</span>
                </div>

                {/* Previous Balance Paid */}
                {(previewData.previousBalancePaid || 0) > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    fontSize: '14px',
                    color: '#28a745',
                    fontWeight: '600'
                  }}>
                    <span>Previous Balance Paid:</span>
                    <span>+₹{(previewData.previousBalancePaid || 0).toFixed(2)}</span>
                  </div>
                )}

                {/* Grand Total */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '15px',
                  marginTop: '10px',
                  backgroundColor: '#e8f5e9',
                  borderRadius: '6px',
                  border: '2px solid #28a745'
                }}>
                  <span style={{ fontWeight: '700', fontSize: '18px', color: '#155724' }}>Grand Total:</span>
                  <span style={{ fontWeight: '700', fontSize: '20px', color: '#155724' }}>
                    ₹{((previewData.grandTotal || previewData.total) || 0).toFixed(2)}
                  </span>
                </div>

                {/* Payment breakdown if partially paid */}
                {previewData.paymentStatus === 'partially_paid' && (
                  <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed #dee2e6' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      fontSize: '14px',
                      color: '#28a745'
                    }}>
                      <span style={{ fontWeight: '600' }}>Amount Paid:</span>
                      <span style={{ fontWeight: '600' }}>₹{(previewData.paidAmount || 0).toFixed(2)}</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      fontSize: '14px',
                      color: '#dc3545'
                    }}>
                      <span style={{ fontWeight: '600' }}>Balance Due:</span>
                      <span style={{ fontWeight: '700' }}>₹{Math.max(0, (previewData.grandTotal || previewData.total || 0) - (previewData.paidAmount || 0)).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
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
            {loading.sellerParties && <p style={{ color: '#666', fontSize: '14px' }}>Loading seller parties...</p>}
            {errors.sellerParties && <p style={{ color: 'red', fontSize: '14px' }}>Error: {errors.sellerParties}</p>}
            {!loading.sellerParties && !errors.sellerParties && sellerParties.length === 0 && (
              <p style={{ color: '#666', fontSize: '14px' }}>No seller parties available. Please add seller parties first.</p>
            )}
            <div className="search-wrapper" style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search seller party by name, mobile, or address..."
                value={sellerSearchQuery}
                onChange={(e) => {
                  dispatch(setSellerSearchQuery(e.target.value));
                }}
                onFocus={() => {
                  if (sellerParties.length > 0) {
                    if (sellerSearchQuery) {
                      // Show filtered results if there's a search query
                      dispatch(setShowSellerSuggestions(filteredSellerParties.length > 0));
                    } else {
                      // Show all sellers if no search query
                      dispatch(setShowSellerSuggestions(true));
                    }
                  }
                }}
              />
              {showSellerSuggestions && (sellerSearchQuery ? filteredSellerParties : sellerParties).length > 0 && (
                <div className="suggestions" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                  {(sellerSearchQuery ? filteredSellerParties : sellerParties).map(party => (
                    <div
                      key={party.id}
                      className="suggestion-item"
                      onClick={() => dispatch(selectSellerParty(party))}
                    >
                      {party.party_name} {party.mobile_number && `- ${party.mobile_number}`}
                    </div>
                  ))}
                </div>
              )}
              {sellerSearchQuery && filteredSellerParties.length === 0 && sellerParties.length > 0 && (
                <div className="suggestions" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000 }}>
                  <div className="suggestion-item">No seller party found</div>
                </div>
              )}
            </div>
          </div>

          {sellerInfo && (
            <div className="seller-info" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '15px',
              marginTop: '15px',
              padding: '15px',
              backgroundColor: '#f9f9f9',
              borderRadius: '5px'
            }}>
              <div><strong>Name:</strong> {sellerInfo.party_name}</div>
              <div><strong>Mobile:</strong> {sellerInfo.mobile_number || 'N/A'}</div>
              <div><strong>Address:</strong> {sellerInfo.address || 'N/A'}</div>
              {sellerInfo.gst_number && <div><strong>GST Number:</strong> {sellerInfo.gst_number}</div>}
              <div><strong>Previous Balance:</strong> ₹{sellerInfo.balance_amount || 0}</div>
              <div><strong>Paid Amount:</strong> ₹{sellerInfo.paid_amount || 0}</div>
            </div>
          )}

          <div className="form-group">
            <label>Search Item</label>
            <div className="search-wrapper">
              <input
                type="text"
                placeholder="Type item name to search..."
                value={searchQuery}
                onChange={(e) => dispatch(setSearchQuery(e.target.value))}
              />
              {suggestedItems.length > 0 && (
                <div className="suggestions">
                  {suggestedItems.map(item => (
                    <div
                      key={item.id}
                      className="suggestion-item"
                      onClick={() => handleAddItemToCart(item)}
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
                    const availableQty = item.available_quantity || 0;
                    const quantity = item.quantity === '' ? 0 : parseInt(item.quantity) || 0;
                    const isOverStock = quantity > availableQty;
                    return (
                      <tr key={item.item_id} style={isOverStock ? { backgroundColor: '#ffebee' } : {}}>
                        <td>{item.product_name}</td>
                        <td>₹{parseFloat(item.sale_rate || 0).toFixed(2)}</td>
                        <td>
                          <input
                            type="number"
                            value={item.quantity === '' ? '' : item.quantity}
                            onChange={(e) => handleUpdateQuantity(item.item_id, e.target.value)}
                            onBlur={(e) => {
                              const val = e.target.value;
                              if (val === '' || parseInt(val) <= 0) {
                                handleUpdateQuantity(item.item_id, '1');
                              }
                            }}
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
                        <td>₹{(parseFloat(item.sale_rate || 0) * parseInt(item.quantity || 0)).toFixed(2)}</td>
                        <td>
                          <button
                            onClick={() => {
                              if (actionInProgress) return;
                              handleRemoveItem(item.item_id);
                            }}
                            className="btn btn-danger"
                            disabled={actionInProgress}
                            style={{ 
                              padding: '6px 12px',
                              fontSize: '13px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: actionInProgress ? '#95a5a6' : '#e74c3c',
                              color: 'white',
                              cursor: actionInProgress ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s',
                              opacity: actionInProgress ? 0.6 : 1
                            }}
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
              <div style={{ 
                marginTop: '20px', 
                display: 'flex', 
                gap: '15px', 
                alignItems: 'center',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px',
                border: '1px solid #dee2e6'
              }}>
                <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    cursor: (previewLoading || actionInProgress) ? 'not-allowed' : 'pointer',
                    userSelect: 'none'
                  }}>
                    <input
                      type="checkbox"
                      checked={withGst}
                      onChange={async (e) => {
                        if (previewLoading || actionInProgress) return;
                        const newWithGst = e.target.checked;
                        dispatch(setWithGst(newWithGst));
                        if (previewData && selectedItems.length > 0) {
                          setActionInProgress(true);
                          try {
                            await handlePreview(newWithGst);
                          } finally {
                            setActionInProgress(false);
                          }
                        }
                      }}
                      disabled={previewLoading || actionInProgress}
                      style={{ cursor: (previewLoading || actionInProgress) ? 'not-allowed' : 'pointer' }}
                    />
                    <span style={{ fontWeight: '500' }}>With GST</span>
                  </label>
                </div>
                <button 
                  onClick={async () => {
                    if (previewLoading || actionInProgress) return;
                    setActionInProgress(true);
                    try {
                      await handlePreview();
                    } finally {
                      setActionInProgress(false);
                    }
                  }} 
                  className="btn btn-primary" 
                  disabled={previewLoading || actionInProgress}
                  style={{
                    padding: '12px 24px',
                    fontSize: '15px',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: (previewLoading || actionInProgress) ? '#95a5a6' : '#3498db',
                    color: 'white',
                    cursor: (previewLoading || actionInProgress) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: (previewLoading || actionInProgress) ? 0.6 : 1,
                    boxShadow: (previewLoading || actionInProgress) ? 'none' : '0 2px 4px rgba(52, 152, 219, 0.3)'
                  }}
                >
                  {previewLoading ? 'Calculating...' : 'Preview Bill'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SellItem;
