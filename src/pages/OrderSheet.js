import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { getLocalDateString } from '../utils/dateUtils';
import * as XLSX from 'xlsx';
import Pagination from '../components/Pagination';
import TransactionLoader from '../components/TransactionLoader';
import './OrderSheet.css';

const OrderSheet = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [pagination, setPagination] = useState(null);
  const [exporting, setExporting] = useState(false);
  
  // Use ref to track and cancel previous requests
  const abortControllerRef = useRef(null);

  useEffect(() => {
    fetchOrders();
    // Cleanup: cancel request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const fetchOrders = async () => {
    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    try {
      setLoading(true);
      const response = await apiClient.get(config.api.orders, {
        params: { page, limit },
        signal: abortController.signal
      });
      
      // Only update state if request wasn't aborted
      if (!abortController.signal.aborted) {
        setOrders(response.data.orders);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      // Ignore abort errors
      if (error.name === 'CanceledError' || error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching orders:', error);
    } finally {
      // Only update loading state if this is still the current request
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const exportToExcel = () => {
    if (exporting || orders.length === 0) return;
    
    setExporting(true);
    try {
      // Export only the data currently showing on screen (visible/filtered data)
      const data = orders.map((order, index) => ({
        'S.No': index + 1,
        'Product Name': order.product_name,
        'Product Code': order.product_code || 'N/A',
        'Brand': order.brand || 'N/A',
        'Quantity': order.current_quantity
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      
      // Calculate column widths based on content
      const colWidths = [];
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxWidth = 10;
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[cellAddress];
          if (cell && cell.v) {
            const cellValue = String(cell.v);
            const cellLength = cellValue.length;
            if (cellLength > maxWidth) {
              maxWidth = cellLength;
            }
          }
        }
        colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
      }
      ws['!cols'] = colWidths;
      
      // Apply text wrapping and auto row height to all cells
      if (!ws['!rows']) ws['!rows'] = [];
      for (let R = range.s.r; R <= range.e.r; ++R) {
        if (!ws['!rows'][R]) ws['!rows'][R] = {};
        ws['!rows'][R].hpt = undefined; // Auto height
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) continue;
          if (!ws[cellAddress].s) ws[cellAddress].s = {};
          ws[cellAddress].s.wrapText = true;
          ws[cellAddress].s.alignment = { wrapText: true, vertical: 'top' };
        }
      }
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Order Sheet');
      
      XLSX.writeFile(wb, `order_sheet_${getLocalDateString()}.xlsx`);
      alert('Excel file exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export. Please try again.');
    } finally {
      setExporting(false);
    }
  };


  return (
    <Layout>
      <TransactionLoader isLoading={loading} type="transaction" message="Loading order sheet..." />
      <div className="order-sheet">
        <div className="order-header">
          <h2>Order Sheet</h2>
          <button 
            onClick={exportToExcel} 
            className="btn btn-success"
            disabled={exporting || orders.length === 0 || loading}
            style={{
              opacity: (exporting || orders.length === 0 || loading) ? 0.6 : 1,
              cursor: (exporting || orders.length === 0 || loading) ? 'not-allowed' : 'pointer'
            }}
          >
            {exporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>

        <div className="card info-card">
          <p>
            <strong>Note:</strong> Items are automatically added to the order sheet when their quantity 
            reaches or falls below the alert quantity.
          </p>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Records per page</label>
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Product Name</th>
                  <th>Product Code</th>
                  <th>Brand</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center' }}>
                      No pending orders
                    </td>
                  </tr>
                ) : (
                  orders.map((order, index) => (
                    <tr key={order.id}>
                      <td>{index + 1}</td>
                      <td>{order.product_name}</td>
                      <td>{order.product_code || 'N/A'}</td>
                      <td>{order.brand || 'N/A'}</td>
                      <td>
                        <span className={`quantity-badge low`}>
                          {order.current_quantity}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {pagination && !loading && (
              <Pagination
                currentPage={page}
                totalPages={pagination.totalPages}
                onPageChange={(newPage) => {
                  if (!loading) {
                    setPage(newPage);
                  }
                }}
                totalRecords={pagination.totalRecords}
                showTotalRecords={true}
              />
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default OrderSheet;


