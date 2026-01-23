import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { useToast } from '../context/ToastContext';
import TransactionLoader from '../components/TransactionLoader';
import ItemSearchModal from '../components/ItemSearchModal';
import ActionMenu from '../components/ActionMenu';
import './ReturnItem.css';

const ReturnItem = () => {
  const toast = useToast();
  const itemSearchInputRef = useRef(null);
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
  const [selectedItemIds, setSelectedItemIds] = useState(new Set()); // For multi-select
  const [showItemSearchModal, setShowItemSearchModal] = useState(false);
  const [returnData, setReturnData] = useState({
    reason: '',
    return_type: 'adjust' // 'cash' or 'adjust'
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningData, setWarningData] = useState(null);
  // Receipt modal state
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [printingReceipt, setPrintingReceipt] = useState(false);

  // Manage body scroll when transaction is processing
  useEffect(() => {
    if (isProcessing) {
      document.body.classList.add('transaction-loading');
    } else {
      document.body.classList.remove('transaction-loading');
    }
    return () => {
      document.body.classList.remove('transaction-loading');
    };
  }, [isProcessing]);

  useEffect(() => {
    fetchSellerParties();
    fetchBuyerParties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchItems();
      // Auto-open modal when user types in the search input (not when button is clicked)
      if (!showItemSearchModal) {
        setShowItemSearchModal(true);
      }
    } else {
      // Clear suggestions when search is cleared
      setSuggestedItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, partyType]); // Include partyType so search includes purchase_rate for buyer returns

  useEffect(() => {
    if (selectedParty && partyType) {
      fetchPartyInfo();
      setShowPartySuggestions(false);
    } else {
      setSelectedPartyInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        params: { 
          q: searchQuery,
          include_purchase_rate: partyType === 'buyer' ? 'true' : undefined // Include purchase_rate for buyer returns
        }
      });
      setSuggestedItems(response.data.items);
    } catch (error) {
      console.error('Error searching items:', error);
      setSuggestedItems([]);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleToggleItemSelection = (itemId) => {
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

  // eslint-disable-next-line no-unused-vars
  const handleAddSelectedItems = async () => {
    if (selectedItemIds.size === 0) {
      toast.warning('Please select at least one item');
      return;
    }

    const itemsToAdd = suggestedItems.filter(item => selectedItemIds.has(item.id));
    let successCount = 0;
    let skippedCount = 0;
    
    // Filter out out-of-stock items for buyer returns
    const validItemsToAdd = itemsToAdd.filter(item => {
      if ((item.quantity || 0) <= 0 && partyType === 'buyer') {
        skippedCount++;
        return false;
      }
      return true;
    });

    if (validItemsToAdd.length === 0) {
      if (skippedCount > 0) {
        toast.warning(`⚠️ All selected items are out of stock`);
      }
      setSelectedItemIds(new Set());
      return;
    }

    // Use search data directly (which already includes purchase_rate for buyer returns)
    // No need for additional API call since search API returns complete data
    setSelectedItems(prev => {
      const updatedItems = [...prev];
      validItemsToAdd.forEach(item => {
        // Check if item already exists in cart
        const existingItemIndex = updatedItems.findIndex(i => i.item_id === item.id);
        if (existingItemIndex >= 0) {
          // Increment quantity if item already in cart
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: (updatedItems[existingItemIndex].quantity || 1) + 1
          };
        } else {
          // Add new item to cart using search data (which includes purchase_rate for buyer returns)
          updatedItems.push({
            item_id: item.id,
            product_name: item.product_name,
            product_code: item.product_code || '',
            brand: item.brand || '',
            sale_rate: parseFloat(item.sale_rate || 0),
            purchase_rate: parseFloat(item.purchase_rate || 0), // Already included in search for buyer returns
            quantity: 1,
            available_quantity: parseInt(item.quantity) || 0,
            discount: 0,
            discount_type: 'percentage',
            discount_percentage: null
          });
        }
        successCount++;
      });
      return updatedItems;
    });
    
    if (successCount > 0) {
      toast.success(`✓ Added ${successCount} item${successCount !== 1 ? 's' : ''} to return list`);
    }
    if (skippedCount > 0) {
      toast.warning(`⚠️ Skipped ${skippedCount} item${skippedCount !== 1 ? 's' : ''} (out of stock or error)`);
    }
    
    setSelectedItemIds(new Set());
    setSearchQuery('');
    setSuggestedItems([]);
  };

  const handleModalClose = () => {
    setShowItemSearchModal(false);
    setSearchQuery('');
    setSuggestedItems([]);
  };

  const addItemToCart = async (item) => {
    // For buyer returns, prevent adding out-of-stock items
    // For seller returns, allow out-of-stock items (seller is giving them back)
    if ((item.quantity || 0) <= 0 && partyType === 'buyer') {
      toast.warning(`⚠️ "${item.product_name || item.item_name}" is out of stock and cannot be added`);
      return;
    }

    // Use search data directly (which already includes purchase_rate for buyer returns)
    // No need for additional API call since search API returns complete data
    const existingItem = selectedItems.find(i => i.item_id === item.id);
    if (existingItem) {
      // Increment quantity if item already in cart
      setSelectedItems(prev => prev.map(i =>
        i.item_id === item.id ? { ...i, quantity: (i.quantity || 1) + 1 } : i
      ));
    } else {
      // Add new item to cart using search data (which includes purchase_rate for buyer returns)
      setSelectedItems(prev => [...prev, {
        item_id: item.id,
        product_name: item.product_name,
        product_code: item.product_code || '',
        brand: item.brand || '',
        sale_rate: parseFloat(item.sale_rate || 0),
        purchase_rate: parseFloat(item.purchase_rate || 0), // Already included in search for buyer returns
        quantity: 1,
        available_quantity: parseInt(item.quantity) || 0,
        discount: 0,
        discount_type: 'percentage',
        discount_percentage: null
      }]);
    }
    
    // Don't clear search or close modal - allow adding multiple items
    // Keep UX smooth: no toast spam on every item add
    setShowPreview(false);
    setPreviewData(null);
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
      const rate = partyType === 'buyer'
        ? (parseFloat(item.purchase_rate) || 0)
        : (parseFloat(item.sale_rate) || 0);
      const quantity = parseInt(item.quantity) || 0;
      const itemTotal = rate * quantity;
      
      // Calculate discount
      let itemDiscount = 0;
      if (item.discount_type === 'percentage' && item.discount_percentage !== null && item.discount_percentage !== undefined) {
        itemDiscount = (itemTotal * item.discount_percentage) / 100;
      } else {
        itemDiscount = parseFloat(item.discount || 0);
      }
      itemDiscount = Math.min(itemDiscount, itemTotal);
      
      return sum + (itemTotal - itemDiscount);
    }, 0);
  };

  const updateItemDiscount = (itemId, discount, discountType, discountPercentage) => {
    setSelectedItems(selectedItems.map(item =>
      item.item_id === itemId 
        ? { 
            ...item, 
            discount: discount !== undefined ? discount : item.discount,
            discount_type: discountType !== undefined ? discountType : item.discount_type,
            discount_percentage: discountPercentage !== undefined ? discountPercentage : item.discount_percentage
          }
        : item
    ));
    setShowPreview(false);
    setPreviewData(null);
  };

  const getValidItemsCount = () => {
    return selectedItems.filter(item => item.quantity > 0).length;
  };

  const handlePreview = () => {
    if (isProcessing) return;
    
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

    // Validate stock availability for buyer returns only
    // For seller returns, out-of-stock items are allowed (seller is giving them back)
    for (const item of validItems) {
      // For buyer returns, check if stock is available
      // For seller returns, no stock check needed (seller is returning items to us)
      if (partyType === 'buyer' && item.quantity > item.available_quantity) {
        toast.error(`Insufficient stock for ${item.product_name}. Available: ${item.available_quantity}, Requested: ${item.quantity}`);
        return;
      }
    }
    const totalAmount = validItems.reduce((sum, item) => {
      const rate = partyType === 'buyer'
        ? (parseFloat(item.purchase_rate) || 0)
        : (parseFloat(item.sale_rate) || 0);
      const quantity = parseInt(item.quantity) || 0;
      const itemTotal = rate * quantity;
      
      // Calculate discount
      let itemDiscount = 0;
      if (item.discount_type === 'percentage' && item.discount_percentage !== null && item.discount_percentage !== undefined) {
        itemDiscount = (itemTotal * item.discount_percentage) / 100;
      } else {
        itemDiscount = parseFloat(item.discount || 0);
      }
      itemDiscount = Math.min(itemDiscount, itemTotal);
      
      return sum + (itemTotal - itemDiscount);
    }, 0);
    
    const items = validItems.map(item => {
      const rate = partyType === 'buyer'
        ? (parseFloat(item.purchase_rate) || 0)
        : (parseFloat(item.sale_rate) || 0);
      const quantity = parseInt(item.quantity || 0);
      const itemTotal = rate * quantity;
      
      // Calculate discount
      let itemDiscount = 0;
      if (item.discount_type === 'percentage' && item.discount_percentage !== null && item.discount_percentage !== undefined) {
        itemDiscount = (itemTotal * item.discount_percentage) / 100;
      } else {
        itemDiscount = parseFloat(item.discount || 0);
      }
      itemDiscount = Math.min(itemDiscount, itemTotal);
      const returnAmount = itemTotal - itemDiscount;
      
      return {
        item_id: item.item_id,
        product_name: item.product_name,
        brand: item.brand,
        product_code: item.product_code,
        sale_rate: parseFloat(item.sale_rate) || 0,
        purchase_rate: parseFloat(item.purchase_rate) || 0,
        quantity: parseInt(item.quantity) || 0,
        return_amount: returnAmount,
        discount: itemDiscount,
        discount_type: item.discount_type || 'amount',
        discount_percentage: item.discount_percentage || null,
        available_quantity: item.available_quantity
      };
    });

    // Check if return amount exceeds balance for seller/buyer returns with adjust type
    let warningInfo = null;
    if (returnData.return_type === 'adjust' && selectedPartyInfo?.balance_amount !== undefined) {
      const currentBalance = parseFloat(selectedPartyInfo.balance_amount || 0);
      if (totalAmount > currentBalance) {
        const adjustmentAmount = currentBalance;
        const cashPaymentRequired = totalAmount - currentBalance;
        
        if (partyType === 'seller') {
          warningInfo = {
            requires_cash_payment: true,
            return_amount: totalAmount,
            current_balance: currentBalance,
            adjustment_amount: adjustmentAmount,
            cash_payment_required: cashPaymentRequired,
            message: `Return amount (₹${totalAmount.toFixed(2)}) exceeds current balance (₹${currentBalance.toFixed(2)}). You need to pay ₹${cashPaymentRequired.toFixed(2)} in cash to the seller, and ₹${adjustmentAmount.toFixed(2)} will be adjusted in the account.`
          };
        } else if (partyType === 'buyer') {
          warningInfo = {
            requires_cash_payment: true,
            return_amount: totalAmount,
            current_balance: currentBalance,
            adjustment_amount: adjustmentAmount,
            cash_payment_required: cashPaymentRequired,
            message: `Return amount (₹${totalAmount.toFixed(2)}) exceeds current balance (₹${currentBalance.toFixed(2)}). You need to take ₹${cashPaymentRequired.toFixed(2)} in cash from the buyer, and ₹${adjustmentAmount.toFixed(2)} will be adjusted in the account.`
          };
        }
      }
    }

    const preview = {
      partyType,
      partyName: selectedPartyInfo?.party_name || '',
      partyInfo: selectedPartyInfo,
      items: items,
      reason: returnData.reason,
      returnType: returnData.return_type,
      totalAmount: totalAmount,
      warning: warningInfo
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
    if (isProcessing) return;
    
    if (!showPreview || !previewData) {
      toast.error('Please preview the return before submitting');
      return;
    }

    // Check if warning is needed and show confirmation modal
    if (previewData.warning && previewData.warning.requires_cash_payment) {
      setWarningData(previewData.warning);
      setShowWarningModal(true);
      return;
    }

    await processReturn();
  };

  const handleConfirmReturn = async () => {
    setShowWarningModal(false);
    await processReturn();
  };

  const processReturn = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const requestData = {
        items: previewData.items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          return_amount: item.return_amount,
          discount: item.discount || 0,
          discount_type: item.discount_type || 'amount',
          discount_percentage: item.discount_percentage || null
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

      const response = await apiClient.post(config.api.return, requestData);
      
      // Check if API returned a warning (should match our preview warning)
      if (response.data.warning && response.data.warning.requires_cash_payment) {
        toast.warning(response.data.warning.message);
      } else {
        toast.success('Return processed successfully!');
      }
      
      // Show receipt modal for seller returns
      if (response.data.return_transaction_id && response.data.bill_number && partyType === 'seller') {
        setReceiptData({
          transactionId: response.data.return_transaction_id,
          billNumber: response.data.bill_number,
          partyType: partyType,
          partyName: selectedPartyInfo?.party_name || 'Seller',
          returnAmount: previewData?.total || 0,
          reason: returnData.reason,
          returnType: returnData.return_type,
          date: new Date().toLocaleDateString()
        });
        setShowReceiptModal(true);
      } else if (response.data.return_transaction_id && response.data.bill_number && partyType === 'buyer') {
        // For buyer returns, auto-download (existing behavior)
        try {
          const pdfResponse = await apiClient.get(
            `/api/bills/return/${response.data.return_transaction_id}/pdf?party_type=${partyType}`,
            { responseType: 'blob' }
          );
          
          const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `return_bill_${response.data.bill_number}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          toast.success('Return bill downloaded!');
        } catch (pdfError) {
          console.error('Error downloading return bill:', pdfError);
          toast.error('Return processed but failed to download bill');
        }
      }
      
      // Reset form
      setSelectedItems([]);
      setSelectedParty('');
      setSelectedPartyInfo(null);
      setPartySearchQuery('');
      setShowPartySuggestions(false);
      setReturnData({
        reason: '',
        return_type: 'adjust'
      });
      setSearchQuery('');
      setShowPreview(false);
      setPreviewData(null);
      setShowItemSearchModal(false); // Close item search modal
    } catch (error) {
      toast.error('Error: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!receiptData || downloadingReceipt) return;
    
    setDownloadingReceipt(true);
    try {
      const pdfResponse = await apiClient.get(
        `/api/bills/return/${receiptData.transactionId}/receipt?party_type=${receiptData.partyType}`,
        { responseType: 'blob' }
      );
      
      const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `return_receipt_${receiptData.billNumber || receiptData.transactionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Receipt downloaded successfully!');
    } catch (error) {
      console.error('Error downloading receipt:', error);
      toast.error('Failed to download receipt: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setDownloadingReceipt(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!receiptData || printingReceipt) return;
    
    setPrintingReceipt(true);
    try {
      const pdfResponse = await apiClient.get(
        `/api/bills/return/${receiptData.transactionId}/receipt?party_type=${receiptData.partyType}`,
        { responseType: 'blob' }
      );
      
      const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      } else {
        // Fallback: create iframe for printing
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          iframe.contentWindow.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            window.URL.revokeObjectURL(url);
          }, 1000);
        };
      }
      
      toast.success('Receipt opened for printing!');
    } catch (error) {
      console.error('Error printing receipt:', error);
      toast.error('Failed to print receipt: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setPrintingReceipt(false);
    }
  };

  return (
    <Layout>
      <TransactionLoader isLoading={isProcessing} type="return" />
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
                  Return to Buyer
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
                  placeholder="🔍 Type product name, brand, or HSN to search and add items..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!e.target.value) {
                      setSelectedItemIds(new Set());
                    }
                  }}
                  onKeyDown={(e) => {
                    // Ctrl+A or Cmd+A to select all available items
                    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && suggestedItems.length > 0) {
                      e.preventDefault();
                      // For seller returns, allow selecting all items (including out-of-stock)
                      // For buyer returns, only select items with stock
                      const availableItems = partyType === 'seller' 
                        ? suggestedItems 
                        : suggestedItems.filter(item => (item.quantity || 0) > 0);
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
                  disabled={showPreview}
                  ref={itemSearchInputRef}
                />
                {suggestedItems.length > 0 && !showPreview && (
                  <>
                    <div className="suggestions">
                      {suggestedItems.map((item, index) => {
                        const isOutOfStock = (item.quantity || 0) <= 0;
                        return (
                          <div
                            key={item.id}
                            className={`suggestion-item ${selectedItemIds.has(item.id) ? 'selected' : ''} ${isOutOfStock ? 'out-of-stock' : ''}`}
                            onClick={(e) => {
                              // For buyer returns, disable selection if out of stock
                              // For seller returns, allow out-of-stock items (seller is giving them back)
                              if (isOutOfStock && partyType === 'buyer') {
                                toast.warning(`⚠️ "${item.product_name}" is out of stock`);
                                return;
                              }
                              // Professional multi-select: clicking row toggles selection
                              handleToggleItemSelection(item.id);
                            }}
                            onKeyDown={(e) => {
                              // For buyer returns, prevent selection if out of stock
                              // For seller returns, allow out-of-stock items
                              if (isOutOfStock && partyType === 'buyer') {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toast.warning(`⚠️ "${item.product_name}" is out of stock`);
                                  return;
                                }
                              }
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (!isOutOfStock || partyType === 'seller') {
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
                                setSearchQuery('');
                                setSuggestedItems([]);
                                setSelectedItemIds(new Set());
                                itemSearchInputRef.current?.focus?.({ preventScroll: true });
                              }
                            }}
                            tabIndex={(isOutOfStock && partyType === 'buyer') ? -1 : 0}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: (isOutOfStock && partyType === 'buyer') ? 'not-allowed' : 'pointer',
                              position: 'relative',
                              opacity: (isOutOfStock && partyType === 'buyer') ? 0.6 : 1
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                              <input
                                type="checkbox"
                                checked={selectedItemIds.has(item.id)}
                                disabled={isOutOfStock && partyType === 'buyer'}
                                onChange={(e) => {
                                  if (isOutOfStock && partyType === 'buyer') {
                                    e.preventDefault();
                                    return;
                                  }
                                  e.stopPropagation();
                                  handleToggleItemSelection(item.id);
                                }}
                                onClick={(e) => {
                                  if (isOutOfStock && partyType === 'buyer') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return;
                                  }
                                  e.stopPropagation();
                                }}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  cursor: (isOutOfStock && partyType === 'buyer') ? 'not-allowed' : 'pointer',
                                  accentColor: '#3498db',
                                  flexShrink: 0,
                                  opacity: (isOutOfStock && partyType === 'buyer') ? 0.5 : 1
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
                                  {isOutOfStock && partyType === 'buyer' && (
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
                                  {isOutOfStock && partyType === 'seller' && (
                                    <span style={{
                                      fontSize: '10px',
                                      padding: '2px 6px',
                                      backgroundColor: '#ffc107',
                                      color: '#856404',
                                      borderRadius: '4px',
                                      fontWeight: '600'
                                    }}>
                                      OUT OF STOCK (Can Return)
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
                                    ₹{parseFloat(item.sale_rate || item.purchase_rate || 0).toFixed(2)}
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
                      <div style={{
                        marginTop: '10px',
                        padding: '12px 16px',
                        backgroundColor: '#e3f2fd',
                        borderRadius: '8px',
                        border: '1px solid #90caf9'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ 
                            fontSize: '14px', 
                            fontWeight: '600', 
                            color: '#1976d2',
                            flex: 1
                          }}>
                            {selectedItemIds.size} item{selectedItemIds.size !== 1 ? 's' : ''} selected
                          </span>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              onClick={handleAddSelectedItems}
                              className="btn btn-success"
                              disabled={selectedItemIds.size === 0}
                              aria-disabled={selectedItemIds.size === 0}
                              aria-label={`Add ${selectedItemIds.size} selected item${selectedItemIds.size !== 1 ? 's' : ''} to return list`}
                              tabIndex={selectedItemIds.size === 0 ? -1 : 0}
                              style={{ padding: '8px 16px', fontSize: '13px' }}
                            >
                              ✓ Add {selectedItemIds.size > 0 ? `${selectedItemIds.size} ` : ''}Selected
                            </button>
                            <button
                              onClick={() => {
                                // For seller returns, allow selecting all items (including out-of-stock)
                                // For buyer returns, only select items with stock
                                const selectableItems = partyType === 'seller' 
                                  ? suggestedItems 
                                  : suggestedItems.filter(i => (i.quantity || 0) > 0);
                                setSelectedItemIds(new Set(selectableItems.map(i => i.id)));
                              }}
                              className="btn btn-secondary"
                              disabled={suggestedItems.length === 0}
                              aria-disabled={suggestedItems.length === 0}
                              aria-label="Select all available items"
                              tabIndex={suggestedItems.length === 0 ? -1 : 0}
                              style={{ padding: '8px 16px', fontSize: '13px' }}
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
                              style={{ padding: '8px 16px', fontSize: '13px' }}
                            >
                              Clear
                            </button>
                          </div>
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
              </div>
            </div>

            {selectedItems.length > 0 && !showPreview && (
              <div style={{ marginTop: '20px' }}>
                <h3>Items to Return</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ marginTop: '10px' }}>
                    <thead style={{ backgroundColor: '#34495e', color: 'white' }}>
                      <tr>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>S.No</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>Product Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>Brand</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>Available Qty</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>
                          {partyType === 'buyer' ? 'Purchase Rate' : 'Sale Rate'}
                        </th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>Return Qty</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>Discount</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>Return Amount</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>Action</th>
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
                          <td>
                            ₹{(partyType === 'buyer'
                              ? parseFloat(item.purchase_rate || 0)
                              : parseFloat(item.sale_rate || 0)
                            ).toFixed(2)}
                          </td>
                          <td>
                            <input
                              type="number"
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                // Only allow digits and empty string
                                // Block mathematical signs: +, -, *, /, e, E, decimal point
                                if (val !== '' && !/^\d+$/.test(val)) return;
                                updateItemQuantity(item.item_id, val);
                              }}
                              onKeyDown={(e) => {
                                // Block mathematical signs, 'e', 'E', and decimal point
                                if (['+', '-', '*', '/', 'e', 'E', '.', ','].includes(e.key)) {
                                  e.preventDefault();
                                }
                              }}
                              min="0"
                              max={partyType === 'buyer' ? item.available_quantity : undefined}
                              title={partyType === 'seller' && item.available_quantity === 0 
                                ? 'Out of stock item - seller is returning this to you' 
                                : partyType === 'buyer' 
                                  ? `Maximum: ${item.available_quantity}` 
                                  : 'Enter return quantity'}
                              style={{ 
                                width: '80px', 
                                padding: '5px',
                                borderColor: item.quantity === 0 ? '#ffc107' : undefined,
                                backgroundColor: item.quantity === 0 ? '#fff3cd' : undefined
                              }}
                            />
                          </td>
                          <td>
                            {item.quantity > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <select
                                  value={item.discount_type || 'percentage'}
                                  onChange={(e) => {
                                    const newDiscountType = e.target.value;
                                    updateItemDiscount(item.item_id, 
                                      newDiscountType === 'amount' ? (item.discount || 0) : 0,
                                      newDiscountType,
                                      newDiscountType === 'percentage' ? (item.discount_percentage || null) : null
                                    );
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
                                  value={item.discount_type === 'percentage' 
                                    ? (item.discount_percentage !== null && item.discount_percentage !== undefined ? item.discount_percentage : '')
                                    : (item.discount && item.discount !== 0 ? item.discount : '')}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    // Only allow digits, decimal point, and empty string
                                    // Block mathematical signs: +, -, *, /, e, E
                                    if (val !== '' && !/^[\d.]*$/.test(val)) return;
                                    // Prevent multiple decimal points
                                    if ((val.match(/\./g) || []).length > 1) return;
                                    
                                    if (item.discount_type === 'percentage') {
                                      // Allow empty string (user can delete 0)
                                      const numVal = val === '' ? null : (val === '.' ? null : (isNaN(parseFloat(val)) ? null : parseFloat(val)));
                                      if (numVal !== null && numVal > 100) return;
                                      updateItemDiscount(item.item_id, undefined, undefined, numVal);
                                    } else {
                                      // Allow empty string (user can delete 0)
                                      const numVal = val === '' ? null : (val === '.' ? null : (isNaN(parseFloat(val)) ? null : parseFloat(val)));
                                      if (numVal !== null) {
                                        const itemTotal = (partyType === 'buyer'
                                          ? parseFloat(item.purchase_rate || 0)
                                          : parseFloat(item.sale_rate || 0)
                                        ) * parseInt(item.quantity || 0);
                                        if (numVal > itemTotal) return;
                                      }
                                      updateItemDiscount(item.item_id, numVal !== null ? numVal : 0);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    // Block mathematical signs and 'e', 'E'
                                    if (['+', '-', '*', '/', 'e', 'E'].includes(e.key)) {
                                      e.preventDefault();
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value;
                                    if (item.discount_type === 'percentage') {
                                      // If empty on blur, set to null (will show as empty)
                                      const newDiscountPct = val === '' ? null : (isNaN(parseFloat(val)) ? null : parseFloat(val));
                                      updateItemDiscount(item.item_id, undefined, undefined, newDiscountPct);
                                    } else {
                                      // If empty on blur, set to 0
                                      const newDiscount = val === '' ? 0 : (isNaN(parseFloat(val)) ? 0 : parseFloat(val));
                                      updateItemDiscount(item.item_id, newDiscount);
                                    }
                                  }}
                                  style={{ width: '100px', fontSize: '12px' }}
                                  placeholder={item.discount_type === 'percentage' ? '%' : '₹'}
                                />
                              </div>
                            ) : (
                              <span style={{ color: '#999' }}>-</span>
                            )}
                          </td>
                          <td>
                            {item.quantity > 0 ? (() => {
                              const rate = partyType === 'buyer'
                                ? (parseFloat(item.purchase_rate || 0))
                                : (parseFloat(item.sale_rate || 0));
                              const quantity = parseInt(item.quantity || 0);
                              const itemTotal = rate * quantity;
                              
                              let itemDiscount = 0;
                              if (item.discount_type === 'percentage' && item.discount_percentage !== null && item.discount_percentage !== undefined) {
                                itemDiscount = (itemTotal * item.discount_percentage) / 100;
                              } else {
                                itemDiscount = parseFloat(item.discount || 0);
                              }
                              itemDiscount = Math.min(itemDiscount, itemTotal);
                              const returnAmount = itemTotal - itemDiscount;
                              
                              return (
                                <div>
                                  <div>₹{returnAmount.toFixed(2)}</div>
                                  {itemDiscount > 0 && (
                                    <small style={{ color: '#28a745', fontSize: '10px' }}>
                                      -₹{itemDiscount.toFixed(2)}
                                    </small>
                                  )}
                                </div>
                              );
                            })() : (
                              <span style={{ color: '#999' }}>₹0.00</span>
                            )}
                          </td>
                          <td>
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
                    <tfoot>
                      <tr>
                        <td colSpan="2" style={{ textAlign: 'left', padding: '10px' }}>
                          <button 
                            type="button"
                            onClick={() => {
                              // Clear any previous search and open modal
                              setSearchQuery('');
                              setSuggestedItems([]);
                              setSelectedItemIds(new Set());
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
                        <td colSpan="5" style={{ textAlign: 'right', fontWeight: 'bold' }}>
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
                          value="adjust"
                          checked={returnData.return_type === 'adjust'}
                          onChange={(e) => setReturnData({ ...returnData, return_type: e.target.value })}
                        />
                        Adjust in Account
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          value="cash"
                          checked={returnData.return_type === 'cash'}
                          onChange={(e) => setReturnData({ ...returnData, return_type: e.target.value })}
                        />
                        Return Cash
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
                
                {/* Preview Return Button at Last */}
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={handlePreview}
                    disabled={isProcessing}
                    style={{
                      padding: '12px 28px',
                      fontSize: '15px',
                      fontWeight: '600',
                      minWidth: '180px',
                      opacity: isProcessing ? 0.6 : 1,
                      cursor: isProcessing ? 'not-allowed' : 'pointer'
                    }}
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
                        <tr style={{ backgroundColor: '#34495e', color: 'white', borderBottom: '2px solid #dee2e6' }}>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>S.No</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>Product Name</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>Brand</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>Quantity</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>Sale Rate</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>Discount</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: 'white', backgroundColor: '#34495e' }}>Amount</th>
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
                            <td style={{ padding: '10px', textAlign: 'right' }}>
                              {item.discount > 0 ? (
                                <span style={{ color: '#28a745' }}>-₹{parseFloat(item.discount || 0).toFixed(2)}</span>
                              ) : (
                                <span>-</span>
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>₹{parseFloat(item.return_amount || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: '#f8f9fa', borderTop: '2px solid #dee2e6', fontWeight: 'bold' }}>
                          <td colSpan="6" style={{ padding: '10px', textAlign: 'right' }}>Total Return Amount</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            ₹{parseFloat(previewData.totalAmount || 0).toFixed(2)}
                          </td>
                        </tr>
                        {previewData.reason && (
                          <tr>
                            <td colSpan="7" style={{ padding: '10px' }}>
                              <strong>Reason:</strong> {previewData.reason}
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td colSpan="7" style={{ padding: '10px', fontSize: '12px', color: '#666' }}>
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

                <div style={{ 
                  display: 'flex', 
                  gap: '10px', 
                  marginTop: '20px',
                  marginBottom: '20px',
                  paddingBottom: '20px',
                  position: 'sticky',
                  bottom: 0,
                  backgroundColor: '#f8f9fa',
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px solid #dee2e6',
                  zIndex: 10
                }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={handleBackToEdit}
                    disabled={isProcessing}
                    aria-disabled={isProcessing}
                    aria-label="Go back to edit return items"
                    tabIndex={isProcessing ? -1 : 0}
                    style={{
                      opacity: isProcessing ? 0.6 : 1,
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      flex: '1 1 auto',
                      minWidth: '150px'
                    }}
                  >
                    Back to Edit
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={isProcessing}
                    aria-disabled={isProcessing}
                    aria-label={isProcessing ? 'Processing return transaction' : 'Confirm and process return'}
                    tabIndex={isProcessing ? -1 : 0}
                    style={{
                      opacity: isProcessing ? 0.6 : 1,
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      flex: '1 1 auto',
                      minWidth: '150px'
                    }}
                  >
                    {isProcessing ? 'Processing...' : 'Confirm Return'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Warning Confirmation Modal */}
      {showWarningModal && warningData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '90%',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ color: '#856404', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              {partyType === 'buyer' ? 'Return to Buyer' : 'Warning: Return Amount Exceeds Balance'}
            </h3>
            <div style={{ marginBottom: '20px', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '15px', fontSize: '16px', color: '#333' }}>
                {warningData.message}
              </p>
              <div style={{ 
                backgroundColor: '#fff3cd', 
                padding: '15px', 
                borderRadius: '6px', 
                border: '1px solid #ffc107',
                marginBottom: '15px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <strong>Return Amount:</strong>
                    <div style={{ fontSize: '18px', color: '#333' }}>₹{parseFloat(warningData.return_amount || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <strong>Current Balance:</strong>
                    <div style={{ fontSize: '18px', color: '#333' }}>₹{parseFloat(warningData.current_balance || 0).toFixed(2)}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <strong style={{ color: '#dc3545' }}>
                      {partyType === 'buyer' ? 'Cash to Receive from Buyer:' : 'Cash Payment Required:'}
                    </strong>
                    <div style={{ fontSize: '20px', color: '#dc3545', fontWeight: 'bold' }}>
                      ₹{parseFloat(warningData.cash_payment_required || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <strong style={{ color: '#28a745' }}>Amount to Adjust:</strong>
                    <div style={{ fontSize: '20px', color: '#28a745', fontWeight: 'bold' }}>
                      ₹{parseFloat(warningData.adjustment_amount || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
              <p style={{ color: '#666', fontSize: '14px', fontStyle: 'italic' }}>
                {partyType === 'buyer' 
                  ? 'Please ensure you are ready to receive the cash from the buyer before confirming this return.'
                  : 'Please ensure you have the cash ready to pay to the seller before confirming this return.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowWarningModal(false);
                  setWarningData(null);
                }}
                disabled={isProcessing}
                style={{
                  padding: '10px 20px',
                  opacity: isProcessing ? 0.6 : 1,
                  cursor: isProcessing ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmReturn}
                disabled={isProcessing}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#ffc107',
                  borderColor: '#ffc107',
                  color: '#856404',
                  opacity: isProcessing ? 0.6 : 1,
                  cursor: isProcessing ? 'not-allowed' : 'pointer'
                }}
              >
                {isProcessing ? 'Processing...' : 'Confirm & Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Receipt Modal - For Seller Returns */}
      {showReceiptModal && receiptData && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowReceiptModal(false);
            setReceiptData(null);
          }
        }}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Return Receipt</h3>
              <button className="modal-close" onClick={() => {
                setShowReceiptModal(false);
                setReceiptData(null);
              }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '20px' }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>Return Processed Successfully!</h4>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <strong>Bill Number:</strong><br />
                    {receiptData.billNumber}
                  </div>
                  <div>
                    <strong>Date:</strong><br />
                    {receiptData.date}
                  </div>
                  <div>
                    <strong>Party Name:</strong><br />
                    {receiptData.partyName}
                  </div>
                  <div>
                    <strong>Return Type:</strong><br />
                    {receiptData.returnType === 'cash' ? 'Cash' : 'Adjust'}
                  </div>
                  {receiptData.reason && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <strong>Reason:</strong><br />
                      {receiptData.reason}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setReceiptData(null);
                }}
                className="btn btn-secondary"
                disabled={downloadingReceipt || printingReceipt}
              >
                Close
              </button>
              <button
                onClick={handleDownloadReceipt}
                className="btn btn-primary"
                disabled={downloadingReceipt || printingReceipt}
              >
                {downloadingReceipt ? 'Downloading...' : '📥 Download Receipt'}
              </button>
              <button
                onClick={handlePrintReceipt}
                className="btn btn-success"
                disabled={downloadingReceipt || printingReceipt}
              >
                {printingReceipt ? 'Opening...' : '🖨️ Print Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Search Modal */}
      <ItemSearchModal
        isOpen={showItemSearchModal}
        onClose={handleModalClose}
        items={suggestedItems}
        onItemSelect={addItemToCart}
        onItemDeselect={removeItem}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        title="Search Items for Return"
        selectedItems={selectedItems}
        allowOutOfStock={partyType === 'seller'} // Allow out-of-stock items for seller returns
      />
    </Layout>
  );
};

export default ReturnItem;
