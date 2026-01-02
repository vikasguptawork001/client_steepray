import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import './OrderSheet.css';

const OrderSheet = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(config.api.orders, {
        params: { page, limit }
      });
      setOrders(response.data.orders);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      const response = await apiClient.get(config.api.ordersExport, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `order_sheet_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting order sheet:', error);
      alert('Error exporting order sheet');
    }
  };

  const markAsCompleted = async (orderId) => {
    try {
      await apiClient.put(`${config.api.orders}/${orderId}/complete`);
      fetchOrders();
      alert('Order marked as completed');
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  return (
    <Layout>
      <div className="order-sheet">
        <div className="order-header">
          <h2>Order Sheet</h2>
          <button onClick={exportToExcel} className="btn btn-success">
            Export to Excel
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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center' }}>
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
                        <span className={`quantity-badge ${order.current_quantity <= order.required_quantity ? 'low' : ''}`}>
                          {order.current_quantity} / {order.required_quantity}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => markAsCompleted(order.id)}
                          className="btn btn-primary"
                          style={{ padding: '5px 10px' }}
                        >
                          Mark Complete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {pagination && pagination.totalPages > 1 && (
              <div className="pagination" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page === 1}
                  className="btn btn-secondary"
                >
                  Previous
                </button>
                <span>
                  Page {pagination.page} of {pagination.totalPages} ({pagination.totalRecords} total records)
                </span>
                <button 
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} 
                  disabled={page === pagination.totalPages}
                  className="btn btn-secondary"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default OrderSheet;


