import React from 'react';
import './Pagination.css';

const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  totalRecords = null,
  showTotalRecords = false 
}) => {
  if (!totalPages || totalPages <= 1) {
    return null;
  }

  // Calculate which page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 7; // Show max 7 page numbers
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is less than maxVisible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages with ellipsis
      if (currentPage <= 4) {
        // Show first pages
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Show last pages
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Show middle pages
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="pagination">
      <button 
        onClick={() => onPageChange(Math.max(1, currentPage - 1))} 
        disabled={currentPage === 1}
        className="pagination-btn"
      >
        Previous
      </button>
      {pageNumbers.map((pageNum, index) => {
        if (pageNum === 'ellipsis') {
          return (
            <span key={`ellipsis-${index}`} className="pagination-ellipsis">
              ...
            </span>
          );
        }
        return (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum)}
            disabled={currentPage === pageNum}
            className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
          >
            {pageNum}
          </button>
        );
      })}
      <button 
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} 
        disabled={currentPage === totalPages}
        className="pagination-btn"
      >
        Next
      </button>
      <span className="pagination-info">
        Page {currentPage} of {totalPages}
        {showTotalRecords && totalRecords !== null && ` (${totalRecords} total records)`}
      </span>
    </div>
  );
};

export default Pagination;
