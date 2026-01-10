import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { getLocalDateString } from '../utils/dateUtils';
import './Report.css';

const ItemWiseSellReport = () => {
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [gstFilter, setGstFilter] = useState('all'); // 'all' | 'with_gst' | 'without_gst'
  const [itemQuery, setItemQuery] = useState('');

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [pagination, setPagination] = useState(null);

  const params = useMemo(() => {
    const from = getLocalDateString(fromDate);
    const to = getLocalDateString(toDate);
    return {
      from_date: from,
      to_date: to,
      gst_filter: gstFilter,
      item_query: itemQuery?.trim() || undefined,
      page,
      limit
    };
  }, [fromDate, toDate, gstFilter, itemQuery, page, limit]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(config.api.itemWiseSalesReport, { params });
      setRows(response.data.items || []);
      setSummary(response.data.summary || null);
      setPagination(response.data.pagination || null);
    } catch (error) {
      console.error('Error fetching item-wise sales report:', error);
      alert('Error fetching item-wise sales report');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      const response = await apiClient.get(config.api.itemWiseSalesReportExport, {
        params,
        responseType: 'blob'
      });

      const from = params.from_date;
      const to = params.to_date;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `item_wise_sales_${from}_${to}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting item-wise report:', error);
      alert('Error exporting report');
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.from_date, params.to_date, params.gst_filter]);

  return (
    <Layout>
      <div className="report">
        <div className="report-header">
          <h2>Item-wise Sell Report</h2>
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
            <div className="form-group">
              <label>Item Search</label>
              <input
                className="date-input"
                placeholder="Product / Brand / HSN..."
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
              />
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
                <label>Total Items:</label>
                <span>{summary.totalItems}</span>
              </div>
              <div className="summary-item">
                <label>Total Quantity:</label>
                <span>{Number(summary.totalQuantity || 0).toFixed(0)}</span>
              </div>
              <div className="summary-item">
                <label>Gross Amount:</label>
                <span>₹{Number(summary.totalGross || 0).toFixed(2)}</span>
              </div>
              <div className="summary-item">
                <label>Total Discount:</label>
                <span>₹{Number(summary.totalDiscount || 0).toFixed(2)}</span>
              </div>
              <div className="summary-item">
                <label>Total GST:</label>
                <span>₹{Number(summary.totalGst || 0).toFixed(2)}</span>
              </div>
              <div className="summary-item">
                <label>Net Amount:</label>
                <span>₹{Number(summary.totalNet || 0).toFixed(2)}</span>
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
                  <th>Product</th>
                  <th>Brand</th>
                  <th>HSN</th>
                  <th>Tax %</th>
                  <th>Qty</th>
                  <th>Gross</th>
                  <th>Discount</th>
                  <th>Taxable/Net</th>
                  <th>GST</th>
                  <th>Net</th>
                  <th>Bills</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center' }}>
                      No records found
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.item_id}>
                      <td>{r.product_name}</td>
                      <td>{r.brand || '-'}</td>
                      <td>{r.hsn_number || '-'}</td>
                      <td>{Number(r.tax_rate || 0).toFixed(2)}%</td>
                      <td>{Number(r.total_quantity || 0).toFixed(0)}</td>
                      <td>₹{Number(r.gross_amount || 0).toFixed(2)}</td>
                      <td>₹{Number(r.discount_amount || 0).toFixed(2)}</td>
                      <td>₹{Number(r.taxable_or_net_amount || 0).toFixed(2)}</td>
                      <td>₹{Number(r.gst_amount || 0).toFixed(2)}</td>
                      <td>₹{Number(r.net_amount || 0).toFixed(2)}</td>
                      <td>{r.bills_count}</td>
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

export default ItemWiseSellReport;



