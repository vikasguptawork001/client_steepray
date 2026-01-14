import React, { useEffect, useMemo, useState, useRef } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { getLocalDateString } from '../utils/dateUtils';
import * as XLSX from 'xlsx';
import './Report.css';

const ItemWiseSellReport = () => {
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [gstFilter, setGstFilter] = useState('all'); // 'all' | 'with_gst' | 'without_gst'
  const [itemQuery, setItemQuery] = useState('');
  const [debouncedItemQuery, setDebouncedItemQuery] = useState('');
  const debounceTimerRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [pagination, setPagination] = useState(null);

  // Debounce itemQuery for auto-search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedItemQuery(itemQuery);
      setPage(1); // Reset to first page when search changes
    }, 500); // 500ms debounce delay

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [itemQuery]);

  // Validate dates
  const validateDates = () => {
    if (fromDate && toDate && fromDate > toDate) {
      alert('From date cannot be after To date. Please select valid dates.');
      return false;
    }
    return true;
  };

  const params = useMemo(() => {
    const from = getLocalDateString(fromDate);
    const to = getLocalDateString(toDate);
    return {
      from_date: from,
      to_date: to,
      gst_filter: gstFilter,
      item_query: debouncedItemQuery?.trim() || undefined,
      page,
      limit
    };
  }, [fromDate, toDate, gstFilter, debouncedItemQuery, page, limit]);

  const fetchReport = async () => {
    if (!validateDates()) {
      return;
    }
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
    if (!validateDates()) {
      return;
    }
    try {
      // Export ALL results from API, ignoring pagination and search filters
      const from = getLocalDateString(fromDate);
      const to = getLocalDateString(toDate);
      const exportParams = {
        from_date: from,
        to_date: to,
        gst_filter: gstFilter
        // Note: Not including item_query or page/limit to export ALL results
      };
      
      const response = await apiClient.get(config.api.itemWiseSalesReportExport, {
        params: exportParams,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `item_wise_sales_all_${from}_${to}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting item-wise report:', error);
      alert('Error exporting report');
    }
  };

  const exportFilteredToExcel = () => {
    if (rows.length === 0) return;
    
    try {
      const data = rows.map(r => ({
        'Product': r.product_name,
        'Brand': r.brand || '-',
        'HSN': r.hsn_number || '-',
        'Tax %': Number(r.tax_rate || 0).toFixed(2),
        'Qty': Number(r.total_quantity || 0).toFixed(0),
        'Gross': Number(r.gross_amount || 0).toFixed(2),
        'Discount': Number(r.discount_amount || 0).toFixed(2),
        'Taxable/Net': Number(r.taxable_or_net_amount || 0).toFixed(2),
        'GST': Number(r.gst_amount || 0).toFixed(2),
        'Net': Number(r.net_amount || 0).toFixed(2),
        'Bills': r.bills_count
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Item Wise Sales');
      
      const from = params.from_date;
      const to = params.to_date;
      XLSX.writeFile(wb, `item_wise_sales_filtered_${from}_${to}.xlsx`);
      alert('Filtered Excel file exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export. Please try again.');
    }
  };

  useEffect(() => {
    if (validateDates()) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.from_date, params.to_date, params.gst_filter, params.item_query, params.page, params.limit]);

  return (
    <Layout>
      <div className="report">
        <div className="report-header">
          <h2>Item-wise Sell Report</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={exportToExcel} className="btn btn-success">
              Export to Excel
            </button>
            <button 
              onClick={exportFilteredToExcel} 
              className="btn btn-primary"
              disabled={rows.length === 0}
              style={{
                opacity: rows.length === 0 ? 0.6 : 1,
                cursor: rows.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Export to Excel with Filtered
            </button>
          </div>
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

            <button 
              onClick={() => { 
                setFromDate(new Date());
                setToDate(new Date());
                setGstFilter('all');
                setItemQuery('');
                setDebouncedItemQuery('');
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



