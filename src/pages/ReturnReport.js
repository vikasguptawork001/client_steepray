import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { getLocalDateString } from '../utils/dateUtils';
import * as XLSX from 'xlsx';
import ActionMenu from '../components/ActionMenu';
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
  const [showBillDetailsModal, setShowBillDetailsModal] = useState(false);
  const [billDetails, setBillDetails] = useState(null);
  const [loadingBillDetails, setLoadingBillDetails] = useState(false);

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

  const fetchBillDetails = async (txn) => {
    try {
      setLoadingBillDetails(true);
      // For seller returns, use bill_number; for buyer returns, use transaction_id
      const identifier = txn.party_type === 'seller' && txn.bill_number 
        ? txn.bill_number 
        : txn.id || txn.transaction_id;
      const response = await apiClient.get(config.api.returnsBillDetails(identifier));
      setBillDetails(response.data);
      setShowBillDetailsModal(true);
    } catch (error) {
      console.error('Error fetching return bill details:', error);
      alert('Error fetching return bill details. Please try again.');
    } finally {
      setLoadingBillDetails(false);
    }
  };

  const exportToExcel = () => {
    if (exporting || transactions.length === 0) return;
    
    setExporting(true);
    try {
      // Export only the data currently showing on screen (visible/filtered data)
      const data = transactions.map(txn => ({
        'Date': new Date(txn.created_at).toLocaleString(),
        'Bill Number': txn.bill_number || '-',
        'Party Type': txn.party_type === 'buyer' ? 'Buyer' : 'Seller',
        'Party Name': txn.party_name,
        'Items Summary': txn.items_summary || 'No items',
        'Item Count': txn.item_count || 0,
        'Total Return Amount': Math.round(parseFloat(txn.return_amount || 0) * 100) / 100,
        'Reason': txn.reason || '-'
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
      XLSX.utils.book_append_sheet(wb, ws, 'Return Report');
      
      const from = getLocalDateString(fromDate);
      const to = getLocalDateString(toDate);
      XLSX.writeFile(wb, `return_report_${from}_${to}.xlsx`);
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
      <div className="report">
        <div className="report-header">
          <h2>Return Report</h2>
          <button 
            onClick={exportToExcel} 
            className="btn btn-success"
            disabled={exporting || transactions.length === 0}
            style={{
              opacity: (exporting || transactions.length === 0) ? 0.6 : 1,
              cursor: (exporting || transactions.length === 0) ? 'not-allowed' : 'pointer'
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
                  <th>Bill Number</th>
                  <th>Party Type</th>
                  <th>Party Name</th>
                  <th>Items Summary</th>
                  <th>Total Return Amount</th>
                  <th>Reason</th>
                  <th>Actions</th>
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
                      <td style={{ fontWeight: '600' }}>₹{parseFloat(txn.return_amount || 0).toFixed(2)}</td>
                      <td>{txn.reason || '-'}</td>
                      <td>
                        <ActionMenu
                          actions={[
                            {
                              label: 'View',
                              icon: '👁️',
                              onClick: () => fetchBillDetails(txn)
                            }
                          ]}
                          itemId={txn.id}
                          itemName={txn.bill_number || `RET-${txn.id}`}
                        />
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

        {/* Return Bill Details Modal */}
        {showBillDetailsModal && billDetails && (
          <div className="modal-overlay" onClick={(e) => {
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}>
            <div className="modal-content" style={{ maxWidth: '1000px', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Return Bill Details - {billDetails.bill_number || `Transaction #${billDetails.transaction_id}`}</h3>
                <button className="btn-close" onClick={() => {
                  setShowBillDetailsModal(false);
                  setBillDetails(null);
                }}>×</button>
              </div>
              <div className="modal-body">
                {loadingBillDetails ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
                ) : (
                  <>
                    {/* Return Bill Information */}
                    <div style={{ marginBottom: '30px' }}>
                      <h4 style={{ marginBottom: '15px', color: '#333', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>
                        Return Information
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                        <div>
                          <strong>Bill Number:</strong> {billDetails.bill_number || '-'}
                        </div>
                        <div>
                          <strong>Transaction ID:</strong> {billDetails.transaction_id}
                        </div>
                        <div>
                          <strong>Return Date:</strong> {new Date(billDetails.return_date).toLocaleDateString()}
                        </div>
                        <div>
                          <strong>Created At:</strong> {new Date(billDetails.created_at).toLocaleString()}
                        </div>
                        <div>
                          <strong>Party Type:</strong> 
                          <span style={{
                            marginLeft: '10px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: billDetails.party_type === 'buyer' ? '#e3f2fd' : '#fff3e0',
                            color: billDetails.party_type === 'buyer' ? '#1976d2' : '#e65100',
                            fontWeight: 'bold',
                            fontSize: '12px'
                          }}>
                            {billDetails.party_type === 'buyer' ? 'Buyer' : 'Seller'}
                          </span>
                        </div>
                        <div>
                          <strong>Return Type:</strong> {billDetails.return_type || '-'}
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <strong>Reason:</strong> {billDetails.reason || '-'}
                        </div>
                      </div>
                    </div>

                    {/* Party Information */}
                    {billDetails.party && (
                      <div style={{ marginBottom: '30px' }}>
                        <h4 style={{ marginBottom: '15px', color: '#333', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>
                          Party Information
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                          <div>
                            <strong>Party Name:</strong> {billDetails.party.party_name}
                          </div>
                          <div>
                            <strong>Mobile Number:</strong> {billDetails.party.mobile_number || '-'}
                          </div>
                          <div>
                            <strong>Email:</strong> {billDetails.party.email || '-'}
                          </div>
                          <div>
                            <strong>Address:</strong> {billDetails.party.address || '-'}
                          </div>
                          <div>
                            <strong>GST Number:</strong> {billDetails.party.gst_number || '-'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Items Table */}
                    {billDetails.items && billDetails.items.length > 0 && (
                      <div style={{ marginBottom: '30px' }}>
                        <h4 style={{ marginBottom: '15px', color: '#333', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>
                          Items ({billDetails.items.length})
                        </h4>
                        <div style={{ overflowX: 'auto' }}>
                          <table className="table" style={{ width: '100%', fontSize: '14px' }}>
                            <thead>
                              <tr>
                                <th>S.No</th>
                                <th>Product Name</th>
                                <th>Product Code</th>
                                <th>Brand</th>
                                <th>HSN</th>
                                <th>Tax Rate</th>
                                <th>Qty</th>
                                <th>Return Rate</th>
                                <th>Discount</th>
                                <th>Gross</th>
                                <th>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {billDetails.items.map((item, index) => (
                                <tr key={item.item_id}>
                                  <td>{index + 1}</td>
                                  <td>{item.product_name}</td>
                                  <td>{item.product_code || '-'}</td>
                                  <td>{item.brand || '-'}</td>
                                  <td>{item.hsn_number || '-'}</td>
                                  <td>{item.tax_rate}%</td>
                                  <td>{item.quantity}</td>
                                  <td>₹{Math.round(parseFloat(item.return_rate || 0) * 100) / 100}</td>
                                  <td>
                                    {item.discount_type === 'percentage' 
                                      ? `${item.discount_percentage}% (₹${Math.round(parseFloat(item.discount_amount || 0) * 100) / 100})`
                                      : `₹${Math.round(parseFloat(item.discount || 0) * 100) / 100}`
                                    }
                                  </td>
                                  <td>₹{Math.round(parseFloat(item.gross_amount || 0) * 100) / 100}</td>
                                  <td>₹{Math.round(parseFloat(item.total_amount || 0) * 100) / 100}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    {billDetails.summary && (
                      <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ marginBottom: '15px', color: '#333', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>
                          Summary
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', background: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
                          <div>
                            <strong>Total Amount:</strong> ₹{Math.round(parseFloat(billDetails.summary.total_amount || 0) * 100) / 100}
                          </div>
                          <div>
                            <strong>Total Items:</strong> {billDetails.summary.total_items}
                          </div>
                          <div>
                            <strong>Total Quantity:</strong> {billDetails.summary.total_quantity}
                          </div>
                          <div>
                            <strong>Total Gross:</strong> ₹{Math.round(parseFloat(billDetails.summary.total_gross || 0) * 100) / 100}
                          </div>
                          <div>
                            <strong>Total Discount:</strong> ₹{Math.round(parseFloat(billDetails.summary.total_discount || 0) * 100) / 100}
                          </div>
                          <div>
                            <strong>Total Net:</strong> ₹{Math.round(parseFloat(billDetails.summary.total_net || 0) * 100) / 100}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};

export default ReturnReport;


