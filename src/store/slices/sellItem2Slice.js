import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Async thunks
export const searchItems = createAsyncThunk(
  'sellItem2/searchItems',
  async (query) => {
    const response = await axios.get(`${API_URL}/items/search`, {
      params: { query }
    });
    return response.data;
  }
);

export const searchSellers = createAsyncThunk(
  'sellItem2/searchSellers',
  async (query) => {
    const response = await axios.get(`${API_URL}/parties/search`, {
      params: { query, type: 'seller' }
    });
    return response.data;
  }
);

export const getSellerDetails = createAsyncThunk(
  'sellItem2/getSellerDetails',
  async (sellerId) => {
    const response = await axios.get(`${API_URL}/parties/${sellerId}`);
    return response.data;
  }
);

export const submitSale = createAsyncThunk(
  'sellItem2/submitSale',
  async (saleData) => {
    const response = await axios.post(`${API_URL}/transactions`, saleData);
    return response.data;
  }
);

export const generateBillPDF = createAsyncThunk(
  'sellItem2/generateBillPDF',
  async (billData) => {
    const response = await axios.post(`${API_URL}/transactions/generate-bill`, billData, {
      responseType: 'blob'
    });
    return response.data;
  }
);

const initialState = {
  // Item search
  itemSearchQuery: '',
  suggestedItems: [],
  itemSearchLoading: false,
  
  // Seller search
  sellerSearchQuery: '',
  suggestedSellers: [],
  sellerSearchLoading: false,
  selectedSeller: null,
  
  // Cart
  cartItems: [],
  
  // Payment
  paymentStatus: 'fully_paid',
  paidAmount: 0,
  
  // Bill preview
  showBillPreview: true,
  
  // UI state
  loading: false,
  error: null,
  successMessage: null
};

const sellItem2Slice = createSlice({
  name: 'sellItem2',
  initialState,
  reducers: {
    setItemSearchQuery: (state, action) => {
      state.itemSearchQuery = action.payload;
    },
    
    setSellerSearchQuery: (state, action) => {
      state.sellerSearchQuery = action.payload;
    },
    
    selectSeller: (state, action) => {
      state.selectedSeller = action.payload;
      state.sellerSearchQuery = action.payload.party_name;
      state.suggestedSellers = [];
    },
    
    addToCart: (state, action) => {
      const item = action.payload;
      const existingItem = state.cartItems.find(ci => ci.item_id === item.item_id);
      
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        state.cartItems.push({
          ...item,
          quantity: 1,
          sale_rate: parseFloat(item.sale_rate) || 0
        });
      }
    },
    
    updateCartItemQuantity: (state, action) => {
      const { item_id, quantity } = action.payload;
      const item = state.cartItems.find(ci => ci.item_id === item_id);
      if (item) {
        item.quantity = Math.max(1, quantity);
      }
    },
    
    updateCartItemRate: (state, action) => {
      const { item_id, rate } = action.payload;
      const item = state.cartItems.find(ci => ci.item_id === item_id);
      if (item) {
        item.sale_rate = Math.max(0, rate);
      }
    },
    
    removeFromCart: (state, action) => {
      state.cartItems = state.cartItems.filter(item => item.item_id !== action.payload);
    },
    
    clearCart: (state) => {
      state.cartItems = [];
    },
    
    setPaymentStatus: (state, action) => {
      state.paymentStatus = action.payload;
      if (action.payload === 'fully_paid') {
        // Calculate total and set paid amount
        const total = state.cartItems.reduce((sum, item) => {
          const itemTotal = item.quantity * item.sale_rate;
          const taxAmount = (itemTotal * item.tax_rate) / 100;
          return sum + itemTotal + taxAmount;
        }, 0);
        state.paidAmount = total;
      }
    },
    
    setPaidAmount: (state, action) => {
      state.paidAmount = Math.max(0, action.payload);
    },
    
    toggleBillPreview: (state) => {
      state.showBillPreview = !state.showBillPreview;
    },
    
    resetForm: (state) => {
      state.cartItems = [];
      state.selectedSeller = null;
      state.sellerSearchQuery = '';
      state.itemSearchQuery = '';
      state.suggestedItems = [];
      state.suggestedSellers = [];
      state.paymentStatus = 'fully_paid';
      state.paidAmount = 0;
      state.error = null;
      state.successMessage = null;
    },
    
    clearMessages: (state) => {
      state.error = null;
      state.successMessage = null;
    }
  },
  
  extraReducers: (builder) => {
    // Search items
    builder
      .addCase(searchItems.pending, (state) => {
        state.itemSearchLoading = true;
      })
      .addCase(searchItems.fulfilled, (state, action) => {
        state.itemSearchLoading = false;
        state.suggestedItems = action.payload;
      })
      .addCase(searchItems.rejected, (state, action) => {
        state.itemSearchLoading = false;
        state.error = action.error.message;
      });
    
    // Search sellers
    builder
      .addCase(searchSellers.pending, (state) => {
        state.sellerSearchLoading = true;
      })
      .addCase(searchSellers.fulfilled, (state, action) => {
        state.sellerSearchLoading = false;
        state.suggestedSellers = action.payload;
      })
      .addCase(searchSellers.rejected, (state, action) => {
        state.sellerSearchLoading = false;
        state.error = action.error.message;
      });
    
    // Get seller details
    builder
      .addCase(getSellerDetails.fulfilled, (state, action) => {
        state.selectedSeller = action.payload;
      });
    
    // Submit sale
    builder
      .addCase(submitSale.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(submitSale.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = 'Sale completed successfully!';
        // Reset cart but keep seller selected
        state.cartItems = [];
        state.paymentStatus = 'fully_paid';
        state.paidAmount = 0;
      })
      .addCase(submitSale.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
    
    // Generate PDF
    builder
      .addCase(generateBillPDF.pending, (state) => {
        state.loading = true;
      })
      .addCase(generateBillPDF.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(generateBillPDF.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export const {
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
  resetForm,
  clearMessages
} = sellItem2Slice.actions;

export default sellItem2Slice.reducer;

