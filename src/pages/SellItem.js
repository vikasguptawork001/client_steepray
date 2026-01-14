import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import TransactionLoader from '../components/TransactionLoader';
import ItemSearchModal from '../components/ItemSearchModal';
import ActionMenu from '../components/ActionMenu';
import { numberToWords } from '../utils/numberToWords';
import { getLocalDateString } from '../utils/dateUtils';
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
  const itemSearchInputRef = useRef(null);
  
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
    // Only fetch if seller is selected AND we don't already have the info for this seller
    if (selectedSeller && (!sellerInfo || sellerInfo.id !== selectedSeller)) {
      dispatch(fetchSellerInfo(selectedSeller)).catch((error) => {
        console.error('Error fetching seller info:', error);
        toast.error('Failed to load seller information');
      });
    }
  }, [selectedSeller, sellerInfo, dispatch, toast]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      dispatch(searchItems(searchQuery));
      setShowItemSearchModal(true);
    } else {
      dispatch(clearSuggestedItems());
      // Don't close modal when search is cleared - only close explicitly
      // setShowItemSearchModal(false);
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
      // Check if item is out of stock
      if ((item.quantity || 0) <= 0) {
        toast.warning(`⚠️ "${item.product_name || item.item_name}" is out of stock and cannot be added`);
        return;
      }
      
      // Avoid extra network call per click. The autocomplete endpoint returns all we need.
      // `addItemToCart` uses:
      // - id, product_name, sale_rate, tax_rate, hsn_number, quantity (as available_quantity)
      dispatch(addItemToCart(item));
      
      // Don't clear search or close modal - allow adding multiple items
      // Keep UX smooth: no toast spam on every item add
    } catch (error) {
      console.error('Error adding item to cart:', error);
      toast.error('Error adding item');
    }
  };

  const handleModalClose = () => {
    setShowItemSearchModal(false);
    dispatch(setSearchQuery(''));
    dispatch(clearSuggestedItems());
  };

  const handleToggleItemSelection = (itemId) => {
    // Find the item to check if it's out of stock
    const item = suggestedItems.find(i => i.id === itemId);
    if (item && (item.quantity || 0) <= 0) {
      toast.warning(`⚠️ "${item.product_name}" is out of stock and cannot be selected`);
      return;
    }
    
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

  const handleAddSelectedItems = async () => {
    if (selectedItemIds.size === 0) {
      toast.warning('Please select at least one item');
      return;
    }

    const itemsToAdd = suggestedItems.filter(item => selectedItemIds.has(item.id));
    let successCount = 0;
    let skippedCount = 0;
    
    // Add instantly from already-fetched suggestions (no per-item network)
    for (const item of itemsToAdd) {
      // Skip items with 0 quantity
      if ((item.quantity || 0) <= 0) {
        skippedCount++;
        continue;
      }
      dispatch(addItemToCart(item));
      successCount++;
    }

    // Clear selection and search query after adding
    setSelectedItemIds(new Set());
    dispatch(setSearchQuery(''));
    dispatch(clearSuggestedItems());

    if (skippedCount > 0) {
      toast.warning(`⚠️ ${skippedCount} out of stock item${skippedCount !== 1 ? 's' : ''} skipped`);
    }
    if (successCount > 0) {
      toast.success(`✅ ${successCount} item${successCount !== 1 ? 's' : ''} added to cart`);
    } else if (skippedCount > 0) {
      toast.error('❌ No items added. All selected items are out of stock');
    }

    // Focus back to item search input without scrolling
    setTimeout(() => {
      itemSearchInputRef.current?.focus?.({ preventScroll: true });
    }, 100);
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
    
    // Automatically include previous balance if seller has balance
    const previousBalance = parseFloat(currentSellerInfo?.balance_amount || 0);
    const hasPreviousBalance = previousBalance > 0;
    const effectivePayPreviousBalance = hasPreviousBalance; // Always true if there's a balance
    const effectivePreviousBalancePaid = hasPreviousBalance ? previousBalance : 0; // Always full balance if exists
    
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
        // Use Redux state paidAmount as it's the most up-to-date value
        const paidAmt = parseFloat(paidAmount) || 0;
        const grandTotal = previewData.grandTotal || previewData.total || 0;
        
        // Allow 0 for partial payment, only check if negative
        if (paidAmt < 0) {
          toast.error('❌ Paid amount cannot be negative');
          return;
        }
        
        if (paidAmt > grandTotal) {
          toast.error(`❌ Paid amount (₹${paidAmt.toFixed(2)}) cannot exceed grand total (₹${grandTotal.toFixed(2)})`);
          return;
        }
      }

      toast.info('⏳ Processing your sale transaction...');
      // Use current Redux state for paidAmount to ensure we send the latest value
      const currentPaidAmount = previewData.paymentStatus === 'partially_paid' 
        ? (paidAmount || 0) 
        : (previewData.paidAmount || 0);
      
      // Create updated preview data with current paidAmount
      const updatedPreviewData = {
        ...previewData,
        paidAmount: currentPaidAmount
      };
      
      const result = await dispatch(submitSale({ previewData: updatedPreviewData, selectedSeller })).unwrap();
      
      // Refresh seller info to get updated balance after transaction
      // This is necessary to get the updated balance, so we always fetch
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

  const handlePrint = async () => {
    if (printDisabled || printClicked) {
      toast.warning('⚠️ Please confirm the sale first to enable printing');
      return;
    }
    
    if (!previewData || !previewData.transactionId) {
      toast.warning('⚠️ Please complete the sale first to print PDF');
      return;
    }
    
    dispatch(setPrintClicked(true));
    toast.info('🖨️ Preparing PDF for printing...');
    
    try {
      // Fetch the PDF from the same endpoint used for download
      const response = await apiClient.get(config.api.billPdf(previewData.transactionId), {
        responseType: 'blob',
        timeout: 30000 // 30 second timeout
      });
      
      if (!response.data || response.data.size === 0) {
        toast.error('❌ Received empty PDF file');
        dispatch(setPrintClicked(false));
        return;
      }
      
      // Create a blob URL for the PDF
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      
      // Open the PDF in a new window
      const printWindow = window.open(url, '_blank');
      if (!printWindow) {
        toast.error('❌ Unable to open print window. Please check your popup blocker settings.');
        window.URL.revokeObjectURL(url);
        dispatch(setPrintClicked(false));
        return;
      }
      
      // Wait for the PDF to load, then trigger print
      // Note: PDFs may take a moment to render in the browser
      const attemptPrint = () => {
        try {
          printWindow.focus();
          printWindow.print();
          toast.success('✅ Print dialog opened');
          // Clean up the URL after a delay
          setTimeout(() => {
            window.URL.revokeObjectURL(url);
          }, 2000);
        } catch (printError) {
          console.error('Print error:', printError);
          // If print() fails, the PDF is still open and user can print manually
          toast.info('📄 PDF opened in new window. Please use the browser\'s print button.');
          window.URL.revokeObjectURL(url);
          dispatch(setPrintClicked(false));
        }
      };
      
      // Try printing after a short delay to allow PDF to load
      setTimeout(attemptPrint, 1000);
      
    } catch (error) {
      console.error('Error fetching PDF for print:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      toast.error('❌ Error loading PDF for printing: ' + errorMsg);
      dispatch(setPrintClicked(false));
    }
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
      link.setAttribute('download', `bill_${previewData.billNumber || previewData.transactionId}_${getLocalDateString()}.pdf`);
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
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [showItemSearchModal, setShowItemSearchModal] = useState(false);
  const billPreviewRef = useRef(null);

  // Manage body scroll when transaction is processing
  useEffect(() => {
    const isProcessing = loading.submit || actionInProgress;
    if (isProcessing) {
      document.body.classList.add('transaction-loading');
    } else {
      document.body.classList.remove('transaction-loading');
    }
    return () => {
      document.body.classList.remove('transaction-loading');
    };
  }, [loading.submit, actionInProgress]);

  // Scroll-to-top functionality disabled - bill preview is no longer scrollable
  // The preview will show completely without internal scrolling

  const handleScrollToTop = () => {
    if (billPreviewRef.current) {
      billPreviewRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCopyBillNumber = () => {
    if (previewData?.billNumber) {
      navigator.clipboard.writeText(previewData.billNumber);
      toast.success(`Bill number ${previewData.billNumber} copied to clipboard!`);
    }
  };

  const isBulkSelecting = selectedItemIds.size > 0;

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
        <TransactionLoader isLoading={loading.submit || actionInProgress} type="sell" />
        <div className="sell-item">
          {/* Preview Header with Action Buttons */}
          <div className="preview-header">
            <div>
              <h2>Bill Preview</h2>
              {previewData.billNumber && (
                <div style={{ 
                  margin: '6px 0 0 0', 
                  fontSize: '13px', 
                  color: '#6c757d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>Invoice #: <strong style={{ color: '#2c3e50' }}>{previewData.billNumber}</strong></span>
                  <button
                    onClick={handleCopyBillNumber}
                    className="btn btn-secondary"
                    aria-label="Copy bill number to clipboard"
                    style={{ 
                      padding: '4px 8px', 
                      fontSize: '11px',
                      minHeight: 'auto',
                      minWidth: 'auto'
                    }}
                    title="Copy bill number"
                  >
                    📋 Copy
                  </button>
                </div>
              )}
            </div>
            <div className="preview-actions">
              {/* Back/New Sale Button */}
              <button 
                onClick={isTransactionComplete ? handleNewSaleClick : handleBackToEditClick}
                className="btn btn-secondary"
                disabled={isProcessing}
                aria-disabled={isProcessing}
                aria-label={isTransactionComplete ? 'Start a new sale' : 'Go back to edit the bill'}
                tabIndex={isProcessing ? -1 : 0}
              >
                {isTransactionComplete ? 'New Sale' : 'Back to Edit'}
              </button>

              {/* Print Button */}
              {isTransactionComplete && (
                <button 
                  onClick={handlePrintClick}
                  className="btn btn-primary"
                  disabled={printDisabled || printClicked || isProcessing}
                  aria-disabled={printDisabled || printClicked || isProcessing}
                  aria-label={printClicked ? 'Printing bill' : 'Print bill'}
                  tabIndex={(printDisabled || printClicked || isProcessing) ? -1 : 0}
                >
                  {printClicked ? (
                    <>
                      <div style={{ 
                        display: 'inline-block',
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderTop: '2px solid #fff',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        marginRight: '8px'
                      }}></div>
                      Printing...
                    </>
                  ) : (
                    'Print'
                  )}
                </button>
              )}

              {/* Download PDF Button */}
              {isTransactionComplete && (
                <button 
                  onClick={handleDownloadPDFClick}
                  className="btn btn-success"
                  disabled={!previewData.transactionId || isProcessing}
                  aria-disabled={!previewData.transactionId || isProcessing}
                  aria-label="Download bill as PDF"
                  tabIndex={(!previewData.transactionId || isProcessing) ? -1 : 0}
                >
                  Download PDF
                </button>
              )}

              {/* Confirm Sale Button */}
              {!isTransactionComplete && (
                <button 
                  onClick={handleSubmitClick}
                  className="btn btn-success"
                  disabled={isProcessing}
                  aria-disabled={isProcessing}
                  aria-label={loading.submit ? 'Processing sale transaction' : 'Confirm and submit sale'}
                  tabIndex={isProcessing ? -1 : 0}
                  style={{
                    fontSize: '15px',
                    padding: '12px 28px',
                    fontWeight: '600'
                  }}
                >
                  {loading.submit ? (
                    <>
                      <div style={{ 
                        display: 'inline-block',
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderTop: '2px solid #fff',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        marginRight: '8px'
                      }}></div>
                      Processing...
                    </>
                  ) : (
                    'Confirm Sale'
                  )}
                </button>
              )}

              {/* Sale Confirmed Badge */}
              {isTransactionComplete && (
                <div style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  background: '#d4edda',
                  color: '#155724',
                  border: '1px solid #c3e6cb'
                }}>
                  Sale Confirmed
                </div>
              )}
            </div>
          </div>

          {previewLoading && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              minHeight: '400px',
              padding: '40px',
              textAlign: 'center',
              width: '100%'
            }}>
              <div style={{ 
                display: 'inline-block',
                width: '50px',
                height: '50px',
                border: '4px solid #e1e8ed',
                borderTop: '4px solid #3498db',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                marginBottom: '20px'
              }}></div>
              <p style={{ marginTop: '0', fontSize: '16px', color: '#495057' }}>Calculating preview...</p>
            </div>
          )}
          {previewData && !previewLoading && (
            <div style={{ position: 'relative' }}>
              <div
                ref={billPreviewRef}
                className="bill-preview"
                id="bill-print-content"
                tabIndex={0}
                style={{
                  outline: 'none',
                  overflow: 'visible',
                  position: 'relative',
                  paddingBottom: '120px',
                  marginBottom: '80px'
                }}
              >
            {/* Seller Info Only */}
            <div style={{ marginBottom: '25px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: '600', color: '#2c3e50' }}>Customer Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', fontSize: '14px' }}>
                <div>
                  <strong>Name:</strong> {previewData.seller?.party_name || '-'}
                </div>
                {previewData.seller?.address && (
                  <div>
                    <strong>Address:</strong> {previewData.seller.address}
                  </div>
                )}
                {previewData.seller?.mobile_number && (
                  <div>
                    <strong>Mobile No.:</strong> {previewData.seller.mobile_number}
                  </div>
                )}
                {previewData.seller?.gst_number && (
                  <div>
                    <strong>GSTIN / UIN:</strong> {previewData.seller.gst_number}
                  </div>
                )}
                {previewData.billNumber && (
                  <div>
                    <strong>Invoice No.:</strong> {previewData.billNumber}
                  </div>
                )}
                <div>
                  <strong>Date:</strong> {new Date().toLocaleDateString('en-GB')}
                </div>
              </div>
            </div>

            <table className="table bill-preview-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', fontSize: '12px' }}>
              <thead style={{ backgroundColor: '#34495e', color: '#ffffff' }}>
                <tr>
                  <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600', border: '1px solid #2c3e50', backgroundColor: '#34495e', color: '#ffffff' }}>S.N.</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', border: '1px solid #2c3e50', backgroundColor: '#34495e', color: '#ffffff' }}>Description of Goods</th>
                  {previewData.withGst && (
                    <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600', border: '1px solid #2c3e50', backgroundColor: '#34495e', color: '#ffffff' }}>HSN/Code</th>
                  )}
                  <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600', border: '1px solid #2c3e50', backgroundColor: '#34495e', color: '#ffffff' }}>Qty.</th>
                  <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600', border: '1px solid #2c3e50', backgroundColor: '#34495e', color: '#ffffff' }}>Unit</th>
                  <th style={{ padding: '8px', textAlign: 'right', fontWeight: '600', border: '1px solid #2c3e50', backgroundColor: '#34495e', color: '#ffffff' }}>MRP</th>
                  <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600', border: '1px solid #2c3e50', backgroundColor: '#34495e', color: '#ffffff' }}>Disc%</th>
                  <th style={{ padding: '8px', textAlign: 'right', fontWeight: '600', border: '1px solid #2c3e50', backgroundColor: '#34495e', color: '#ffffff' }}>Price</th>
                  {previewData.withGst && (
                    <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600', border: '1px solid #2c3e50', backgroundColor: '#34495e', color: '#ffffff' }}>Tax Rate</th>
                  )}
                  <th style={{ padding: '8px', textAlign: 'right', fontWeight: '600', border: '1px solid #2c3e50', backgroundColor: '#34495e', color: '#ffffff' }}>Amount(₹)</th>
                  {!previewData.transactionId && <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600', border: '1px solid #2c3e50', backgroundColor: '#34495e', color: '#ffffff' }}>Action</th>}
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
                    <tr key={item.item_id} style={{ backgroundColor: isOverStock ? '#ffebee' : 'transparent', border: '1px solid #ddd' }}>
                      <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }}>{index + 1}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.product_name}</td>
                      {previewData.withGst && (
                        <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }}>{item.hsn_number || '-'}</td>
                      )}
                      <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }}>
                        <input
                          type="number"
                          step="any"
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
                      <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }}>PCS</td>
                      <td style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd' }}>₹{parseFloat(item.sale_rate || 0).toFixed(2)}</td>
                      <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }}>
                        {!previewData.transactionId ? (
                                <input
                            type="number"
                            step="any"
                                  min="0"
                            max="100"
                            value={item.discount_type === 'percentage' ? (item.discount_percentage || 0) : 0}
                                  onChange={(e) => {
                              const inputVal = e.target.value;
                              // If empty, set to 0 immediately
                              if (inputVal === '') {
                                dispatch(updatePreviewItemDiscount({
                                  itemId: item.item_id,
                                  discountType: 'percentage',
                                  discountPercentage: 0
                                }));
                                return;
                              }
                              const val = parseFloat(inputVal);
                              // If invalid, set to 0
                              if (isNaN(val) || val < 0) {
                                dispatch(updatePreviewItemDiscount({
                                  itemId: item.item_id,
                                  discountType: 'percentage',
                                  discountPercentage: 0
                                }));
                                return;
                              }
                              // Valid number - update with constraints
                              dispatch(updatePreviewItemDiscount({
                                itemId: item.item_id,
                                discountType: 'percentage',
                                discountPercentage: Math.min(100, Math.max(0, val))
                              }));
                                  }}
                                  onBlur={(e) => {
                              const inputVal = e.target.value;
                              // If empty or invalid on blur, revert to 0
                              if (inputVal === '' || isNaN(parseFloat(inputVal))) {
                                dispatch(updatePreviewItemDiscount({
                                  itemId: item.item_id,
                                  discountType: 'percentage',
                                  discountPercentage: 0
                                }));
                                return;
                              }
                              const val = parseFloat(inputVal) || 0;
                              dispatch(updatePreviewItemDiscount({
                                itemId: item.item_id,
                                discountType: 'percentage',
                                discountPercentage: Math.min(100, Math.max(0, val))
                              }));
                                  }}
                            style={{ width: '60px', fontSize: '11px', textAlign: 'center', padding: '4px' }}
                            placeholder="%"
                            className="discount-input"
                          />
                        ) : (
                          <span>{item.discount_type === 'percentage' ? (item.discount_percentage || 0).toFixed(2) : '-'}%</span>
                            )}
                          </td>
                      <td style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd' }}>₹{parseFloat(item.effectiveRate || item.sale_rate || 0).toFixed(2)}</td>
                      {previewData.withGst && (
                        <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }}>{parseFloat(item.tax_rate || 0).toFixed(2)}%</td>
                      )}
                      <td style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd', fontWeight: '600' }}>₹{parseFloat(item.itemTotalAfterDiscount || itemTotal || 0).toFixed(2)}</td>
                      {!previewData.transactionId && (
                        <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }}>
                          <ActionMenu
                            itemId={item.item_id}
                            itemName={item.product_name}
                            actions={[
                              {
                                label: 'Remove',
                                icon: '🗑️',
                                danger: true,
                                onClick: (id) => handleRemoveFromPreview(id)
                              }
                            ]}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ backgroundColor: '#f8f9fa' }}>
                {/* Calculate totals */}
                {(() => {
                  const totalQty = previewData.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
                  const grandTotal = previewData.grandTotal || previewData.total || 0;
                  const roundedOff = Math.round(grandTotal) - grandTotal;
                  const finalGrandTotal = Math.round(grandTotal);
                  const taxableAmt = previewData.subtotal || 0;
                  const cgstAmt = previewData.withGst ? (previewData.taxAmount || 0) / 2 : 0;
                  const sgstAmt = previewData.withGst ? (previewData.taxAmount || 0) / 2 : 0;
                  const totalTax = previewData.taxAmount || 0;
                  
                  return (
                    <>
                      {/* Less: Rounded Off */}
                      {Math.abs(roundedOff) > 0.01 && (
                  <tr>
                          <td colSpan={previewData.withGst ? 8 : 7} style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd', fontSize: '12px' }}>
                            Less: Rounded Off ({roundedOff > 0 ? '-' : '+'}):
                    </td>
                          <td style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd', fontWeight: '600', fontSize: '12px' }}>
                            ₹{roundedOff.toFixed(2)}
                    </td>
                          {!previewData.transactionId && <td></td>}
                  </tr>
                )}

                      {/* Grand Total (Quantity and Amount) */}
                      <tr style={{ backgroundColor: '#e9ecef', borderTop: '2px solid #2c3e50' }}>
                        <td colSpan={previewData.withGst ? 3 : 2} style={{ textAlign: 'left', padding: '10px', border: '1px solid #ddd', fontWeight: '700', fontSize: '13px' }}>
                          Grand Total (Quantity): {totalQty.toFixed(2)} PCS
                  </td>
                        <td colSpan={previewData.withGst ? 5 : 5} style={{ textAlign: 'right', padding: '10px', border: '1px solid #ddd', fontWeight: '700', fontSize: '16px' }}>
                          Grand Total (Amount): ₹{finalGrandTotal.toFixed(2)}
                  </td>
                        {!previewData.transactionId && <td></td>}
                </tr>

                      {/* Tax Summary (only for GST) */}
                      {previewData.withGst && totalTax > 0 && (
                        <tr style={{ backgroundColor: '#f8f9fa', borderTop: '1px solid #ddd' }}>
                          <td colSpan={previewData.withGst ? 8 : 7} style={{ padding: '10px', border: '1px solid #ddd', fontSize: '12px', fontWeight: '600' }}>
                            Tax Summary:
                    </td>
                          {!previewData.transactionId && <td></td>}
                  </tr>
                )}
                      {previewData.withGst && totalTax > 0 && (
                        <>
                          <tr>
                            {/* <td colSpan={3} style={{ padding: '8px', border: '1px solid #ddd', fontSize: '12px' }}>Tax Rate: {previewData.items[0]?.tax_rate || 0}%</td> */}
                            <td colSpan={2} style={{ padding: '8px', border: '1px solid #ddd', fontSize: '12px' }}>Taxable Amt.: ₹{taxableAmt.toFixed(2)}</td>
                            <td style={{ padding: '8px', border: '1px solid #ddd', fontSize: '12px' }}>CGST Amt.: ₹{cgstAmt.toFixed(2)}</td>
                            <td style={{ padding: '8px', border: '1px solid #ddd', fontSize: '12px' }}>SGST Amt.: ₹{sgstAmt.toFixed(2)}</td>
                            <td colSpan={2} style={{ padding: '8px', border: '1px solid #ddd', fontSize: '12px', fontWeight: '600' }}>Total Tax: ₹{totalTax.toFixed(2)}</td>
                            {!previewData.transactionId && <td></td>}
                          </tr>
                        </>
                      )}
                      
                      {/* Previous Balance Row */}
                      {(previewData.previousBalance || 0) > 0 && (
                        <tr>
                          <td colSpan={previewData.withGst ? 8 : 7} style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd', fontSize: '12px', fontWeight: '600', color: '#e65100' }}>
                            Previous Balance:
                  </td>
                          <td style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd', fontSize: '12px', fontWeight: '600', color: '#e65100' }}>
                            +₹{(previewData.previousBalance || 0).toFixed(2)}
                  </td>
                          {!previewData.transactionId && <td></td>}
                </tr>
                      )}

                      {/* Amount Paid and Balance Due */}
                <tr style={{ backgroundColor: '#d4edda' }}>
                        <td colSpan={previewData.withGst ? 8 : 7} style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd', fontSize: '12px', fontWeight: '600' }}>
                    Amount Paid:
                  </td>
                        <td style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd', fontSize: '12px', fontWeight: '600' }}>
                    ₹{(paymentStatus === 'partially_paid' ? (paidAmount || 0) : (previewData.paidAmount || 0)).toFixed(2)}
                  </td>
                        {!previewData.transactionId && <td></td>}
                </tr>
                      <tr style={{ backgroundColor: ((previewData.grandTotal || previewData.total || 0) - (paymentStatus === 'partially_paid' ? (paidAmount || 0) : (previewData.paidAmount || 0))) > 0 ? '#f8d7da' : '#d4edda' }}>
                        <td colSpan={previewData.withGst ? 8 : 7} style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd', fontSize: '12px', fontWeight: '700' }}>
                    Balance Due:
                  </td>
                        <td style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd', fontSize: '12px', fontWeight: '700' }}>
                    ₹{(((previewData.grandTotal || previewData.total) || 0) - (paymentStatus === 'partially_paid' ? (paidAmount || 0) : (previewData.paidAmount || 0))).toFixed(2)}
                  </td>
                        {!previewData.transactionId && <td></td>}
                </tr>
                    </>
                  );
                })()}
              </tfoot>
            </table>
            
            {/* White Container for Amount in Words and Payment Configuration */}
            <div style={{ 
              marginTop: '20px', 
              padding: '20px',
              paddingBottom: '50px',
              marginBottom: '50px',
              backgroundColor: '#ffffff', 
              borderRadius: '12px', 
              border: '1px solid #e1e8ed',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            }}>
              {/* Amount in Words */}
              <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '2px solid #e9ecef' }}>
                <p style={{ margin: '0', fontSize: '14px', fontWeight: '600', color: '#212529' }}>
                  <strong>Amount in Words:</strong> {numberToWords(previewData.grandTotal || previewData.total || 0)}
                </p>
              </div>

            {!previewData.transactionId && (
              <div className="payment-section" style={{ marginTop: '0', width: '100%' }}>
                <div style={{
                  marginBottom: '15px',
                  paddingBottom: '10px',
                  borderBottom: '2px solid #e9ecef'
                }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#212529',
                    letterSpacing: '-0.3px'
                  }}>
                    Payment Configuration
                  </h3>
                </div>

                {/* Professional Payment Controls Row */}
                <div className="payment-controls-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto auto 1fr auto',
                  gap: '15px',
                  alignItems: 'center',
                  padding: '15px',
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  width: '100%'
                }}>
                  {/* GST Selection */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 15px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    border: '1px solid #e9ecef',
                    minWidth: '160px',
                    height: '42px'
                  }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      margin: 0,
                      width: '100%',
                      color: '#495057'
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
                          cursor: (previewLoading || actionInProgress) ? 'not-allowed' : 'pointer',
                          accentColor: '#28a745'
                        }}
                      />
                      <span>
                        Include GST
                        {withGst && <span style={{ color: '#28a745', marginLeft: '8px', fontWeight: '600' }}>✓</span>}
                      </span>
                    </label>
                  </div>

                  {/* Previous Balance Payment */}
                  {previewData.seller && previewData.seller.balance_amount > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 15px',
                      backgroundColor: '#fff8e1',
                      borderRadius: '8px',
                      border: '1px solid #ffc107',
                      minWidth: '180px',
                      height: '42px'
                    }}>
                      <span style={{ fontSize: '18px', lineHeight: 1 }}>⚠️</span>
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.3' }}>
                        <div style={{ fontWeight: '600', fontSize: '12px', color: '#856404', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Previous Balance
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#e65100', marginTop: '2px' }}>
                          ₹{parseFloat(previewData.seller?.balance_amount || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment Status Radio Buttons */}
                  <div style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      border: paymentStatus === 'fully_paid' ? '2px solid #28a745' : '1px solid #dee2e6',
                      borderRadius: '8px',
                      backgroundColor: paymentStatus === 'fully_paid' ? '#d4edda' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minWidth: '130px',
                      justifyContent: 'center',
                      boxShadow: paymentStatus === 'fully_paid' ? '0 2px 4px rgba(40, 167, 69, 0.2)' : 'none'
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
                        style={{ margin: 0, accentColor: '#28a745' }}
                      />
                      <span style={{ 
                        fontWeight: '600', 
                        color: paymentStatus === 'fully_paid' ? '#155724' : '#6c757d', 
                        fontSize: '14px',
                        letterSpacing: '0.2px'
                      }}>
                        Fully Paid
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      border: paymentStatus === 'partially_paid' ? '2px solid #ffc107' : '1px solid #dee2e6',
                      borderRadius: '8px',
                      backgroundColor: paymentStatus === 'partially_paid' ? '#fff8e1' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minWidth: '130px',
                      justifyContent: 'center',
                      boxShadow: paymentStatus === 'partially_paid' ? '0 2px 4px rgba(255, 193, 7, 0.2)' : 'none'
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
                        style={{ margin: 0, accentColor: '#ffc107' }}
                      />
                      <span style={{ 
                        fontWeight: '600', 
                        color: paymentStatus === 'partially_paid' ? '#856404' : '#6c757d', 
                        fontSize: '14px',
                        letterSpacing: '0.2px'
                      }}>
                        Partially Paid
                      </span>
                    </label>
                  </div>

                  {/* Amount Paid Now Input */}
                  {paymentStatus === 'partially_paid' && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                      minWidth: '200px'
                    }}>
                      <label style={{ 
                        fontSize: '11px', 
                        fontWeight: '600', 
                        color: '#495057',
                        margin: 0,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Amount Paid
                      </label>
                      <div style={{ position: 'relative' }}>
                        <span style={{
                          position: 'absolute',
                          left: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#6c757d',
                          fontWeight: '600',
                          fontSize: '13px'
                        }}>₹</span>
                        <input
                          type="number"
                          step="any"
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
                            // Update state immediately so input reflects the change
                            dispatch(setPaidAmount(finalAmount));
                          }}
                          onBlur={async (e) => {
                            if (actionInProgress) return;
                            setActionInProgress(true);
                            try {
                              // Use the current Redux state paidAmount, not the input value
                              // This ensures we use the value that was set in onChange
                              const currentPaidAmount = paidAmount || 0;
                              const maxAmount = previewData.grandTotal || previewData.total || 0;
                              const finalAmount = Math.min(Math.max(0, currentPaidAmount), maxAmount);
                              
                              // Ensure state is set correctly
                              if (finalAmount !== paidAmount) {
                                dispatch(setPaidAmount(finalAmount));
                              }
                              
                              // Update preview with the current paid amount
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
                            padding: '9px 10px 9px 28px',
                            fontSize: '14px',
                            fontWeight: '600',
                            border: '1px solid #ced4da',
                            borderRadius: '8px',
                            backgroundColor: actionInProgress ? '#f8f9fa' : '#ffffff',
                            width: '100%',
                            color: '#212529',
                            transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out'
                          }}
                          placeholder="0.00"
                          onFocus={(e) => {
                            e.target.style.borderColor = '#007bff';
                            e.target.style.boxShadow = '0 0 0 0.2rem rgba(0, 123, 255, 0.25)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#ced4da';
                            e.target.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                      <div style={{
                        fontSize: '10px',
                        color: '#6c757d',
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '2px'
                      }}>
                        <span>Total: <strong style={{ color: '#212529' }}>₹{(previewData.grandTotal || previewData.total || 0).toFixed(2)}</strong></span>
                        {paidAmount > 0 && (
                          <span style={{ color: '#dc3545', fontWeight: '600' }}>
                            Due: ₹{Math.max(0, (previewData.grandTotal || previewData.total || 0) - paidAmount).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Action Buttons at Bottom */}
            {!previewData.transactionId && (
              <div style={{ 
                display: 'flex', 
                gap: '15px', 
                marginTop: '20px',
                marginBottom: '30px',
                paddingTop: '15px',
                paddingBottom: '20px',
                borderTop: '2px solid #e9ecef',
                width: '100%'
              }}>
                <button 
                  onClick={handleBackToEditClick}
                  className="btn btn-secondary"
                  disabled={isProcessing}
                  aria-disabled={isProcessing}
                  aria-label="Go back to edit the bill"
                  tabIndex={isProcessing ? -1 : 0}
                  style={{
                    flex: '1 1 auto',
                    padding: '12px 28px',
                    fontSize: '15px',
                    fontWeight: '600',
                    minWidth: '150px'
                  }}
                >
                  Back to Edit
                </button>
                <button 
                  onClick={handleSubmitClick}
                  className="btn btn-success"
                  disabled={isProcessing}
                  aria-disabled={isProcessing}
                  aria-label={loading.submit ? 'Processing sale transaction' : 'Confirm and submit sale'}
                  tabIndex={isProcessing ? -1 : 0}
                  style={{
                    flex: '1 1 auto',
                    padding: '12px 28px',
                    fontSize: '15px',
                    fontWeight: '600',
                    minWidth: '150px'
                  }}
                >
                  {loading.submit ? (
                    <>
                      <div style={{ 
                        display: 'inline-block',
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderTop: '2px solid #fff',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        marginRight: '8px'
                      }}></div>
                      Processing...
                    </>
                  ) : (
                    'Confirm Sale'
                  )}
                </button>
              </div>
            )}
            </div>
            
            {previewData.transactionId && (
              <div className="payment-section" style={{
                background: 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)',
                border: '2px solid #28a745',
                boxShadow: '0 4px 16px rgba(40, 167, 69, 0.2)',
                marginTop: '20px',
                marginBottom: '100px',
                padding: '25px',
                paddingBottom: '60px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '15px', 
                  marginBottom: '25px',
                  paddingBottom: '20px',
                  borderBottom: '2px solid #28a745'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)'
                  }}>
                    ✅
                  </div>
                  <div>
                    <h3 style={{ 
                      margin: 0, 
                      color: '#155724', 
                      fontSize: '24px', 
                      fontWeight: '700',
                      letterSpacing: '-0.5px'
                    }}>
                      Transaction Completed Successfully
                    </h3>
                    <p style={{ 
                      margin: '8px 0 0 0', 
                      color: '#155724', 
                      fontSize: '15px',
                      fontWeight: '500'
                    }}>
                      📄 Bill Number: <strong style={{ fontSize: '16px' }}>{previewData.billNumber || 'N/A'}</strong>
                    </p>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '20px',
                  padding: '25px',
                  paddingBottom: '30px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  border: '1px solid #c3e6cb',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  marginBottom: '20px'
                }}>
                  <div style={{
                    padding: '15px',
                    background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
                    borderRadius: '10px',
                    border: '1px solid #e9ecef'
                  }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#6c757d', 
                      marginBottom: '8px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Payment Status
                    </div>
                    <div style={{ 
                      fontSize: '18px', 
                      fontWeight: '700', 
                      color: '#155724',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {previewData.paymentStatus === 'fully_paid' ? '✓ Fully Paid' : '⚡ Partially Paid'}
                    </div>
                  </div>
                  <div style={{
                    padding: '15px',
                    background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
                    borderRadius: '10px',
                    border: '1px solid #e9ecef'
                  }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#6c757d', 
                      marginBottom: '8px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Invoice Amount
                    </div>
                    <div style={{ 
                      fontSize: '18px', 
                      fontWeight: '700', 
                      color: '#2c3e50'
                    }}>
                      ₹{(previewData.total || 0).toFixed(2)}
                    </div>
                  </div>
                  {(previewData.previousBalancePaid || 0) > 0 && (
                    <div style={{
                      padding: '15px',
                      background: 'linear-gradient(135deg, #fff3cd 0%, #ffffff 100%)',
                      borderRadius: '10px',
                      border: '1px solid #ffeaa7'
                    }}>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#856404', 
                        marginBottom: '8px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Previous Balance Paid
                      </div>
                      <div style={{ 
                        fontSize: '18px', 
                        fontWeight: '700', 
                        color: '#e65100'
                      }}>
                        +₹{(previewData.previousBalancePaid || 0).toFixed(2)}
                      </div>
                    </div>
                  )}
                  <div style={{
                    padding: '15px',
                    background: 'linear-gradient(135deg, #d4edda 0%, #ffffff 100%)',
                    borderRadius: '10px',
                    border: '1px solid #c3e6cb'
                  }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#155724', 
                      marginBottom: '8px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Amount Paid
                    </div>
                    <div style={{ 
                      fontSize: '18px', 
                      fontWeight: '700', 
                      color: '#28a745'
                    }}>
                      ₹{(paymentStatus === 'partially_paid' ? (paidAmount || 0) : (previewData.paidAmount || 0)).toFixed(2)}
                    </div>
                  </div>
                  <div style={{
                    padding: '15px',
                    background: ((previewData.grandTotal || previewData.total || 0) - (paymentStatus === 'partially_paid' ? (paidAmount || 0) : (previewData.paidAmount || 0))) > 0 
                      ? 'linear-gradient(135deg, #fff5f5 0%, #ffffff 100%)'
                      : 'linear-gradient(135deg, #d4edda 0%, #ffffff 100%)',
                    borderRadius: '10px',
                    border: ((previewData.grandTotal || previewData.total || 0) - (paymentStatus === 'partially_paid' ? (paidAmount || 0) : (previewData.paidAmount || 0))) > 0 
                      ? '1px solid #fecaca'
                      : '1px solid #c3e6cb'
                  }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: ((previewData.grandTotal || previewData.total || 0) - (paymentStatus === 'partially_paid' ? (paidAmount || 0) : (previewData.paidAmount || 0))) > 0 ? '#721c24' : '#155724', 
                      marginBottom: '8px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Balance Due
                    </div>
                    <div style={{ 
                      fontSize: '18px', 
                      fontWeight: '700', 
                      color: ((previewData.grandTotal || previewData.total || 0) - (paymentStatus === 'partially_paid' ? (paidAmount || 0) : (previewData.paidAmount || 0))) > 0 ? '#dc3545' : '#28a745'
                    }}>
                      ₹{((previewData.grandTotal || previewData.total || 0) - (paymentStatus === 'partially_paid' ? (paidAmount || 0) : (previewData.paidAmount || 0))).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}

              </div>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <TransactionLoader isLoading={loading.submit || actionInProgress} type="sell" />
      <div className="sell-item">
        <h2>Create New Sale</h2>

        {/* Sticky Header Section - Professional Design */}
        <div className="card sticky-search-section">
          {/* Seller Selection */}
          <div className="form-group">
            <label>Select Seller Party</label>
            {loading.sellerParties && (
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                backgroundColor: '#f8f9fa', 
                borderRadius: '8px', 
                color: '#6c757d', 
                fontSize: '14px',
                minHeight: '200px',
                gap: '12px',
                width: '100%'
              }}>
                <div style={{ 
                  display: 'inline-block',
                  width: '40px',
                  height: '40px',
                  border: '3px solid #e1e8ed',
                  borderTop: '3px solid #3498db',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}></div>
                <span>Loading seller parties...</span>
              </div>
            )}
            {errors.sellerParties && (
              <div style={{ 
                padding: '12px', 
                backgroundColor: '#fff5f5', 
                borderRadius: '8px', 
                color: '#e74c3c', 
                fontSize: '14px',
                border: '1px solid #fecaca'
              }}>
                ⚠️ Error: {errors.sellerParties}
              </div>
            )}
            {!loading.sellerParties && !errors.sellerParties && sellerParties.length === 0 && (
              <div style={{ 
                padding: '12px', 
                backgroundColor: '#fff3cd', 
                borderRadius: '8px', 
                color: '#856404', 
                fontSize: '14px',
                border: '1px solid #ffeaa7'
              }}>
                ℹ️ No seller parties available. Please add seller parties first.
              </div>
            )}
            <div className="search-wrapper">
              <input
                type="text"
                placeholder="👤 Search seller party by name, mobile, or address..."
                value={sellerSearchQuery}
                onChange={(e) => {
                  dispatch(setSellerSearchQuery(e.target.value));
                }}
                onFocus={() => {
                  if (sellerParties.length > 0) {
                    if (sellerSearchQuery) {
                      dispatch(setShowSellerSuggestions(filteredSellerParties.length > 0));
                    } else {
                      dispatch(setShowSellerSuggestions(true));
                    }
                  }
                }}
              />
              {showSellerSuggestions && (sellerSearchQuery ? filteredSellerParties : sellerParties).length > 0 && (
                <div className="suggestions seller-suggestions">
                  {(sellerSearchQuery ? filteredSellerParties : sellerParties).map(party => (
                    <div
                      key={party.id}
                      className="suggestion-item"
                      onClick={() => {
                        dispatch(selectSellerParty(party));
                        // Close suggestions immediately
                        dispatch(setShowSellerSuggestions(false));
                      }}
                      tabIndex={0}
                    >
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px'
                      }}>
                        <span style={{ fontWeight: '600', color: '#2c3e50' }}>{party.party_name}</span>
                        {party.mobile_number && (
                          <span style={{ fontSize: '12px', color: '#6c757d', whiteSpace: 'nowrap' }}>
                            📱 {party.mobile_number}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {sellerSearchQuery && filteredSellerParties.length === 0 && sellerParties.length > 0 && (
                <div className="suggestions seller-suggestions">
                  <div className="suggestion-item" style={{ color: '#6c757d', cursor: 'default' }}>
                    No seller party found
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Seller Info Display */}
          {sellerInfo && (
            <div className="seller-info">
              <div>
                <strong>Name:</strong> 
                <span style={{ color: '#2c3e50', fontWeight: '500' }}>{sellerInfo.party_name}</span>
              </div>
              <div>
                <strong>Mobile:</strong> 
                <span style={{ color: '#495057' }}>{sellerInfo.mobile_number || 'N/A'}</span>
              </div>
              <div>
                <strong>Address:</strong> 
                <span style={{ color: '#495057' }}>{sellerInfo.address || 'N/A'}</span>
              </div>
              {sellerInfo.gst_number && (
                <div>
                  <strong>GST Number:</strong> 
                  <span style={{ color: '#495057' }}>{sellerInfo.gst_number}</span>
                </div>
              )}
              <div>
                <strong>Previous Balance:</strong> 
                <span style={{ 
                  color: parseFloat(sellerInfo.balance_amount || 0) > 0 ? '#e74c3c' : '#27ae60',
                  fontWeight: '600'
                }}>
                  ₹{parseFloat(sellerInfo.balance_amount || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <strong>Total Paid:</strong> 
                <span style={{ color: '#27ae60', fontWeight: '600' }}>
                  ₹{parseFloat(sellerInfo.paid_amount || 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Item Search */}
          <div className="form-group" style={{ marginTop: '25px' }}>
            <label>
              Search & Add Items
              {selectedItems.length > 0 && (
                <span style={{ 
                  color: '#27ae60', 
                  fontSize: '12px', 
                  fontWeight: '600',
                  marginLeft: '10px',
                  backgroundColor: '#d4edda',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  display: 'inline-block'
                }}>
                  {selectedItems.length} in cart
                </span>
              )}
            </label>

            <div className="search-wrapper">
              <input
                type="text"
                placeholder="🔍 Type product name, brand, or HSN to search and add items..."
                value={searchQuery}
                onChange={(e) => {
                  dispatch(setSearchQuery(e.target.value));
                  if (!e.target.value) {
                    setSelectedItemIds(new Set());
                    dispatch(clearSuggestedItems());
                  }
                }}
                onKeyDown={(e) => {
                  // Ctrl+A or Cmd+A to select all available items
                  if ((e.ctrlKey || e.metaKey) && e.key === 'a' && suggestedItems.length > 0) {
                    e.preventDefault();
                    const availableItems = suggestedItems.filter(item => (item.quantity || 0) > 0);
                    if (availableItems.length > 0) {
                      setSelectedItemIds(new Set(availableItems.map(item => item.id)));
                      toast.info(`Selected ${availableItems.length} available item${availableItems.length !== 1 ? 's' : ''}`);
                    }
                  }
                  // Enter to add selected items or select first item
                  else if (e.key === 'Enter' && selectedItemIds.size > 0) {
                    e.preventDefault();
                    handleAddSelectedItems();
                  } else if (e.key === 'Enter' && suggestedItems.length > 0 && selectedItemIds.size === 0) {
                    e.preventDefault();
                    // Select first item instead of adding immediately
                    handleToggleItemSelection(suggestedItems[0].id);
                  } 
                  // Escape to clear selection
                  else if (e.key === 'Escape' && selectedItemIds.size > 0) {
                    e.preventDefault();
                    setSelectedItemIds(new Set());
                    toast.info('Selection cleared');
                  }
                  // ArrowDown to focus first suggestion
                  else if (e.key === 'ArrowDown' && suggestedItems.length > 0) {
                    e.preventDefault();
                    const firstSuggestion = document.querySelector('.suggestion-item');
                    if (firstSuggestion) firstSuggestion.focus();
                  }
                }}
                autoFocus={selectedItems.length === 0}
                ref={(input) => {
                  itemSearchInputRef.current = input;
                  if (input && selectedItems.length === 0) {
                    // Focus without scrolling to prevent jumping to seller section
                    input.focus({ preventScroll: true });
                  }
                }}
              />
              {/* Old dropdown - hidden, modal is used instead */}
              {false && suggestedItems.length > 0 && (
                <>
                <div className="suggestions item-suggestions">
                    {suggestedItems.map((item, index) => {
                      const isOutOfStock = (item.quantity || 0) <= 0;
                      return (
                    <div
                      key={item.id}
                        className={`suggestion-item ${selectedItemIds.has(item.id) ? 'selected' : ''} ${isOutOfStock ? 'out-of-stock' : ''}`}
                        onClick={(e) => {
                          // Disable selection if out of stock
                          if (isOutOfStock) {
                            toast.warning(`⚠️ "${item.product_name}" is out of stock`);
                            return;
                          }
                          // Professional multi-select: clicking row toggles selection
                          // Items are only added via "Add Selected Items" button
                          handleToggleItemSelection(item.id);
                        }}
                        onKeyDown={(e) => {
                          if (isOutOfStock) {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toast.warning(`⚠️ "${item.product_name}" is out of stock`);
                              return;
                            }
                          }
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (!isOutOfStock) {
                              handleToggleItemSelection(item.id);
                            }
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            const next = e.target.nextElementSibling;
                            if (next) next.focus();
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            const prev = e.target.previousElementSibling;
                            if (prev) prev.focus();
                            else {
                              itemSearchInputRef.current?.focus?.({ preventScroll: true });
                            }
                          } else if (e.key === 'Escape') {
                            dispatch(clearSuggestedItems());
                            dispatch(setSearchQuery(''));
                            setSelectedItemIds(new Set());
                            itemSearchInputRef.current?.focus?.({ preventScroll: true });
                          }
                        }}
                        tabIndex={isOutOfStock ? -1 : 0}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                          position: 'relative',
                          opacity: isOutOfStock ? 0.6 : 1
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={selectedItemIds.has(item.id)}
                            disabled={isOutOfStock}
                            onChange={(e) => {
                              if (isOutOfStock) {
                                e.preventDefault();
                                return;
                              }
                              e.stopPropagation();
                              handleToggleItemSelection(item.id);
                            }}
                            onClick={(e) => {
                              if (isOutOfStock) {
                                e.preventDefault();
                                e.stopPropagation();
                                toast.warning(`⚠️ "${item.product_name}" is out of stock`);
                                return;
                              }
                              e.stopPropagation();
                            }}
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                              accentColor: '#3498db',
                              flexShrink: 0,
                              opacity: isOutOfStock ? 0.5 : 1
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontWeight: '600', 
                              color: isOutOfStock ? '#95a5a6' : (selectedItemIds.has(item.id) ? '#2c3e50' : '#2c3e50'), 
                              fontSize: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              {item.product_name}
                              {isOutOfStock && (
                                <span style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  backgroundColor: '#dc3545',
                                  color: 'white',
                                  borderRadius: '4px',
                                  fontWeight: '600'
                                }}>
                                  OUT OF STOCK
                                </span>
                              )}
                              {!isOutOfStock && selectedItemIds.has(item.id) && (
                                <span style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  backgroundColor: '#3498db',
                                  color: 'white',
                                  borderRadius: '4px',
                                  fontWeight: '600'
                                }}>
                                  SELECTED
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                              {item.brand && <span>{item.brand}</span>}
                              {item.hsn_number && <span>HSN: {item.hsn_number}</span>}
                              <span style={{ color: '#27ae60', fontWeight: '600' }}>
                                ₹{parseFloat(item.sale_rate || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div style={{ 
                          marginLeft: '12px',
                          padding: '4px 10px',
                          backgroundColor: isOutOfStock ? '#f8d7da' : (item.quantity > 0 ? '#d4edda' : '#fff3cd'),
                          color: isOutOfStock ? '#721c24' : (item.quantity > 0 ? '#155724' : '#856404'),
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap'
                        }}>
                          {isOutOfStock ? 'Out of Stock' : `${item.quantity || 0} available`}
                        </div>
                    </div>
                  );
                  })}
                  </div>
                  {selectedItemIds.size > 0 && (
                    <div className="multi-select-actions">
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 16px',
                        backgroundColor: '#e3f2fd',
                        borderRadius: '8px',
                        marginBottom: '10px',
                        border: '1px solid #90caf9'
                      }}>
                        <span style={{ 
                          fontSize: '14px', 
                          fontWeight: '600', 
                          color: '#1976d2',
                          flex: 1
                        }}>
                          {selectedItemIds.size} item{selectedItemIds.size !== 1 ? 's' : ''} selected
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={handleAddSelectedItems}
                          className="btn btn-success"
                          disabled={selectedItemIds.size === 0}
                          aria-disabled={selectedItemIds.size === 0}
                          aria-label={`Add ${selectedItemIds.size} selected item${selectedItemIds.size !== 1 ? 's' : ''} to cart`}
                          tabIndex={selectedItemIds.size === 0 ? -1 : 0}
                          style={{ flex: 1 }}
                        >
                          ✓ Add {selectedItemIds.size > 0 ? `${selectedItemIds.size} ` : ''}Selected Item{selectedItemIds.size !== 1 ? 's' : ''}
                        </button>
                        <button
                          onClick={() => {
                            const availableItems = suggestedItems.filter(item => (item.quantity || 0) > 0);
                            setSelectedItemIds(new Set(availableItems.map(item => item.id)));
                          }}
                          className="btn btn-secondary"
                          disabled={suggestedItems.filter(item => (item.quantity || 0) > 0).length === 0}
                          aria-disabled={suggestedItems.filter(item => (item.quantity || 0) > 0).length === 0}
                          aria-label="Select all available items"
                          tabIndex={suggestedItems.filter(item => (item.quantity || 0) > 0).length === 0 ? -1 : 0}
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItemIds(new Set());
                          }}
                          className="btn btn-secondary"
                          disabled={selectedItemIds.size === 0}
                          aria-disabled={selectedItemIds.size === 0}
                          aria-label="Clear all selections"
                          tabIndex={selectedItemIds.size === 0 ? -1 : 0}
                        >
                          Clear
                        </button>
                      </div>
                      <div style={{ 
                        marginTop: '8px', 
                        fontSize: '12px', 
                        color: '#6c757d',
                        fontStyle: 'italic'
                      }}>
                        💡 Tip: Press <kbd style={{ 
                          padding: '2px 6px', 
                          backgroundColor: '#f0f0f0', 
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontFamily: 'monospace'
                        }}>Ctrl+A</kbd> to select all, <kbd style={{ 
                          padding: '2px 6px', 
                          backgroundColor: '#f0f0f0', 
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontFamily: 'monospace'
                        }}>Esc</kbd> to clear, <kbd style={{ 
                          padding: '2px 6px', 
                          backgroundColor: '#f0f0f0', 
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontFamily: 'monospace'
                        }}>Enter</kbd> to add selected
                      </div>
                </div>
              )}
                </>
              )}
              {searchQuery.length >= 2 && suggestedItems.length === 0 && (
                <div className="suggestions item-suggestions">
                  <div className="suggestion-item" style={{ color: '#6c757d', cursor: 'default', textAlign: 'center' }}>
                    No items found. Try a different search term.
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>

        {/* Selected Items Section - Professional Cart Design */}
          {selectedItems.length > 0 && (
          <div className="card">
            <div className="selected-items">
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '20px',
                paddingBottom: '15px',
                borderBottom: '1px solid #e1e8ed'
              }}>
                <h3>Selected Items ({selectedItems.length})</h3>
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear all items from the cart?')) {
                      selectedItems.forEach(item => dispatch(removeItem(item.item_id)));
                      toast.info('All items cleared');
                      setTimeout(() => {
                        itemSearchInputRef.current?.focus?.({ preventScroll: true });
                      }, 100);
                    }
                  }}
                  className="btn btn-danger"
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Clear All
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
              <table className="table">
                  <thead style={{ backgroundColor: '#34495e', color: '#ffffff' }}>
                  <tr>
                      <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '14px 18px', fontWeight: '600', fontSize: '13px' }}>Product Name</th>
                      <th style={{ backgroundColor: '#34495e', color: '#ffffff', textAlign: 'right', padding: '14px 18px', fontWeight: '600', fontSize: '13px' }}>Sale Rate</th>
                      <th style={{ backgroundColor: '#34495e', color: '#ffffff', textAlign: 'center', padding: '14px 18px', fontWeight: '600', fontSize: '13px' }}>Quantity</th>
                      <th style={{ backgroundColor: '#34495e', color: '#ffffff', textAlign: 'right', padding: '14px 18px', fontWeight: '600', fontSize: '13px' }}>Total</th>
                      <th style={{ backgroundColor: '#34495e', color: '#ffffff', textAlign: 'center', padding: '14px 18px', fontWeight: '600', fontSize: '13px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                    {selectedItems.map((item, index) => {
                    const availableQty = item.available_quantity || 0;
                    const quantity = item.quantity === '' ? 0 : parseInt(item.quantity) || 0;
                    const isOverStock = quantity > availableQty;
                      const isNewlyAdded = index === selectedItems.length - 1;
                    return (
                        <tr 
                          key={item.item_id} 
                          className={`${isNewlyAdded ? 'newly-added-item' : ''} ${isOverStock ? 'over-stock-row' : ''}`}
                        >
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '600', color: '#2c3e50' }}>{item.product_name}</span>
                              {isNewlyAdded && (
                                <span style={{
                                  backgroundColor: '#27ae60',
                                  color: 'white',
                                  fontSize: '9px',
                                  padding: '2px 6px',
                                  borderRadius: '10px',
                                  fontWeight: '700'
                                }}>
                                  NEW
                                </span>
                              )}
                            </div>
                            {item.brand && (
                              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                                {item.brand}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '600', color: '#2c3e50' }}>
                            ₹{parseFloat(item.sale_rate || 0).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            step="any"
                            value={item.quantity === '' ? '' : item.quantity}
                            onChange={(e) => handleUpdateQuantity(item.item_id, e.target.value)}
                            onBlur={(e) => {
                              const val = e.target.value;
                              if (val === '' || parseInt(val) <= 0) {
                                handleUpdateQuantity(item.item_id, '1');
                              }
                            }}
                              className={isOverStock ? 'over-stock-input error' : ''}
                            min="1"
                          />
                          {isOverStock && (
                              <div className="stock-warning">
                                Only {availableQty} available
                            </div>
                          )}
                          {!isOverStock && availableQty > 0 && (
                              <div className="stock-info">
                                {availableQty} in stock
                            </div>
                          )}
                        </td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: '#2c3e50', fontSize: '15px' }}>
                            ₹{(parseFloat(item.sale_rate || 0) * parseInt(item.quantity || 0)).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <ActionMenu
                              itemId={item.item_id}
                              itemName={item.product_name}
                              disabled={actionInProgress}
                              actions={[
                                {
                                  label: 'Remove',
                                  icon: '🗑️',
                                  danger: true,
                                  onClick: (id, name) => {
                                    handleRemoveItem(id);
                                    toast.info(`Removed ${name} from cart`);
                                  }
                                }
                              ]}
                            />
                          </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                      <td colSpan="2" style={{ textAlign: 'left', padding: '10px' }}>
                        <button 
                          type="button"
                          onClick={() => {
                            setShowItemSearchModal(true);
                          }} 
                          className="btn btn-secondary" 
                          style={{
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: '600',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            color: '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)',
                            borderRadius: '6px'
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
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '16px' }}>
                        <strong>Cart Total:</strong>
                      </td>
                      <td style={{ fontWeight: '700', fontSize: '18px', color: '#2c3e50' }}>
                        ₹{calculateTotal().toFixed(2)}
                      </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              </div>
              
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
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                  gap: '10px',
                  padding: '10px 16px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e1e8ed',
                  flex: '0 0 auto'
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
                    style={{ 
                      width: '18px', 
                      height: '18px', 
                      cursor: (previewLoading || actionInProgress) ? 'not-allowed' : 'pointer',
                      accentColor: '#3498db'
                    }}
                    />
                  <label style={{ 
                    cursor: (previewLoading || actionInProgress) ? 'not-allowed' : 'pointer',
                    userSelect: 'none',
                    fontWeight: '500',
                    color: '#2c3e50',
                    fontSize: '14px'
                  }}>
                    Include GST
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
                    padding: '12px 28px',
                    fontSize: '15px',
                    fontWeight: '600',
                    flex: '1 1 auto',
                    minWidth: '180px'
                  }}
                >
                  {previewLoading ? (
                    <>
                      <div style={{ 
                        display: 'inline-block',
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderTop: '2px solid #fff',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        marginRight: '8px'
                      }}></div>
                      Calculating...
                    </>
                  ) : (
                    'Preview Bill'
                  )}
                </button>
              </div>
              </div>
            </div>
          )}
      </div>
      {/* Item Search Modal */}
      <ItemSearchModal
        isOpen={showItemSearchModal}
        onClose={handleModalClose}
        items={suggestedItems}
        onItemSelect={handleAddItemToCart}
        searchQuery={searchQuery}
        onSearchChange={(value) => dispatch(setSearchQuery(value))}
        title="Search Items"
        selectedItems={selectedItems}
      />
    </Layout>
  );
};

export default SellItem;
