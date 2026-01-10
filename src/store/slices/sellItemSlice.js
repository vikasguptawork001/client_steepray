import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../config/axios';
import config from '../../config/config';

// Async thunks for API calls
export const fetchSellerParties = createAsyncThunk(
  'sellItem/fetchSellerParties',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(config.api.sellers);
      return response.data.parties || response.data.sellers || [];
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch seller parties');
    }
  }
);

export const fetchSellerInfo = createAsyncThunk(
  'sellItem/fetchSellerInfo',
  async (sellerId, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`${config.api.sellers}/${sellerId}`);
      return response.data.party || response.data.seller;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch seller info');
    }
  }
);

export const searchItems = createAsyncThunk(
  'sellItem/searchItems',
  async (query, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`${config.api.itemsSearch}?q=${encodeURIComponent(query)}`);
      return response.data.items || [];
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to search items');
    }
  }
);

export const calculatePreview = createAsyncThunk(
  'sellItem/calculatePreview',
  async ({ selectedItems, sellerInfo, withGst, payPreviousBalance, previousBalancePaid, paymentStatus, paidAmount }, { rejectWithValue }) => {
    // Automatically include previous balance if seller has balance
    const previousBalance = parseFloat(sellerInfo?.balance_amount || 0);
    const effectivePayPreviousBalance = previousBalance > 0;
    const effectivePreviousBalancePaid = previousBalance > 0 ? previousBalance : 0;
    try {
      // Fetch latest stock info for all items
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

      // Fetch tax_rate and hsn_number for items that don't have it
      const itemsWithTax = await Promise.all(itemsWithStock.map(async (item) => {
        if (!item.tax_rate || !item.hsn_number) {
          try {
            const response = await apiClient.get(`${config.api.items}/${item.item_id}`);
            return { 
              ...item, 
              tax_rate: item.tax_rate || response.data.item.tax_rate || 0,
              hsn_number: item.hsn_number || response.data.item.hsn_number || ''
            };
          } catch (error) {
            return { 
              ...item, 
              tax_rate: item.tax_rate || 0,
              hsn_number: item.hsn_number || ''
            };
          }
        }
        return item;
      }));
      
      // Calculate amounts
      let subtotal = 0;
      let totalTaxableValue = 0;
      let totalTax = 0;
      
      const itemsWithGstCalc = itemsWithTax.map(item => {
        const saleRate = parseFloat(item.sale_rate) || 0;
        const quantity = parseInt(item.quantity) || 0;
        const taxRate = parseFloat(item.tax_rate) || 0;
        const itemTotal = saleRate * quantity;
        
        // Calculate item-wise discount (matching backend logic exactly)
        let itemDiscount = 0;
        const itemDiscountType = item.discount_type || 'amount';
        if (itemDiscountType === 'percentage' && item.discount_percentage !== null && item.discount_percentage !== undefined) {
          itemDiscount = (itemTotal * item.discount_percentage) / 100;
        } else {
          itemDiscount = parseFloat(item.discount || 0);
        }
        
        // Ensure discount doesn't exceed item total
        itemDiscount = Math.min(itemDiscount, itemTotal);
        
        const itemTotalAfterDiscount = itemTotal - itemDiscount;
        const effectiveRate = quantity > 0 ? itemTotalAfterDiscount / quantity : saleRate;
        
        let taxableValue = itemTotalAfterDiscount;
        let taxAmount = 0;
        
        if (withGst && taxRate > 0) {
          taxableValue = itemTotalAfterDiscount / (1 + taxRate / 100);
          taxAmount = itemTotalAfterDiscount - taxableValue;
        }
        
        return {
          ...item,
          itemTotal,
          itemDiscount,
          itemTotalAfterDiscount,
          effectiveRate,
          taxableValue,
          taxAmount,
          tax_rate: taxRate,
          hsn_number: item.hsn_number || ''
        };
      });
      
      if (withGst) {
        totalTaxableValue = itemsWithGstCalc.reduce((sum, item) => sum + item.taxableValue, 0);
        totalTax = itemsWithGstCalc.reduce((sum, item) => sum + item.taxAmount, 0);
        subtotal = totalTaxableValue; // Subtotal is taxable value for GST
      } else {
        subtotal = itemsWithGstCalc.reduce((sum, item) => sum + item.itemTotalAfterDiscount, 0);
        totalTaxableValue = subtotal;
      }
      
      // Calculate final total (matching backend logic)
      const invoiceTotal = withGst ? (subtotal + totalTax) : subtotal;
      // Use the effective values (automatically calculated above)
      const prevBalanceToPay = effectivePreviousBalancePaid;
      const grandTotal = invoiceTotal + prevBalanceToPay;
      
      return {
        seller: sellerInfo,
        items: itemsWithGstCalc,
        subtotal: withGst ? totalTaxableValue : subtotal,
        taxAmount: totalTax,
        taxableValue: totalTaxableValue,
        withGst,
        total: invoiceTotal,
        previousBalance,
        previousBalancePaid: prevBalanceToPay,
        grandTotal,
        paymentStatus,
        paidAmount: paymentStatus === 'fully_paid' ? grandTotal : paidAmount,
        selectedSeller: sellerInfo?.id || ''
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to calculate preview');
    }
  }
);

export const submitSale = createAsyncThunk(
  'sellItem/submitSale',
  async ({ previewData, selectedSeller }, { rejectWithValue }) => {
    try {
      const response = await apiClient.post(config.api.sale, {
        seller_party_id: previewData.selectedSeller || selectedSeller,
        items: previewData.items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          sale_rate: item.sale_rate,
          discount: item.itemDiscount || 0,
          discount_type: item.discount_type || 'amount',
          discount_percentage: item.discount_percentage || null
        })),
        payment_status: previewData.paymentStatus,
        paid_amount: previewData.paidAmount,
        with_gst: previewData.withGst || false,
        previous_balance_paid: previewData.previousBalancePaid || 0
      });

      return {
        transactionId: response.data.transaction?.id,
        billNumber: response.data.transaction?.bill_number
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to submit sale');
    }
  }
);

const initialState = {
  // Seller party state
  sellerParties: [],
  selectedSeller: '',
  sellerInfo: null,
  sellerSearchQuery: '',
  filteredSellerParties: [],
  showSellerSuggestions: false,
  
  // Item search state
  searchQuery: '',
  suggestedItems: [],
  
  // Selected items state
  selectedItems: [],
  itemStockInfo: {},
  
  // Preview state
  previewData: null,
  previewLoading: false,
  
  // Payment state
  paymentStatus: 'fully_paid',
  paidAmount: 0,
  
  // GST state
  withGst: false,
  
  // Previous balance state
  previousBalancePaid: 0,
  payPreviousBalance: false,
  
  // Print state
  printDisabled: true,
  printClicked: false,
  
  // Discount inputs (local UI state)
  discountInputs: {},
  
  // Loading states
  loading: {
    sellerParties: false,
    sellerInfo: false,
    items: false,
    preview: false,
    submit: false
  },
  
  // Error states
  errors: {
    sellerParties: null,
    sellerInfo: null,
    items: null,
    preview: null,
    submit: null
  }
};

const sellItemSlice = createSlice({
  name: 'sellItem',
  initialState,
  reducers: {
    // Seller party actions
    setSelectedSeller: (state, action) => {
      state.selectedSeller = action.payload;
      state.sellerInfo = null;
    },
    setSellerSearchQuery: (state, action) => {
      state.sellerSearchQuery = action.payload;
      if (!action.payload) {
        state.selectedSeller = '';
        state.sellerInfo = null;
        state.filteredSellerParties = state.sellerParties;
        state.showSellerSuggestions = false;
      } else {
        const filtered = state.sellerParties.filter(party =>
          party.party_name.toLowerCase().includes(action.payload.toLowerCase()) ||
          (party.mobile_number && party.mobile_number.includes(action.payload)) ||
          (party.address && party.address.toLowerCase().includes(action.payload.toLowerCase()))
        );
        state.filteredSellerParties = filtered;
        state.showSellerSuggestions = filtered.length > 0;
      }
    },
    setShowSellerSuggestions: (state, action) => {
      state.showSellerSuggestions = action.payload;
    },
    selectSellerParty: (state, action) => {
      const party = action.payload;
      state.selectedSeller = party.id;
      state.sellerSearchQuery = party.party_name;
      state.showSellerSuggestions = false;
    },
    
    // Item search actions
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    clearSuggestedItems: (state) => {
      state.suggestedItems = [];
    },
    
    // Selected items actions
    addItemToCart: (state, action) => {
      const item = action.payload;
      const existingItem = state.selectedItems.find(i => i.item_id === item.id);
      
      if (existingItem) {
        existingItem.quantity = (parseInt(existingItem.quantity) || 0) + 1;
      } else {
        state.selectedItems.push({
          item_id: item.id,
          product_name: item.product_name,
          sale_rate: item.sale_rate,
          tax_rate: item.tax_rate || 0,
          hsn_number: item.hsn_number || '',
          quantity: 1,
          available_quantity: item.quantity || 0,
          discount: 0,
          discount_type: 'percentage',
          discount_percentage: null
        });
      }
    },
    updateItemQuantity: (state, action) => {
      const { itemId, quantity } = action.payload;
      const item = state.selectedItems.find(i => i.item_id === itemId);
      if (item) {
        item.quantity = quantity;
      }
    },
    removeItem: (state, action) => {
      state.selectedItems = state.selectedItems.filter(item => item.item_id !== action.payload);
    },
    updateItemDiscount: (state, action) => {
      const { itemId, discount, discountType, discountPercentage } = action.payload;
      const item = state.selectedItems.find(i => i.item_id === itemId);
      if (item) {
        if (discountType !== undefined) item.discount_type = discountType;
        if (discount !== undefined) item.discount = discount;
        if (discountPercentage !== undefined) item.discount_percentage = discountPercentage;
      }
    },
    updateDiscountInput: (state, action) => {
      const { itemId, value } = action.payload;
      state.discountInputs[itemId] = value;
    },
    
    // Preview actions
    clearPreview: (state) => {
      state.previewData = null;
    },
    updatePreviewItemQuantity: (state, action) => {
      const { itemId, quantity } = action.payload;
      if (!state.previewData) return;
      
      const qty = quantity === '' ? 0 : parseInt(quantity) || 0;
      const updatedItems = state.previewData.items.map(item => {
        if (item.item_id === itemId) {
          const saleRate = parseFloat(item.sale_rate) || 0;
          const taxRate = parseFloat(item.tax_rate) || 0;
          const itemTotal = saleRate * qty;
          
          // Calculate item-wise discount (matching backend logic)
          let itemDiscount = 0;
          const itemDiscountType = item.discount_type || 'amount';
          if (itemDiscountType === 'percentage' && item.discount_percentage !== null && item.discount_percentage !== undefined) {
            itemDiscount = (itemTotal * item.discount_percentage) / 100;
          } else {
            itemDiscount = parseFloat(item.discount || 0);
          }
          
          // Ensure discount doesn't exceed item total
          itemDiscount = Math.min(itemDiscount, itemTotal);
          
          const itemTotalAfterDiscount = itemTotal - itemDiscount;
          const effectiveRate = qty > 0 ? itemTotalAfterDiscount / qty : saleRate;
          
          let taxableValue = itemTotalAfterDiscount;
          let taxAmount = 0;
          
          if (state.previewData.withGst && taxRate > 0) {
            taxableValue = itemTotalAfterDiscount / (1 + taxRate / 100);
            taxAmount = itemTotalAfterDiscount - taxableValue;
          }
          
          return {
            ...item,
            quantity: quantity === '' ? '' : qty,
            itemTotal,
            itemDiscount,
            itemTotalAfterDiscount,
            effectiveRate,
            taxableValue,
            taxAmount
          };
        }
        return item;
      });
      
      const totalTaxableValue = updatedItems.reduce((sum, item) => {
        if (item.taxableValue !== undefined) {
          return sum + item.taxableValue;
        }
        return sum + (item.itemTotalAfterDiscount || item.itemTotal || 0);
      }, 0);
      const totalTax = updatedItems.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
      const total = state.previewData.withGst ? (totalTaxableValue + totalTax) : totalTaxableValue;
      
      state.previewData = {
        ...state.previewData,
        items: updatedItems,
        subtotal: totalTaxableValue,
        taxableValue: totalTaxableValue,
        taxAmount: totalTax,
        total,
        paidAmount: state.paymentStatus === 'fully_paid' ? total : Math.min(state.previewData.paidAmount, total)
      };
      state.selectedItems = updatedItems;
    },
    removePreviewItem: (state, action) => {
      if (!state.previewData) return;
      
      const updatedItems = state.previewData.items.filter(item => item.item_id !== action.payload);
      
      const totalTaxableValue = updatedItems.reduce((sum, item) => {
        if (item.taxableValue !== undefined) {
          return sum + (parseFloat(item.taxableValue) || 0);
        }
        const saleRate = parseFloat(item.sale_rate) || 0;
        const quantity = parseInt(item.quantity) || 0;
        return sum + (saleRate * quantity);
      }, 0);
      const totalTax = updatedItems.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
      const total = state.previewData.withGst ? (totalTaxableValue + totalTax) : totalTaxableValue;
      
      state.previewData = {
        ...state.previewData,
        items: updatedItems,
        subtotal: totalTaxableValue,
        taxableValue: totalTaxableValue,
        taxAmount: totalTax,
        total,
        paidAmount: state.paymentStatus === 'fully_paid' ? total : Math.min(state.previewData.paidAmount, total)
      };
      state.selectedItems = updatedItems;
    },
    updatePreviewItemDiscount: (state, action) => {
      const { itemId, discount, discountType, discountPercentage } = action.payload;
      if (!state.previewData) return;
      
      const updatedItems = state.previewData.items.map(item => {
        if (item.item_id === itemId) {
          const updatedItem = { ...item };
          if (discountType !== undefined) updatedItem.discount_type = discountType;
          if (discount !== undefined) updatedItem.discount = discount;
          if (discountPercentage !== undefined) updatedItem.discount_percentage = discountPercentage;
          
          // Recalculate item amounts with new discount
          const saleRate = parseFloat(updatedItem.sale_rate) || 0;
          const quantity = parseInt(updatedItem.quantity) || 0;
          const taxRate = parseFloat(updatedItem.tax_rate) || 0;
          const itemTotal = saleRate * quantity;
          
          // Calculate item-wise discount (matching backend logic)
          let itemDiscount = 0;
          const itemDiscountType = updatedItem.discount_type || 'amount';
          if (itemDiscountType === 'percentage' && updatedItem.discount_percentage !== null && updatedItem.discount_percentage !== undefined) {
            itemDiscount = (itemTotal * updatedItem.discount_percentage) / 100;
          } else {
            itemDiscount = parseFloat(updatedItem.discount || 0);
          }
          
          // Ensure discount doesn't exceed item total
          itemDiscount = Math.min(itemDiscount, itemTotal);
          
          const itemTotalAfterDiscount = itemTotal - itemDiscount;
          const effectiveRate = quantity > 0 ? itemTotalAfterDiscount / quantity : saleRate;
          
          let taxableValue = itemTotalAfterDiscount;
          let taxAmount = 0;
          
          if (state.previewData.withGst && taxRate > 0) {
            taxableValue = itemTotalAfterDiscount / (1 + taxRate / 100);
            taxAmount = itemTotalAfterDiscount - taxableValue;
          }
          
          return {
            ...updatedItem,
            itemTotal,
            itemDiscount,
            itemTotalAfterDiscount,
            effectiveRate,
            taxableValue,
            taxAmount
          };
        }
        return item;
      });
      
      // Recalculate totals
      const totalTaxableValue = updatedItems.reduce((sum, item) => {
        if (item.taxableValue !== undefined) {
          return sum + item.taxableValue;
        }
        return sum + (item.itemTotalAfterDiscount || item.itemTotal || 0);
      }, 0);
      const totalTax = updatedItems.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
      const total = state.previewData.withGst ? (totalTaxableValue + totalTax) : totalTaxableValue;
      
      // Automatically add previous balance if it exists
      const previousBalance = parseFloat(state.previewData.previousBalance || 0);
      const prevBalanceToPay = previousBalance > 0 ? previousBalance : 0;
      const grandTotal = total + prevBalanceToPay;
      
      state.previewData = {
        ...state.previewData,
        items: updatedItems,
        subtotal: state.previewData.withGst ? totalTaxableValue : total,
        taxAmount: totalTax,
        taxableValue: totalTaxableValue,
        total,
        grandTotal,
        paidAmount: state.paymentStatus === 'fully_paid' ? grandTotal : Math.min(state.previewData.paidAmount, grandTotal)
      };
      state.selectedItems = updatedItems;
    },
    updatePreviewPaymentInfo: (state, action) => {
      if (!state.previewData) return;
      const { paymentStatus, paidAmount, previousBalancePaid } = action.payload;
      
      state.previewData = {
        ...state.previewData,
        paymentStatus: paymentStatus !== undefined ? paymentStatus : state.previewData.paymentStatus,
        paidAmount: paidAmount !== undefined ? paidAmount : state.previewData.paidAmount,
        previousBalancePaid: previousBalancePaid !== undefined ? previousBalancePaid : state.previewData.previousBalancePaid
      };
      
      // Update local state if provided
      if (paidAmount !== undefined) {
        state.paidAmount = paidAmount;
      }
      if (previousBalancePaid !== undefined) {
        state.previousBalancePaid = previousBalancePaid;
      }
    },
    
    // Payment actions
    setPaymentStatus: (state, action) => {
      state.paymentStatus = action.payload;
      // Don't update paidAmount here - let calculatePreview handle it based on grandTotal
      // This ensures previous balance is included in the calculation
    },
    setPaidAmount: (state, action) => {
      state.paidAmount = action.payload;
    },
    
    // GST actions
    setWithGst: (state, action) => {
      state.withGst = action.payload;
    },
    
    // Previous balance actions
    setPreviousBalancePaid: (state, action) => {
      state.previousBalancePaid = action.payload;
    },
    setPayPreviousBalance: (state, action) => {
      state.payPreviousBalance = action.payload;
      // When unchecking, reset the amount
      // When checking, don't auto-set - let the UI component handle it based on previewData
      // This prevents conflicts when user is manually entering the amount
      if (!action.payload) {
        state.previousBalancePaid = 0;
      }
    },
    
    // Print actions
    setPrintDisabled: (state, action) => {
      state.printDisabled = action.payload;
    },
    setPrintClicked: (state, action) => {
      state.printClicked = action.payload;
    },
    
    // Reset actions
    resetSellItem: (state) => {
      return { ...initialState, sellerParties: state.sellerParties };
    },
    resetAfterSale: (state) => {
      state.selectedItems = [];
      state.selectedSeller = '';
      state.sellerInfo = null;
      state.previewData = null;
      state.paymentStatus = 'fully_paid';
      state.paidAmount = 0;
      state.previousBalancePaid = 0;
      state.payPreviousBalance = false;
      state.printDisabled = true;
      state.printClicked = false;
      state.discountInputs = {};
    }
  },
  extraReducers: (builder) => {
    // Fetch seller parties
    builder
      .addCase(fetchSellerParties.pending, (state) => {
        state.loading.sellerParties = true;
        state.errors.sellerParties = null;
      })
      .addCase(fetchSellerParties.fulfilled, (state, action) => {
        state.loading.sellerParties = false;
        state.sellerParties = action.payload;
        state.filteredSellerParties = action.payload;
      })
      .addCase(fetchSellerParties.rejected, (state, action) => {
        state.loading.sellerParties = false;
        state.errors.sellerParties = action.payload;
      });
    
    // Fetch seller info
    builder
      .addCase(fetchSellerInfo.pending, (state) => {
        state.loading.sellerInfo = true;
        state.errors.sellerInfo = null;
      })
      .addCase(fetchSellerInfo.fulfilled, (state, action) => {
        state.loading.sellerInfo = false;
        state.sellerInfo = action.payload;
      })
      .addCase(fetchSellerInfo.rejected, (state, action) => {
        state.loading.sellerInfo = false;
        state.errors.sellerInfo = action.payload;
      });
    
    // Search items
    builder
      .addCase(searchItems.pending, (state) => {
        state.loading.items = true;
        state.errors.items = null;
      })
      .addCase(searchItems.fulfilled, (state, action) => {
        state.loading.items = false;
        state.suggestedItems = action.payload;
      })
      .addCase(searchItems.rejected, (state, action) => {
        state.loading.items = false;
        state.errors.items = action.payload;
      });
    
    // Calculate preview
    builder
      .addCase(calculatePreview.pending, (state) => {
        state.previewLoading = true;
        state.errors.preview = null;
      })
      .addCase(calculatePreview.fulfilled, (state, action) => {
        state.previewLoading = false;
        state.previewData = action.payload;
        state.selectedItems = action.payload.items;
        // Update payment status and paid amount based on preview data
        state.paymentStatus = action.payload.paymentStatus || state.paymentStatus;
        state.paidAmount = action.payload.paidAmount || 0;
      })
      .addCase(calculatePreview.rejected, (state, action) => {
        state.previewLoading = false;
        state.errors.preview = action.payload;
      });
    
    // Submit sale
    builder
      .addCase(submitSale.pending, (state) => {
        state.loading.submit = true;
        state.errors.submit = null;
      })
      .addCase(submitSale.fulfilled, (state, action) => {
        state.loading.submit = false;
        if (action.payload.transactionId) {
          state.previewData = {
            ...state.previewData,
            transactionId: action.payload.transactionId,
            billNumber: action.payload.billNumber
          };
          state.printDisabled = false;
        }
      })
      .addCase(submitSale.rejected, (state, action) => {
        state.loading.submit = false;
        state.errors.submit = action.payload;
      });
  }
});

export const {
  setSelectedSeller,
  setSellerSearchQuery,
  setShowSellerSuggestions,
  selectSellerParty,
  setSearchQuery,
  clearSuggestedItems,
  addItemToCart,
  updateItemQuantity,
  removeItem,
  updateItemDiscount,
  updateDiscountInput,
  clearPreview,
  updatePreviewItemQuantity,
  removePreviewItem,
  updatePreviewItemDiscount,
  updatePreviewPaymentInfo,
  setPaymentStatus,
  setPaidAmount,
  setWithGst,
  setPreviousBalancePaid,
  setPayPreviousBalance,
  setPrintDisabled,
  setPrintClicked,
  resetSellItem,
  resetAfterSale
} = sellItemSlice.actions;

export default sellItemSlice.reducer;

