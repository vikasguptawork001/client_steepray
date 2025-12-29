// Client Configuration
// This file centralizes all API endpoints and configuration
// For production, these values can be overridden via environment variables

const config = {
  // API Base URL
  // In development: uses localhost
  // In production: set via REACT_APP_API_URL environment variable
  apiBaseUrl:'https://inventory-4p3l.onrender.com',
  
  // API Endpoints
  api: {
    // Auth endpoints
    login: '/api/auth/login',
    register: '/api/auth/register',
    
    // Items endpoints
    items: '/api/items',
    itemsSearch: '/api/items/search',
    itemsAdvancedSearch: '/api/items/advanced-search',
    itemsPurchase: '/api/items/purchase',
    
    // Parties endpoints
    buyers: '/api/parties/buyers',
    sellers: '/api/parties/sellers',
    
    // Transactions endpoints
    sale: '/api/transactions/sale',
    return: '/api/transactions/return',
    
    // Reports endpoints
    salesReport: '/api/reports/sales',
    salesReportExport: '/api/reports/sales/export',
    returnsReport: '/api/reports/returns',
    returnsReportExport: '/api/reports/returns/export',
    
    // Orders endpoints
    orders: '/api/orders',
    ordersExport: '/api/orders/export',
    orderComplete: (id) => `/api/orders/${id}/complete`,
    
    // Bills endpoints
    billPdf: (id) => `/api/bills/${id}/pdf`,
    
    // Health check
    health: '/api/health'
  },
  
  // App Configuration
  app: {
    name: 'Steepray Info Solutions',
    version: '1.0.0',
    defaultPageSize: 200
  },
  
  // Feature Flags
  features: {
    enableAdvancedSearch: true,
    enableExcelExport: true,
    enablePdfExport: true
  }
};

// Helper function to get full API URL
export const getApiUrl = (endpoint) => {
  // Handle function endpoints (like orderComplete, billPdf)
  if (typeof endpoint === 'function') {
    return (params) => `${config.apiBaseUrl}${endpoint(params)}`;
  }
  return `${config.apiBaseUrl}${endpoint}`;
};

// Helper function to get API endpoint
export const getApiEndpoint = (key, ...params) => {
  const endpoint = config.api[key];
  if (typeof endpoint === 'function') {
    return `${config.apiBaseUrl}${endpoint(...params)}`;
  }
  return `${config.apiBaseUrl}${endpoint}`;
};

export default config;


