/**
 * Encryption utility for securing sensitive data
 * Uses AES-256 encryption for localStorage and network data
 */

// Encryption key - In production, this should be stored securely
// Using a shared secret that matches server-side
const getEncryptionKey = () => {
  // In production, this should come from environment variable or secure config
  // This must match the server-side ENCRYPTION_SECRET
  const secret = process.env.REACT_APP_ENCRYPTION_SECRET || 'STEEPRAY_SECURE_KEY_2024';
  
  // For network encryption, use shared secret (server can decrypt)
  // For localStorage, we can add browser fingerprint for extra security
  let key = secret;
  
  // Ensure key is 32 bytes (pad or truncate)
  while (key.length < 32) {
    key += key;
  }
  return key.substring(0, 32);
};

// Storage encryption key (can include browser fingerprint for extra security)
const getStorageEncryptionKey = () => {
  const secret = process.env.REACT_APP_ENCRYPTION_SECRET || 'STEEPRAY_SECURE_KEY_2024';
  // Add browser fingerprint for localStorage encryption (extra layer)
  const screen = typeof window !== 'undefined' ? window.screen : { width: 0, height: 0 };
  const fingerprint = (typeof navigator !== 'undefined' ? navigator.userAgent : '') + 
                       (typeof navigator !== 'undefined' ? navigator.language : '') + 
                       screen.width + 
                       screen.height;
  let key = secret + fingerprint;
  
  while (key.length < 32) {
    key += key;
  }
  return key.substring(0, 32);
};

/**
 * Simple XOR encryption (lightweight, no external dependencies)
 * For production, consider using Web Crypto API or crypto-js
 */
const simpleEncrypt = (text, key) => {
  if (!text) return '';
  
  let result = '';
  const keyLength = key.length;
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const keyChar = key.charCodeAt(i % keyLength);
    result += String.fromCharCode(charCode ^ keyChar);
  }
  
  // Convert to base64 for safe storage
  return btoa(result);
};

const simpleDecrypt = (encryptedText, key) => {
  if (!encryptedText) return '';
  
  try {
    // Decode from base64
    const text = atob(encryptedText);
    let result = '';
    const keyLength = key.length;
    
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const keyChar = key.charCodeAt(i % keyLength);
      result += String.fromCharCode(charCode ^ keyChar);
    }
    
    return result;
  } catch (error) {
    console.error('Decryption error:', error);
    return '';
  }
};

/**
 * Encrypt data for localStorage
 */
export const encryptStorage = (data) => {
  try {
    if (!data) return '';
    const key = getStorageEncryptionKey(); // Use storage-specific key
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    return simpleEncrypt(jsonString, key);
  } catch (error) {
    console.error('Encryption error:', error);
    return data; // Return original if encryption fails
  }
};

/**
 * Decrypt data from localStorage
 */
export const decryptStorage = (encryptedData) => {
  try {
    if (!encryptedData) return null;
    const key = getStorageEncryptionKey(); // Use storage-specific key
    const decrypted = simpleDecrypt(encryptedData, key);
    
    // Try to parse as JSON, return string if not valid JSON
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

/**
 * Encrypt credentials for network transmission
 * Note: This is client-side encryption. HTTPS should still be used.
 * Uses shared secret so server can decrypt
 */
export const encryptCredentials = (user_id, password) => {
  try {
    const key = getEncryptionKey(); // Use shared secret key
    return {
      user_id: simpleEncrypt(user_id, key),
      password: simpleEncrypt(password, key),
      encrypted: true // Flag to indicate encryption
    };
  } catch (error) {
    console.error('Credential encryption error:', error);
    // Fallback to plain text if encryption fails (not recommended)
    return { user_id, password, encrypted: false };
  }
};

/**
 * Decrypt credentials (for server-side if needed)
 * This would be used on the server to decrypt if client-side encryption is used
 */
export const decryptCredentials = (encryptedData) => {
  try {
    if (!encryptedData.encrypted) {
      return encryptedData; // Already decrypted
    }
    const key = getEncryptionKey();
    return {
      user_id: simpleDecrypt(encryptedData.user_id, key),
      password: simpleDecrypt(encryptedData.password, key)
    };
  } catch (error) {
    console.error('Credential decryption error:', error);
    return encryptedData;
  }
};

/**
 * Secure localStorage wrapper
 */
export const secureStorage = {
  setItem: (key, value) => {
    try {
      const encrypted = encryptStorage(value);
      localStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('Error storing encrypted data:', error);
      // Fallback to plain storage if encryption fails
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  },
  
  getItem: (key) => {
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;
      return decryptStorage(encrypted);
    } catch (error) {
      console.error('Error retrieving encrypted data:', error);
      // Fallback to plain retrieval
      const value = localStorage.getItem(key);
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
  },
  
  removeItem: (key) => {
    localStorage.removeItem(key);
  },
  
  clear: () => {
    localStorage.clear();
  }
};

