import React, { useState, useEffect, useRef } from 'react';
import './ItemSearchModal.css';

const ItemSearchModal = ({ 
  isOpen, 
  onClose, 
  items, 
  onItemSelect, 
  searchQuery,
  onSearchChange,
  title = "Search Items",
  selectedItems = [], // Array of items already in cart
  allowOutOfStock = false // Allow selecting out-of-stock items (for inventory filling)
}) => {
  const searchInputRef = useRef(null);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    // Auto-check items that are already in cart
    if (isOpen && selectedItems.length > 0) {
      const cartItemIds = new Set(selectedItems.map(item => item.item_id));
      setSelectedItemIds(cartItemIds);
    }
  }, [isOpen, selectedItems]);

  useEffect(() => {
    // Update selectedItemIds when items change (new search results)
    // Keep items checked if they're already in cart
    if (isOpen && selectedItems.length > 0) {
      const cartItemIds = new Set(selectedItems.map(item => item.item_id));
      setSelectedItemIds(prev => {
        const newSet = new Set(prev);
        // Add any cart items that appear in new search results
        items.forEach(item => {
          if (cartItemIds.has(item.id)) {
            newSet.add(item.id);
          }
        });
        return newSet;
      });
    }
  }, [items, isOpen, selectedItems]);

  const handleCheckboxChange = (item) => {
    const isOutOfStock = (item.quantity || 0) <= 0;
    if (isOutOfStock && !allowOutOfStock) return;

    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item.id)) {
        newSet.delete(item.id);
      } else {
        newSet.add(item.id);
        // Auto-add to cart when checkbox is checked
        onItemSelect(item);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const availableItems = allowOutOfStock 
      ? items 
      : items.filter(item => (item.quantity || 0) > 0);
    availableItems.forEach(item => {
      if (!selectedItemIds.has(item.id)) {
        onItemSelect(item);
      }
    });
    setSelectedItemIds(new Set(availableItems.map(item => item.id)));
  };

  const handleClear = () => {
    setSelectedItemIds(new Set());
  };

  if (!isOpen) return null;

  const availableItems = allowOutOfStock 
    ? items 
    : items.filter(item => (item.quantity || 0) > 0);
  const selectedCount = selectedItemIds.size;

  return (
    <div className="item-search-modal-overlay">
      <div className="item-search-modal-content">
        {/* Header */}
        <div className="item-search-modal-header">
          <h2>{title}</h2>
          <button 
            className="item-search-modal-close" 
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Search Input */}
        <div className="item-search-modal-search">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by product name, brand, HSN..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="item-search-modal-input"
            autoFocus
          />
          {items.length > 0 && (
            <div className="item-search-modal-actions">
              <button
                onClick={handleSelectAll}
                className="btn btn-secondary btn-sm"
                disabled={availableItems.length === 0}
              >
                Select All ({availableItems.length})
              </button>
              <button
                onClick={handleClear}
                className="btn btn-secondary btn-sm"
                disabled={selectedCount === 0}
              >
                Clear
              </button>
              {selectedCount > 0 && (
                <span className="item-search-selected-count">
                  {selectedCount} selected
                </span>
              )}
            </div>
          )}
        </div>

        {/* Items Grid */}
        <div className="item-search-modal-body">
          {items.length === 0 ? (
            <div className="item-search-modal-empty">
              <p>No items found. Try a different search term.</p>
            </div>
          ) : (
            <div className="item-search-modal-grid">
              {items.map((item) => {
                const isOutOfStock = (item.quantity || 0) <= 0;
                const isSelected = selectedItemIds.has(item.id);
                
                return (
                  <div
                    key={item.id}
                    className={`item-search-modal-card ${isSelected ? 'selected' : ''} ${isOutOfStock && !allowOutOfStock ? 'out-of-stock' : ''}`}
                    onClick={() => (allowOutOfStock || !isOutOfStock) && handleCheckboxChange(item)}
                  >
                    <div className="item-search-modal-card-header">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isOutOfStock && !allowOutOfStock}
                        onChange={() => handleCheckboxChange(item)}
                        onClick={(e) => e.stopPropagation()}
                        className="item-search-modal-checkbox"
                      />
                      <h3 className="item-search-modal-product-name">
                        {item.product_name || item.item_name}
                      </h3>
                    </div>
                    
                    <div className="item-search-modal-card-body">
                      {item.brand && (
                        <div className="item-search-modal-detail">
                          <span className="label">Brand:</span>
                          <span className="value">{item.brand}</span>
                        </div>
                      )}
                      {item.hsn_number && (
                        <div className="item-search-modal-detail">
                          <span className="label">HSN:</span>
                          <span className="value">{item.hsn_number}</span>
                        </div>
                      )}
                      {item.product_code && (
                        <div className="item-search-modal-detail">
                          <span className="label">Code:</span>
                          <span className="value">{item.product_code}</span>
                        </div>
                      )}
                      <div className="item-search-modal-detail">
                        <span className="label">Rate:</span>
                        <span className="value price">₹{parseFloat(item.sale_rate || item.purchase_rate || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="item-search-modal-card-footer">
                      <div className={`item-search-modal-stock ${isOutOfStock ? 'out-of-stock' : 'in-stock'}`}>
                        {isOutOfStock ? (
                          <span>Out of Stock</span>
                        ) : (
                          <span>{item.quantity || 0} available</span>
                        )}
                      </div>
                      {isSelected && (
                        <span className="item-search-modal-selected-badge">✓ Added</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="item-search-modal-footer">
          <button onClick={onClose} className="btn btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemSearchModal;

