import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { getLocalDateString } from '../utils/dateUtils';
import * as XLSX from 'xlsx';
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
  const [exportingFiltered, setExportingFiltered] = useState(false);

  // Validate dates
  const validateDates = () => {
    if (fromDate && toDate && fromDate > toDate) {
      alert('From date cannot be after To date. Please select valid dates.');
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (validateDates()) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, partyType, page, limit]);

  const fetchReport = async () => {
    if (!validateDates()) {
      return;
    }
    try {
      setLoading(true);
      const from = getLocalDateString(fromDate);
      const to = getLocalDateString(toDate);
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
    if (!validateDates()) {
      return;
    }
    setExporting(true);
    try {
      const from = getLocalDateString(fromDate);
      const to = getLocalDateString(toDate);
      // Export ALL results from API, ignoring pagination
      const params = { from_date: from, to_date: to };
      // Note: partyType filter is still applied as it's a date range filter, not a UI filter
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
      link.setAttribute('download', `return_report_all_${from}_${to}.xlsx`);
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

  const exportFilteredToExcel = () => {
    if (exportingFiltered || transactions.length === 0) return;
    
    setExportingFiltered(true);
    try {
      const data = transactions.map(txn => ({
        'Date': new Date(txn.created_at).toLocaleString(),
        'Bill Number': txn.bill_number || '-',
        'Party Type': txn.party_type === 'buyer' ? 'Buyer' : 'Seller',
        'Party Name': txn.party_name,
        'Items Summary': txn.items_summary || 'No items',
        'Item Count': txn.item_count || 0,
        'Total Return Amount': parseFloat(txn.return_amount || 0).toFixed(2),
        'Reason': txn.reason || '-'
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Return Report');
      
      const from = getLocalDateString(fromDate);
      const to = getLocalDateString(toDate);
      XLSX.writeFile(wb, `return_report_filtered_${from}_${to}.xlsx`);
      alert('Filtered Excel file exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export. Please try again.');
    } finally {
      setExportingFiltered(false);
    }
  };

  return (
    <Layout>
      <div className="report">
        <div className="report-header">
          <h2>Return Report</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
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
            <button 
              onClick={exportFilteredToExcel} 
              className="btn btn-primary"
              disabled={exportingFiltered || transactions.length === 0}
              style={{
                opacity: (exportingFiltered || transactions.length === 0) ? 0.6 : 1,
                cursor: (exportingFiltered || transactions.length === 0) ? 'not-allowed' : 'pointer'
              }}
            >
              {exportingFiltered ? 'Exporting...' : 'Export to Excel with Filtered'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="date-filters">
            <div className="form-group">
              <label>From Date</label>
              <DatePicker
                selected={fromDate}
                onChange={(date) => {
                  setFromDate(date);
                  // Auto-adjust toDate if fromDate is after toDate
                  if (date && toDate && date > toDate) {
                    setToDate(date);
                  }
                }}
                dateFormat="dd-MM-yyyy"
                className="date-input"
                maxDate={toDate}
              />
            </div>
            <div className="form-group">
              <label>To Date</label>
              <DatePicker
                selected={toDate}
                onChange={(date) => {
                  setToDate(date);
                  // Auto-adjust fromDate if toDate is before fromDate
                  if (date && fromDate && date < fromDate) {
                    setFromDate(date);
                  }
                }}
                dateFormat="dd-MM-yyyy"
                className="date-input"
                minDate={fromDate}
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
            <button 
              onClick={() => { 
                setFromDate(new Date());
                setToDate(new Date());
                setPartyType('');
                setPage(1);
                setLimit(50);
              }} 
              className="btn btn-primary"
            >
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
                <span>?{summary.totalReturns.toFixed(2)}</span>
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
                  <th>Bill Number</th>
                  <th>Party Type</th>
                  <th>Party Name</th>
                  <th>Items Summary</th>
                  <th>Total Return Amount</th>
                  <th>Reason</th>
                  {/* <th>Action</th> */}
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
                      <td>{new Date(txn.created_at).toLocaleString()}</td>
                      <td>{txn.bill_number || '-'}</td>
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
                      <td>
                        <div style={{ maxWidth: '300px' }}>
                          {txn.items_summary ? (
                            <div>
                              <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                                {txn.item_count || 0} item(s)
                              </div>
                              <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                                {txn.items_summary}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#999' }}>No items</span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: '600' }}>?{parseFloat(txn.return_amount || 0).toFixed(2)}</td>
                      <td>{txn.reason || '-'}</td>
                      {/* <td style={{ textAlign: 'center' }}>
                        {txn.bill_number && (
                          <a
                            href={`${config.api.baseUrl}/api/bills/return/${txn.id}/pdf?party_type=${txn.party_type}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-primary"
                            style={{ padding: '4px 12px', fontSize: '12px', textDecoration: 'none', display: 'inline-block' }}
                          >
                            View Bill
                          </a>
                        )}
                      </td> */}
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


