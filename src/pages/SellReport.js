import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { useAuth } from '../context/AuthContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { getLocalDateString } from '../utils/dateUtils';
import './Report.css';

const SellReport = () => {
  const { user } = useAuth();
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gstFilter, setGstFilter] = useState('all'); // 'all', 'with_gst', 'without_gst'
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [pagination, setPagination] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, gstFilter, page, limit]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const from = getLocalDateString(fromDate);
      const to = getLocalDateString(toDate);
      const response = await apiClient.get(config.api.salesReport, {
        params: { from_date: from, to_date: to, gst_filter: gstFilter, page, limit }
      });
      setTransactions(response.data.transactions);
      setSummary(response.data.summary);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const from = getLocalDateString(fromDate);
      const to = getLocalDateString(toDate);
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
    } finally {
      setExporting(false);
    }
  };

  return (
    <Layout>
      <div className="report">
        <div className="report-header">
          <h2>Sell Report</h2>
          <button 
            onClick={exportToExcel} 
            className="btn btn-success"
            disabled={exporting}
            style={{
              opacity: exporting ? 0.6 : 1,
              cursor: exporting ? 'not-allowed' : 'pointer'
            }}
          >
            {exporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>

        <div className="card">
          <div className="date-filters">
            <div className="form-group">
              <label>From Date</label>
              <DatePicker
                selected={fromDate}
                onChange={(date) => setFromDate(date)}
                dateFormat="dd-MM-yyyy"
                className="date-input"
              />
            </div>
            <div className="form-group">
              <label>To Date</label>
              <DatePicker
                selected={toDate}
                onChange={(date) => setToDate(date)}
                dateFormat="dd-MM-yyyy"
                className="date-input"
              />
            </div>
            <div className="form-group">
              <label>GST Filter</label>
              <select 
                value={gstFilter} 
                onChange={(e) => setGstFilter(e.target.value)}
                className="date-input"
              >
                <option value="all">All Bills</option>
                <option value="with_gst">With GST</option>
                <option value="without_gst">Without GST</option>
              </select>
            </div>
            <button onClick={() => { setPage(1); fetchReport(); }} className="btn btn-primary">
              Refresh
            </button>
            <div className="form-group">
              <label>Records per page</label>
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="date-input"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
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
              {summary.withGstCount !== undefined && (
                <>
                  <div className="summary-item">
                    <label>With GST Bills:</label>
                    <span>{summary.withGstCount}</span>
                  </div>
                  <div className="summary-item">
                    <label>Without GST Bills:</label>
                    <span>{summary.withoutGstCount}</span>
                  </div>
                </>
              )}
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
                  <th>GST</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center' }}>No transactions found</td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn.id}>
                      <td>{new Date(txn.transaction_date).toLocaleString()}</td>
                      <td>{txn.bill_number}</td>
                      <td>{txn.party_name}</td>
                      <td>₹{parseFloat(txn.total_amount).toFixed(2)}</td>
                      <td>₹{parseFloat(txn.paid_amount).toFixed(2)}</td>
                      <td>₹{parseFloat(txn.balance_amount).toFixed(2)}</td>
                      <td>
                        <span className={`status-badge ${txn.payment_status}`}>
                          {txn.payment_status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${txn.with_gst ? 'with-gst' : 'without-gst'}`}>
                          {txn.with_gst ? 'GST' : 'Non-GST'}
                        </span>
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

export default SellReport;


