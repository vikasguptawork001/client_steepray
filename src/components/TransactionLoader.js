import React from 'react';
import './TransactionLoader.css';

const TransactionLoader = ({ isLoading, message, type = 'transaction' }) => {
  if (!isLoading) return null;

  const getMessage = () => {
    if (message) return message;
    
    switch (type) {
      case 'sell':
      case 'sale':
        return 'Processing sale...';
      case 'return':
        return 'Processing return...';
      case 'purchase':
        return 'Processing purchase...';
      case 'payment':
        return 'Processing payment...';
      default:
        return 'Processing transaction...';
    }
  };

  return (
    <div className="transaction-loader-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="transaction-loader-content">
        <div className="transaction-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <p className="transaction-loader-message">{getMessage()}</p>
        <p className="transaction-loader-hint">Please wait, do not close this page</p>
      </div>
    </div>
  );
};

export default TransactionLoader;

