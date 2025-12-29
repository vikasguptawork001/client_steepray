import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import './OrderSheet.css';

const OrderSheet = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(config.api.orders);
      setOrders(response.data.orders);
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
                  <th>Current Quantity</th>
                  <th>Required Quantity</th>
                  <th>Rack Number</th>
                  <th>Sale Rate</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center' }}>
                      No pending orders
                    </td>
                  </tr>
                ) : (
                  orders.map((order, index) => (
                    <tr key={order.id}>
                      <td>{index + 1}</td>
                      <td>{order.product_name}</td>
                      <td>{order.product_code}</td>
                      <td>{order.brand}</td>
                      <td>
                        <span className={`quantity-badge ${order.current_quantity <= order.required_quantity ? 'low' : ''}`}>
                          {order.current_quantity}
                        </span>
                      </td>
                      <td>{order.required_quantity}</td>
                      <td>{order.rack_number}</td>
                      <td>₹{order.sale_rate}</td>
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
          </div>
        )}
      </div>
    </Layout>
  );
};

export default OrderSheet;


