import React, { createContext, useState, useContext, useEffect } from 'react';
import apiClient from '../config/axios';
import config from '../config/config';
import { encryptCredentials, secureStorage } from '../utils/encryption';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Decrypt and load user data from secure storage
    const token = secureStorage.getItem('token');
    const userData = secureStorage.getItem('user');
    if (token && userData) {
      setUser(userData);
    }
    setLoading(false);
  }, []);

  const login = async (user_id, password) => {
    try {
      // Encrypt credentials before sending over network
      const encryptedCredentials = encryptCredentials(user_id, password);
      
      const response = await apiClient.post(config.api.login, encryptedCredentials);

      const { token, user } = response.data;
      
      // Store encrypted data in localStorage
      secureStorage.setItem('token', token);
      secureStorage.setItem('user', user);
      setUser(user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  };

  const logout = () => {
    secureStorage.removeItem('token');
    secureStorage.removeItem('user');
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


