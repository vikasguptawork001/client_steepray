import axios from 'axios';
import config from './config';

// Create axios instance with base URL
const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 60*10*1000, // 30 seconds
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle authentication errors - redirect to login
    const errorMessage = error.response?.data?.error || '';
    const isAuthError = 
      error.response?.status === 401 || 
      errorMessage.toLowerCase().includes('invalid or expired token') ||
      errorMessage.toLowerCase().includes('invalid token') ||
      errorMessage.toLowerCase().includes('expired token') ||
      errorMessage.toLowerCase().includes('unauthorized');
    
    if (isAuthError) {
      // Clear authentication data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Redirect to login page
      // Only redirect if not already on login page to avoid redirect loops
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;













