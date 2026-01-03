import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './Report.css';

const ReturnReport = () => {
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [partyType, setPartyType] = useState(''); // 'seller', 'buyer', or '' for all
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [pagination, setPagination] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, partyType, page, limit]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const from = fromDate.toISOString().split('T')[0];
      const to = toDate.toISOString().split('T')[0];
      const params = { from_date: from, to_date: to, page, limit };
      if (partyType) {
        params.party_type = partyType;
      }
      const response = await apiClient.get(config.api.returnsReport, { params });
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
      const from = fromDate.toISOString().split('T')[0];
      const to = toDate.toISOString().split('T')[0];
      const params = { from_date: from, to_date: to };
      if (partyType) {
        params.party_type = partyType;
      }
      const response = await apiClient.get(config.api.returnsReportExport, {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `return_report_${from}_${to}.xlsx`);
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
          <h2>Return Report</h2>
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
            <div className="form-group">
              <label>Party Type</label>
              <select
                value={partyType}
                onChange={(e) => setPartyType(e.target.value)}
                className="date-input"
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="">All</option>
                <option value="seller">Return from Seller</option>
                <option value="buyer">Return from Buyer</option>
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
                <label>Total Returns:</label>
                <span>₹{summary.totalReturns.toFixed(2)}</span>
              </div>
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
                  <th>Party Type</th>
                  <th>Party Name</th>
                  <th>Product Name</th>
                  <th>Brand</th>
                  <th>Quantity</th>
                  <th>Return Amount</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center' }}>No returns found</td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn.id}>
                      <td>{new Date(txn.return_date).toLocaleDateString()}</td>
                      <td>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: txn.party_type === 'buyer' ? '#e3f2fd' : '#fff3e0',
                          color: txn.party_type === 'buyer' ? '#1976d2' : '#e65100',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}>
                          {txn.party_type === 'buyer' ? 'Buyer' : 'Seller'}
                        </span>
                      </td>
                      <td>{txn.party_name}</td>
                      <td>{txn.product_name}</td>
                      <td>{txn.brand}</td>
                      <td>{txn.quantity}</td>
                      <td>₹{txn.return_amount}</td>
                      <td>{txn.reason || '-'}</td>
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

export default ReturnReport;


