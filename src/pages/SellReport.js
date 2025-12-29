import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { useAuth } from '../context/AuthContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './Report.css';

const SellReport = () => {
  const { user } = useAuth();
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [fromDate, toDate]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const from = fromDate.toISOString().split('T')[0];
      const to = toDate.toISOString().split('T')[0];
      const response = await apiClient.get(config.api.salesReport, {
        params: { from_date: from, to_date: to }
      });
      setTransactions(response.data.transactions);
      setSummary(response.data.summary);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      const from = fromDate.toISOString().split('T')[0];
      const to = toDate.toISOString().split('T')[0];
      const response = await apiClient.get(config.api.salesReportExport, {
        params: { from_date: from, to_date: to },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sales_report_${from}_${to}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Error exporting report');
    }
  };

  return (
    <Layout>
      <div className="report">
        <div className="report-header">
          <h2>Sell Report</h2>
          <button onClick={exportToExcel} className="btn btn-success">
            Export to Excel
          </button>
        </div>

        <div className="card">
          <div className="date-filters">
            <div className="form-group">
              <label>From Date</label>
              <DatePicker
                selected={fromDate}
                onChange={(date) => setFromDate(date)}
                dateFormat="yyyy-MM-dd"
                className="date-input"
              />
            </div>
            <div className="form-group">
              <label>To Date</label>
              <DatePicker
                selected={toDate}
                onChange={(date) => setToDate(date)}
                dateFormat="yyyy-MM-dd"
                className="date-input"
              />
            </div>
            <button onClick={fetchReport} className="btn btn-primary">
              Refresh
            </button>
          </div>
        </div>

        {summary && (
          <div className="card summary-card">
            <h3>Summary</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <label>Total Sales:</label>
                <span>₹{summary.totalSales.toFixed(2)}</span>
              </div>
              <div className="summary-item">
                <label>Total Paid:</label>
                <span>₹{summary.totalPaid.toFixed(2)}</span>
              </div>
              <div className="summary-item">
                <label>Total Balance:</label>
                <span>₹{summary.totalBalance.toFixed(2)}</span>
              </div>
              {user?.role === 'super_admin' && summary.totalProfit !== null && (
                <div className="summary-item">
                  <label>Total Profit:</label>
                  <span>₹{summary.totalProfit.toFixed(2)}</span>
                </div>
              )}
              <div className="summary-item">
                <label>Total Transactions:</label>
                <span>{summary.totalTransactions}</span>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bill Number</th>
                  <th>Party Name</th>
                  <th>Total Amount</th>
                  <th>Paid Amount</th>
                  <th>Balance Amount</th>
                  <th>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center' }}>No transactions found</td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn.id}>
                      <td>{new Date(txn.transaction_date).toLocaleDateString()}</td>
                      <td>{txn.bill_number}</td>
                      <td>{txn.party_name}</td>
                      <td>₹{txn.total_amount}</td>
                      <td>₹{txn.paid_amount}</td>
                      <td>₹{txn.balance_amount}</td>
                      <td>
                        <span className={`status-badge ${txn.payment_status}`}>
                          {txn.payment_status.replace('_', ' ').toUpperCase()}
                        </span>
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

export default SellReport;


