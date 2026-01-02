import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import './Party.css';

const Parties = () => {
  const toast = useToast();
  const [parties, setParties] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all', 'buyer', 'seller'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [buyerParties, setBuyerParties] = useState([]);
  const [sellerParties, setSellerParties] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [buyerPagination, setBuyerPagination] = useState(null);
  const [sellerPagination, setSellerPagination] = useState(null);

  useEffect(() => {
    fetchParties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, filter]);

  const fetchParties = async () => {
    try {
      setLoading(true);
      
      // For "All Parties" view, we need to fetch all parties without pagination
      // For filtered views, use pagination
      if (filter === 'all') {
        // Fetch all parties without pagination for "All" view
        const [buyersResponse, sellersResponse] = await Promise.all([
          apiClient.get(config.api.buyers, { params: { page: 1, limit: 10000 } }),
          apiClient.get(config.api.sellers, { params: { page: 1, limit: 10000 } })
        ]);
        
        setBuyerParties(buyersResponse.data.parties || []);
        setSellerParties(sellersResponse.data.parties || []);
        setBuyerPagination(buyersResponse.data.pagination);
        setSellerPagination(sellersResponse.data.pagination);
        
        // Combine all parties
        const allParties = [
          ...(buyersResponse.data.parties || []).map(p => ({ ...p, party_type: 'buyer' })),
          ...(sellersResponse.data.parties || []).map(p => ({ ...p, party_type: 'seller' }))
        ];
        setParties(allParties);
      } else {
        // For buyer or seller filter, use pagination
        const endpoint = filter === 'buyer' ? config.api.buyers : config.api.sellers;
        const response = await apiClient.get(endpoint, { params: { page, limit } });
        
        if (filter === 'buyer') {
          setBuyerParties(response.data.parties || []);
          setBuyerPagination(response.data.pagination);
        } else {
          setSellerParties(response.data.parties || []);
          setSellerPagination(response.data.pagination);
        }
        
        // Update combined parties for filtered view
        const filteredParties = (response.data.parties || []).map(p => ({ ...p, party_type: filter }));
        setParties(filteredParties);
      }
    } catch (error) {
      console.error('Error fetching parties:', error);
      toast.error('Failed to load parties');
    } finally {
      setLoading(false);
    }
  };

  // Filter parties based on selected filter and search query
  const getFilteredParties = () => {
    let filtered = parties;

    // Filter by type
    if (filter === 'buyer') {
      filtered = buyerParties.map(p => ({ ...p, party_type: 'buyer' }));
    } else if (filter === 'seller') {
      filtered = sellerParties.map(p => ({ ...p, party_type: 'seller' }));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(party =>
        party.party_name?.toLowerCase().includes(query) ||
        party.mobile_number?.includes(query) ||
        party.email?.toLowerCase().includes(query) ||
        party.address?.toLowerCase().includes(query) ||
        party.gst_number?.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => a.party_name.localeCompare(b.party_name));
  };

  const filteredParties = getFilteredParties();

  return (
    <Layout>
      <div className="parties-page">
        <div className="parties-header">
          <h2>Parties</h2>
          <div className="header-actions">
            <Link to="/add-buyer-party" className="btn btn-primary">
              + Add Buyer Party
            </Link>
            <Link to="/add-seller-party" className="btn btn-success">
              + Add Seller Party
            </Link>
          </div>
        </div>

        <div className="card">
          {/* Filter Tabs */}
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => { setFilter('all'); setPage(1); }}
            >
              All Parties ({parties.length})
            </button>
            <button
              className={`filter-tab ${filter === 'buyer' ? 'active' : ''}`}
              onClick={() => { setFilter('buyer'); setPage(1); }}
            >
              Buyer Parties ({buyerParties.length})
            </button>
            <button
              className={`filter-tab ${filter === 'seller' ? 'active' : ''}`}
              onClick={() => { setFilter('seller'); setPage(1); }}
            >
              Seller Parties ({sellerParties.length})
            </button>
          </div>

          {/* Search Bar */}
          <div className="search-container" style={{ marginTop: '20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search by name, mobile, email, address, or GST number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              style={{ flex: 1, minWidth: '200px' }}
            />
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

          {/* Summary Cards */}
          <div className="summary-cards" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '15px',
            marginTop: '20px',
            marginBottom: '20px'
          }}>
            <div className="summary-card" style={{
              padding: '15px',
              backgroundColor: '#e3f2fd',
              borderRadius: '8px',
              border: '1px solid #90caf9'
            }}>
              <div style={{ fontSize: '14px', color: '#1976d2', marginBottom: '5px' }}>Total Parties</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0d47a1' }}>{parties.length}</div>
            </div>
            <div className="summary-card" style={{
              padding: '15px',
              backgroundColor: '#e8f5e9',
              borderRadius: '8px',
              border: '1px solid #81c784'
            }}>
              <div style={{ fontSize: '14px', color: '#388e3c', marginBottom: '5px' }}>Buyer Parties</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1b5e20' }}>{buyerParties.length}</div>
            </div>
            <div className="summary-card" style={{
              padding: '15px',
              backgroundColor: '#fff3e0',
              borderRadius: '8px',
              border: '1px solid #ffb74d'
            }}>
              <div style={{ fontSize: '14px', color: '#f57c00', marginBottom: '5px' }}>Seller Parties</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e65100' }}>{sellerParties.length}</div>
            </div>
            <div className="summary-card" style={{
              padding: '15px',
              backgroundColor: '#f3e5f5',
              borderRadius: '8px',
              border: '1px solid #ba68c8'
            }}>
              <div style={{ fontSize: '14px', color: '#7b1fa2', marginBottom: '5px' }}>Filtered Results</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4a148c' }}>{filteredParties.length}</div>
            </div>
          </div>

          {/* Parties Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="loading">Loading parties...</div>
            </div>
          ) : (
            <div className="table-container">
              {filteredParties.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  {searchQuery ? 'No parties found matching your search' : 'No parties found'}
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Type</th>
                      <th>Party Name</th>
                      <th>Mobile</th>
                      <th>Email</th>
                      <th>Address</th>
                      <th>GST Number</th>
                      <th>Balance Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParties.map((party, index) => (
                      <tr key={`${party.party_type}-${party.id}`}>
                        <td>{index + 1}</td>
                        <td>
                          <span className={`party-type-badge ${party.party_type}`}>
                            {party.party_type === 'buyer' ? 'Buyer' : 'Seller'}
                          </span>
                        </td>
                        <td style={{ fontWeight: '600' }}>{party.party_name}</td>
                        <td>{party.mobile_number || '-'}</td>
                        <td>{party.email || '-'}</td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {party.address || '-'}
                        </td>
                        <td>{party.gst_number || '-'}</td>
                        <td style={{ 
                          fontWeight: '600',
                          color: parseFloat(party.balance_amount || 0) > 0 ? '#d32f2f' : '#388e3c'
                        }}>
                          ₹{parseFloat(party.balance_amount || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px' }}>
                        Total Balance:
                      </td>
                      <td style={{ fontWeight: 'bold', padding: '12px' }}>
                        ₹{filteredParties.reduce((sum, p) => sum + parseFloat(p.balance_amount || 0), 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
              {((filter === 'all' && (buyerPagination || sellerPagination)) || 
                (filter === 'buyer' && buyerPagination) || 
                (filter === 'seller' && sellerPagination)) && 
                ((filter === 'buyer' && buyerPagination?.totalPages > 1) ||
                 (filter === 'seller' && sellerPagination?.totalPages > 1) ||
                 (filter === 'all' && (buyerPagination?.totalPages > 1 || sellerPagination?.totalPages > 1))) && (
                <div className="pagination" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))} 
                    disabled={page === 1}
                    className="btn btn-secondary"
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} of {filter === 'buyer' ? buyerPagination?.totalPages : filter === 'seller' ? sellerPagination?.totalPages : Math.max(buyerPagination?.totalPages || 0, sellerPagination?.totalPages || 0)} 
                    ({filter === 'buyer' ? buyerPagination?.totalRecords : filter === 'seller' ? sellerPagination?.totalRecords : (buyerPagination?.totalRecords || 0) + (sellerPagination?.totalRecords || 0)} total records)
                  </span>
                  <button 
                    onClick={() => setPage(p => {
                      const maxPages = filter === 'buyer' ? buyerPagination?.totalPages : filter === 'seller' ? sellerPagination?.totalPages : Math.max(buyerPagination?.totalPages || 0, sellerPagination?.totalPages || 0);
                      return Math.min(maxPages, p + 1);
                    })} 
                    disabled={page >= (filter === 'buyer' ? buyerPagination?.totalPages : filter === 'seller' ? sellerPagination?.totalPages : Math.max(buyerPagination?.totalPages || 0, sellerPagination?.totalPages || 0))}
                    className="btn btn-secondary"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Parties;

