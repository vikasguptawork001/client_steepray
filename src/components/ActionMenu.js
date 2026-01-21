import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './ActionMenu.css';

// Global state to track which menu is open - ensures only ONE menu is open at a time
let openMenuId = null;
const menuInstances = new Map();
const listeners = new Set();
let globalProcessing = false; // Global flag to prevent simultaneous actions

// Function to notify all instances when openMenuId changes
const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

const ActionMenu = ({ 
  actions = [], 
  itemId, 
  itemName = '',
  disabled = false 
}) => {
  const menuId = `${itemId}-${itemName}`;
  const [isOpen, setIsOpen] = useState(false);
  const [loadingActionIndex, setLoadingActionIndex] = useState(null);
  const [, forceUpdate] = useState({});
  const modalRef = useRef(null);
  const buttonRef = useRef(null);
  
  // Listen for changes in openMenuId to update disabled state
  useEffect(() => {
    const listener = () => {
      forceUpdate({});
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Register this menu instance
  useEffect(() => {
    menuInstances.set(menuId, { setIsOpen, modalRef, buttonRef, disabled: false });
    return () => {
      menuInstances.delete(menuId);
      if (openMenuId === menuId) {
        openMenuId = null;
      }
    };
  }, [menuId]);
  
  // Check if any other menu is open to disable this button
  const isOtherMenuOpen = openMenuId !== null && openMenuId !== menuId;

  // Close all other menus when this one opens
  const closeAllOtherMenus = () => {
    menuInstances.forEach((instance, id) => {
      if (id !== menuId && instance.setIsOpen) {
        instance.setIsOpen(false);
      }
    });
  };

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        openMenuId = null;
        notifyListeners();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, menuId]);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!disabled) {
      const newIsOpen = !isOpen;
      
      if (newIsOpen) {
        // Close all other menus first
        closeAllOtherMenus();
        openMenuId = menuId;
        notifyListeners(); // Notify all instances to update disabled state
      } else {
        openMenuId = null;
        notifyListeners(); // Notify all instances to update disabled state
      }
      
      setIsOpen(newIsOpen);
    }
  };

  const handleActionClick = async (action, actionIndex, e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Prevent clicking if any action is already processing (check both local and global state)
    if (action.disabled || loadingActionIndex !== null || globalProcessing) {
      return;
    }

    // Set global processing flag immediately (synchronous) to prevent other clicks
    globalProcessing = true;
    
    // Set loading state immediately - this will disable all buttons
    setLoadingActionIndex(actionIndex);
    
    // Immediately disable all action buttons in the modal
    if (modalRef.current) {
      const allButtons = modalRef.current.querySelectorAll('.action-menu-item');
      allButtons.forEach(btn => {
        btn.disabled = true;
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.5';
      });
    }
    
    try {
      // Call the action handler
      if (action.onClick) {
        const result = action.onClick(itemId, itemName);
        
        // If it returns a promise, wait for it
        if (result && typeof result.then === 'function') {
          await result;
          // For async actions, close menu after completion
          setIsOpen(false);
          openMenuId = null;
          notifyListeners();
        } else {
          // For sync actions, show loading briefly then close
          setTimeout(() => {
            setIsOpen(false);
            openMenuId = null;
            notifyListeners();
          }, 200);
        }
      } else {
        // No onClick handler, just close
        setIsOpen(false);
        openMenuId = null;
        notifyListeners();
      }
    } catch (error) {
      console.error('Action error:', error);
      // Keep menu open on error so user can see what happened
      // Error handling is typically done by the action itself (toast, etc.)
    } finally {
      // Reset loading state and global processing flag after action completes
      setTimeout(() => {
        setLoadingActionIndex(null);
        globalProcessing = false;
        
        // Re-enable buttons if modal is still open
        if (modalRef.current && isOpen) {
          const allButtons = modalRef.current.querySelectorAll('.action-menu-item');
          allButtons.forEach((btn, idx) => {
            const actionItem = actions[idx];
            if (actionItem && !actionItem.disabled) {
              btn.disabled = false;
              btn.style.pointerEvents = 'auto';
              btn.style.opacity = '1';
            }
          });
        }
      }, 100);
    }
  };

  if (!actions || actions.length === 0) {
    return null;
  }

  // If there's only one action, render it as a direct button instead of menu
  if (actions.length === 1) {
    const singleAction = actions[0];
    const isActionLoading = loadingActionIndex === 0;
    const isAnyProcessing = loadingActionIndex !== null || globalProcessing;
    
    return (
      <div className="action-menu-wrapper" style={{ position: 'relative' }}>
        <button
          ref={buttonRef}
          type="button"
          className={`action-menu-single-button ${singleAction.danger ? 'danger' : ''} ${disabled || singleAction.disabled || isActionLoading || isAnyProcessing ? 'disabled' : ''} ${isActionLoading ? 'loading' : ''}`}
          onClick={async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            if (singleAction.disabled || disabled || isActionLoading || isAnyProcessing) {
              return;
            }

            // Set global processing flag immediately
            globalProcessing = true;
            setLoadingActionIndex(0);
            
            try {
              if (singleAction.onClick) {
                const result = singleAction.onClick(itemId, itemName);
                if (result && typeof result.then === 'function') {
                  await result;
                }
              }
            } catch (error) {
              console.error('Action error:', error);
            } finally {
              setTimeout(() => {
                setLoadingActionIndex(null);
                globalProcessing = false;
              }, 100);
            }
          }}
          disabled={disabled || singleAction.disabled || isActionLoading || isAnyProcessing}
          aria-label={singleAction.label || 'Action'}
          style={{
            pointerEvents: (disabled || singleAction.disabled || isActionLoading || isAnyProcessing) ? 'none' : 'auto',
            cursor: (disabled || singleAction.disabled || isActionLoading || isAnyProcessing) ? 'not-allowed' : 'pointer'
          }}
        >
          {isActionLoading ? (
            <>
              <span className="action-menu-spinner-small"></span>
              <span className="action-menu-label">Processing...</span>
            </>
          ) : (
            <>
              {singleAction.icon && <span className="action-menu-icon">{singleAction.icon}</span>}
              <span className="action-menu-label">{singleAction.label}</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // Multiple actions - show three-dots menu
  return (
    <div className="action-menu-wrapper" style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        className={`action-menu-button ${disabled || loadingActionIndex !== null || isOtherMenuOpen ? 'disabled' : ''} ${loadingActionIndex !== null ? 'loading' : ''}`}
        onClick={handleToggle}
        disabled={disabled || loadingActionIndex !== null || isOtherMenuOpen}
        aria-label="Actions"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {loadingActionIndex !== null ? (
          <span className="action-menu-spinner"></span>
        ) : (
          <span className="action-menu-dots">⋯</span>
        )}
      </button>
      
      {isOpen && createPortal(
        <div className="action-menu-modal-overlay">
          <div
            ref={modalRef}
            className="action-menu-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="action-menu-modal-header">
              <h3>Actions</h3>
              <button
                type="button"
                className="action-menu-modal-close"
                onClick={() => {
                  setIsOpen(false);
                  openMenuId = null;
                  notifyListeners();
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="action-menu-modal-content">
              {actions.map((action, index) => {
                const isActionLoading = loadingActionIndex === index;
                const isAnyProcessing = loadingActionIndex !== null || globalProcessing;
                return (
                  <button
                    key={index}
                    type="button"
                    className={`action-menu-item ${action.danger ? 'danger' : ''} ${action.disabled || isActionLoading || isAnyProcessing ? 'disabled' : ''} ${isActionLoading ? 'loading' : ''}`}
                    onClick={(e) => handleActionClick(action, index, e)}
                    disabled={action.disabled || isActionLoading || isAnyProcessing}
                    style={{
                      pointerEvents: (action.disabled || isActionLoading || isAnyProcessing) ? 'none' : 'auto',
                      cursor: (action.disabled || isActionLoading || isAnyProcessing) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isActionLoading ? (
                      <>
                        <span className="action-menu-spinner-small"></span>
                        <span className="action-menu-label">Processing...</span>
                      </>
                    ) : (
                      <>
                        {action.icon && <span className="action-menu-icon">{action.icon}</span>}
                        <span className="action-menu-label">{action.label}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ActionMenu;
