import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { getLocalDateString } from '../utils/dateUtils';
import TransactionLoader from '../components/TransactionLoader';
import ActionMenu from '../components/ActionMenu';
import Pagination from '../components/Pagination';
import './Party.css';

const Parties = () => {
  const toast = useToast();
  const { user } = useAuth();
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
  const [selectedParty, setSelectedParty] = useState(null);
  const [showPartyDetailsModal, setShowPartyDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [partyDetails, setPartyDetails] = useState(null);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPagination, setHistoryPagination] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showTransactionDetailsModal, setShowTransactionDetailsModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [transactionDetails, setTransactionDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  // Edit and Delete states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [editFormData, setEditFormData] = useState({
    party_name: '',
    mobile_number: '',
    email: '',
    address: '',
    opening_balance: '',
    closing_balance: '',
    gst_number: ''
  });
  const [updating, setUpdating] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Manage body scroll when transaction is processing
  useEffect(() => {
    if (processingPayment) {
      document.body.classList.add('transaction-loading');
    } else {
      document.body.classList.remove('transaction-loading');
    }
    return () => {
      document.body.classList.remove('transaction-loading');
    };
  }, [processingPayment]);

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

  const handleViewDetails = async (party) => {
    setSelectedParty(party);
    setShowPartyDetailsModal(true);
    setHistoryPage(1);
    await fetchPartyDetails(party);
    await fetchTransactionHistory(party, 1);
  };

  const handleMakePayment = (party) => {
    setSelectedParty(party);
    setPaymentAmount('');
    setPaymentMethod('Cash');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleEdit = (party) => {
    setEditingParty(party);
    setEditFormData({
      party_name: party.party_name || '',
      mobile_number: party.mobile_number || '',
      email: party.email || '',
      address: party.address || '',
      opening_balance: party.opening_balance || '',
      closing_balance: party.closing_balance || '',
      gst_number: party.gst_number || ''
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editingParty || updating) return;

    // Validate required fields
    if (!editFormData.party_name || editFormData.party_name.trim() === '') {
      toast.error('Party name is required');
      return;
    }

    setUpdating(true);
    try {
      const endpoint = editingParty.party_type === 'buyer'
        ? `${config.api.buyers}/${editingParty.id}`
        : `${config.api.sellers}/${editingParty.id}`;

      // Prepare update data - only include fields that have values
      const updateData = {};
      if (editFormData.party_name) updateData.party_name = editFormData.party_name.trim();
      if (editFormData.mobile_number) updateData.mobile_number = editFormData.mobile_number.trim();
      if (editFormData.email) updateData.email = editFormData.email.trim().toLowerCase();
      if (editFormData.address) updateData.address = editFormData.address.trim();
      if (editFormData.opening_balance !== '') updateData.opening_balance = parseFloat(editFormData.opening_balance) || 0;
      if (editFormData.closing_balance !== '') updateData.closing_balance = parseFloat(editFormData.closing_balance) || 0;
      if (editFormData.gst_number) updateData.gst_number = editFormData.gst_number.trim();

      await apiClient.patch(endpoint, updateData);
      toast.success('Party updated successfully!');
      setShowEditModal(false);
      setEditingParty(null);
      fetchParties(); // Refresh the list
    } catch (error) {
      console.error('Error updating party:', error);
      toast.error(error.response?.data?.error || 'Failed to update party');
    } finally {
      setUpdating(false);
    }
  };

  const handleArchive = async (party) => {
    if (!window.confirm(`Are you sure you want to delete "${party.party_name}"? This action cannot be undone.`)) {
      return;
    }

    setArchiving(true);
    try {
      const endpoint = party.party_type === 'buyer'
        ? `${config.api.buyers}/${party.id}`
        : `${config.api.sellers}/${party.id}`;

      await apiClient.delete(endpoint);
      toast.success('Party deleted successfully!');
      fetchParties(); // Refresh the list
    } catch (error) {
      console.error('Error deleting party:', error);
      toast.error(error.response?.data?.error || 'Failed to delete party');
    } finally {
      setArchiving(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleViewTransaction = async (transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionDetailsModal(true);
    setLoadingDetails(true);
    setTransactionDetails(null);

    try {
      const endpoint = `/api/parties/transactions/${transaction.type}/${transaction.id}/details?party_type=${selectedParty.party_type}&party_id=${selectedParty.id}`;
      const response = await apiClient.get(endpoint);
      setTransactionDetails(response.data);
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      toast.error('Failed to load transaction details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchPartyDetails = async (party) => {
    try {
      const endpoint = party.party_type === 'buyer' 
        ? `${config.api.buyers}/${party.id}`
        : `${config.api.sellers}/${party.id}`;
      const response = await apiClient.get(endpoint);
      setPartyDetails(response.data.party);
    } catch (error) {
      console.error('Error fetching party details:', error);
      toast.error('Failed to load party details');
    }
  };

  const fetchTransactionHistory = async (party, pageNum = 1) => {
    try {
      setHistoryLoading(true);
      // Use unified transactions API
      const endpoint = `/api/unified-transactions/party/${party.party_type}/${party.id}`;
      const response = await apiClient.get(endpoint, {
        params: { page: pageNum, limit: 20 }
      });
      setTransactionHistory(response.data.transactions || []);
      setHistoryPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      // Fallback to old API if unified transactions table doesn't exist yet
      if (error.response?.status === 404 || error.response?.status === 500) {
        try {
          const fallbackEndpoint = party.party_type === 'buyer'
            ? `/api/parties/buyers/${party.id}/transactions`
            : `/api/parties/sellers/${party.id}/transactions`;
          const fallbackResponse = await apiClient.get(fallbackEndpoint, {
            params: { page: pageNum, limit: 20 }
          });
          setTransactionHistory(fallbackResponse.data.transactions || []);
          setHistoryPagination(fallbackResponse.data.pagination);
        } catch (fallbackError) {
          toast.error('Failed to load transaction history');
        }
      } else {
        toast.error('Failed to load transaction history');
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedParty || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    setProcessingPayment(true);
    try {
      // Try using unified_transactions API first, fallback to old API
      let response;
      let paymentTransactionId;
      let receiptNumber;
      
      try {
        // Get current party balance for previous_balance
        const partyDetails = await apiClient.get(
          selectedParty.party_type === 'buyer'
            ? `/api/parties/buyers/${selectedParty.id}`
            : `/api/parties/sellers/${selectedParty.id}`
        );
        const currentBalance = parseFloat(partyDetails.data.party.balance_amount || 0);
        const paymentAmt = parseFloat(paymentAmount);
        
        // Create payment using unified_transactions
        const unifiedResponse = await apiClient.post('/api/unified-transactions', {
          party_type: selectedParty.party_type,
          party_id: selectedParty.id,
          transaction_type: 'payment',
          transaction_date: getLocalDateString(),
          previous_balance: currentBalance,
          transaction_amount: 0, // Payments don't create debt
          paid_amount: paymentAmt,
          balance_after: Math.max(0, currentBalance - paymentAmt),
          payment_method: paymentMethod,
          notes: paymentNotes
        });
        
        response = unifiedResponse;
        paymentTransactionId = unifiedResponse.data.transaction?.id;
        receiptNumber = unifiedResponse.data.transaction?.bill_number;
      } catch (unifiedError) {
        // Fallback to old API if unified_transactions table doesn't exist
        console.log('Falling back to old payment API:', unifiedError);
        const endpoint = selectedParty.party_type === 'buyer'
          ? `/api/parties/buyers/${selectedParty.id}/payment`
          : `/api/parties/sellers/${selectedParty.id}/payment`;
        
        response = await apiClient.post(endpoint, {
          amount: parseFloat(paymentAmount),
          payment_date: getLocalDateString(),
          payment_method: paymentMethod,
          notes: paymentNotes
        });
        
        paymentTransactionId = response.data.payment_transaction_id;
        receiptNumber = response.data.receipt_number;
      }
      
      toast.success(`Payment of ₹${parseFloat(paymentAmount).toFixed(2)} recorded successfully!`);
      
      // Download PDF receipt (if receipt endpoint exists)
      if (paymentTransactionId) {
        try {
          const pdfResponse = await apiClient.get(
            `/api/bills/payment/${paymentTransactionId}/pdf?party_type=${selectedParty.party_type}`,
            { responseType: 'blob' }
          );
          
          // Create blob URL and download
          const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `payment_receipt_${receiptNumber || paymentTransactionId}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          toast.success('Payment receipt downloaded!');
        } catch (pdfError) {
          console.error('Error downloading receipt:', pdfError);
          // Don't show error - receipt download is optional
        }
      }
      
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentMethod('Cash');
      setPaymentNotes('');
      
      // Refresh party list and details
      await fetchParties();
      if (showPartyDetailsModal && selectedParty) {
        await fetchPartyDetails(selectedParty);
        await fetchTransactionHistory(selectedParty, historyPage);
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <Layout>
      <TransactionLoader isLoading={processingPayment} type="payment" />
      <div className="parties-page">
        <div className="parties-header">
          <h2>Parties</h2>
          <div className="header-actions">
            {(filter === 'all' || filter === 'buyer') && (
            <Link to="/add-buyer-party" className="btn btn-primary">
              + Add Buyer Party
            </Link>
            )}
            {(filter === 'all' || filter === 'seller') && (
            <Link to="/add-seller-party" className="btn btn-success">
              + Add Seller Party
            </Link>
            )}
          </div>
        </div>

        <div className="card">
          {/* Filter Tabs */}
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => { setFilter('all'); setPage(1); }}
            >
              All Parties ({((buyerPagination?.totalRecords || buyerParties.length) + (sellerPagination?.totalRecords || sellerParties.length))})
            </button>
            <button
              className={`filter-tab ${filter === 'buyer' ? 'active' : ''}`}
              onClick={() => { setFilter('buyer'); setPage(1); }}
            >
              Buyer Parties ({buyerPagination?.totalRecords || buyerParties.length})
            </button>
            <button
              className={`filter-tab ${filter === 'seller' ? 'active' : ''}`}
              onClick={() => { setFilter('seller'); setPage(1); }}
            >
              Seller Parties ({sellerPagination?.totalRecords || sellerParties.length})
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px', color: '#333', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Records per page
              </span>
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', height: '42px' }}
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
            {filter === 'all' && (
              <>
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
              </>
            )}

            {filter === 'buyer' && (
              <div className="summary-card" style={{
                padding: '15px',
                backgroundColor: '#e8f5e9',
                borderRadius: '8px',
                border: '1px solid #81c784'
              }}>
                <div style={{ fontSize: '14px', color: '#388e3c', marginBottom: '5px' }}>Buyer Parties</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1b5e20' }}>{buyerParties.length}</div>
              </div>
            )}

            {filter === 'seller' && (
            <div className="summary-card" style={{
              padding: '15px',
                backgroundColor: '#fff3e0',
              borderRadius: '8px',
                border: '1px solid #ffb74d'
            }}>
                <div style={{ fontSize: '14px', color: '#f57c00', marginBottom: '5px' }}>Seller Parties</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e65100' }}>{sellerParties.length}</div>
            </div>
            )}
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
                  <thead style={{ backgroundColor: '#34495e', color: '#ffffff' }}>
                    <tr>
                      <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600' }}>S.No</th>
                      {filter === 'all' && (
                        <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600' }}>Type</th>
                      )}
                      <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600' }}>Party Name</th>
                      <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600' }}>Mobile</th>
                      <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600' }}>Email</th>
                      <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600' }}>Address</th>
                      <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600' }}>GST Number</th>
                      <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600' }}>Balance Amount</th>
                      <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParties.map((party, index) => (
                      <tr key={`${party.party_type}-${party.id}`}>
                        <td>{index + 1}</td>
                        {filter === 'all' && (
                        <td>
                          <span className={`party-type-badge ${party.party_type}`}>
                            {party.party_type === 'buyer' ? 'Buyer' : 'Seller'}
                          </span>
                        </td>
                        )}
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
                        <td>
                          <div className="inline-action-buttons" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <ActionMenu
                              itemId={party.id}
                              itemName={party.party_name}
                              disabled={archiving}
                              actions={[
                                {
                                  label: 'View Details',
                                  icon: '👁️',
                                  onClick: (id) => handleViewDetails(party)
                                },
                                {
                                  label: 'Make Payment',
                                  icon: '💰',
                                  onClick: (id) => handleMakePayment(party)
                                },
                                ...(user?.role === 'admin' || user?.role === 'super_admin' ? [{
                                  label: 'Edit',
                                  icon: '✏️',
                                  onClick: (id) => handleEdit(party)
                                }] : []),
                                ...(user?.role === 'admin' || user?.role === 'super_admin' ? [{
                                  label: 'Delete',
                                  icon: '🗑️',
                                  danger: true,
                                  onClick: (id) => handleArchive(party),
                                  disabled: archiving
                                }] : [])
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={filter === 'all' ? 8 : 7} style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px' }}>
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
                ((filter === 'buyer' && buyerPagination) ||
                 (filter === 'seller' && sellerPagination) ||
                 (filter === 'all' && (buyerPagination || sellerPagination))) && (
                <Pagination
                  currentPage={page}
                  totalPages={filter === 'buyer' ? buyerPagination?.totalPages || 1 : filter === 'seller' ? sellerPagination?.totalPages || 1 : Math.max(buyerPagination?.totalPages || 0, sellerPagination?.totalPages || 0)}
                  onPageChange={setPage}
                  totalRecords={filter === 'buyer' ? buyerPagination?.totalRecords : filter === 'seller' ? sellerPagination?.totalRecords : (buyerPagination?.totalRecords || 0) + (sellerPagination?.totalRecords || 0)}
                  showTotalRecords={true}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Party Details Modal */}
      {showPartyDetailsModal && selectedParty && partyDetails && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px', maxHeight: '90vh' }}>
            <div className="modal-header">
              <h3>Party Details - {partyDetails.party_name}</h3>
              <button className="modal-close" onClick={() => {
                setShowPartyDetailsModal(false);
                setSelectedParty(null);
                setPartyDetails(null);
                setTransactionHistory([]);
              }}>×</button>
            </div>
            <div className="modal-body">
              {/* Party Metadata */}
              <div style={{ marginBottom: '30px' }}>
                <h4 style={{ marginBottom: '15px', color: '#333', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>
                  Party Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                  <div>
                    <strong>Party Name:</strong> {partyDetails.party_name}
                  </div>
                  <div>
                    <strong>Type:</strong> {selectedParty.party_type === 'buyer' ? 'Buyer' : 'Seller'}
                  </div>
                  <div>
                    <strong>Mobile:</strong> {partyDetails.mobile_number || 'N/A'}
                  </div>
                  <div>
                    <strong>Email:</strong> {partyDetails.email || 'N/A'}
                  </div>
                  <div>
                    <strong>GST Number:</strong> {partyDetails.gst_number || 'N/A'}
                  </div>
                  <div>
                    <strong>Address:</strong> {partyDetails.address || 'N/A'}
                  </div>
                  <div>
                    <strong>Opening Balance:</strong> ₹{parseFloat(partyDetails.opening_balance || 0).toFixed(2)}
                  </div>
                  <div>
                    <strong>Current Balance:</strong> 
                    <span style={{ 
                      color: parseFloat(partyDetails.balance_amount || 0) > 0 ? '#d32f2f' : '#388e3c',
                      fontWeight: '600',
                      marginLeft: '8px'
                    }}>
                      ₹{parseFloat(partyDetails.balance_amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction History */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ margin: 0, color: '#333', borderBottom: '2px solid #3498db', paddingBottom: '10px', flex: 1 }}>
                    Transaction History
                  </h4>
                  <button
                    onClick={() => {
                      setShowPartyDetailsModal(false);
                      handleMakePayment(selectedParty);
                    }}
                    className="btn btn-success"
                    style={{ padding: '8px 16px', fontSize: '13px', marginLeft: '15px' }}
                  >
                    Make Payment
                  </button>
                </div>

                {historyLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>Loading transactions...</div>
                ) : transactionHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    No transactions found
                  </div>
                ) : (
                  <>
                    <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <table className="table">
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#34495e', color: '#ffffff', zIndex: 10 }}>
                          <tr>
                            <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #2c3e50' }}>Date</th>
                            <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #2c3e50' }}>Payment Type</th>
                            <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #2c3e50' }}>Bill/Ref No</th>
                            {/* <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #2c3e50' }}>Description</th> */}
                            <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #2c3e50' }}>Previous Amount</th>
                            <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #2c3e50' }}>Current Transaction</th>
                            <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #2c3e50' }}>Paid Amount</th>
                            <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #2c3e50' }}>Balance Amount</th>
                            {/* <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #2c3e50' }}>Status</th> */}
                            {/* <th style={{ backgroundColor: '#34495e', color: '#ffffff', padding: '12px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #2c3e50' }}>Action</th> */}
                          </tr>
                        </thead>
                        <tbody>
                          {transactionHistory.map((txn, idx) => (
                            <tr key={idx}>
                             <td>{new Date(txn.transaction_timestamp || txn.created_at).toLocaleString()}</td>
                              <td>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  backgroundColor: txn.type === 'sale' ? '#e3f2fd' : txn.type === 'purchase' || txn.type === 'purchase_payment' ? '#fff3e0' : txn.type === 'return' ? '#fce4ec' : '#e8f5e9',
                                  color: txn.type === 'sale' ? '#1976d2' : txn.type === 'purchase' || txn.type === 'purchase_payment' ? '#f57c00' : txn.type === 'return' ? '#c2185b' : '#388e3c'
                                }}>
                                 {txn?.transaction_type}
                                </span>
                              </td>
                              <td>{txn.bill_number || txn.id || '-'}</td>
                              {/* <td>
                                <div style={{ maxWidth: '250px' }}>
                                  <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                                    {txn.description || txn.product_name || (txn.type === 'payment' || txn.type === 'purchase_payment' ? (txn.type === 'purchase_payment' ? 'Purchase Payment' : 'Payment') : 'Transaction')}
                                  </div>
                                  {txn.items_summary && (
                                    <div style={{ 
                                      fontSize: '11px', 
                                      color: '#666', 
                                      fontStyle: 'italic',
                                      marginTop: '4px',
                                      padding: '4px 6px',
                                      backgroundColor: '#f5f5f5',
                                      borderRadius: '4px',
                                      lineHeight: '1.4'
                                    }}>
                                      {txn.item_count && txn.item_count > 1 ? (
                                        <div style={{ fontWeight: '600', color: '#333', marginBottom: '2px' }}>
                                          {txn.item_count} item(s)
                                        </div>
                                      ) : null}
                                      <div>
                                        {txn.items_summary.length > 80 ? txn.items_summary.substring(0, 80) + '...' : txn.items_summary}
                                      </div>
                                    </div>
                                  )}
                                  {txn.type === 'purchase' && !txn.items_summary && (
                                    <div style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>
                                      Purchase transaction
                                    </div>
                                  )}
                                </div>
                              </td> */}
                              <td>
                                <div style={{ fontWeight: '600', color: '#333' }}>
                                  ₹{parseFloat(txn.previous_balance).toFixed(2)}
                                </div>
                                {/* {txn.type === 'purchase' && txn.item_count > 1 && (
                                  <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                                    ({txn.item_count} items)
                                  </div>
                                )} */}
                              </td>
                              <td>
                                {/* {txn.type === 'purchase' || txn.type === 'purchase_payment' ? (
                                  <div>
                                    <div style={{ fontWeight: '600', color: '#2e7d32', marginBottom: '2px' }}>
                                      ₹{parseFloat(txn.paid_amount || txn.amount || 0).toFixed(2)}
                                    </div>
                                  </div>
                                ) : txn.type === 'payment' || txn.type === 'purchase_payment' ? (
                                  <div style={{ fontWeight: '600', color: '#2e7d32' }}>
                                    ₹{parseFloat(txn.paid_amount || txn.amount || 0).toFixed(2)}
                                  </div>
                                ) : (
                                  <div>
                                    ₹{parseFloat(txn.paid_amount || 0).toFixed(2)}
                                  </div>
                                )} */}

                                <div>
                                  ₹{parseFloat(txn.this_transaction_amount).toFixed(2)}
                                </div>
                              </td>
                              <td>
                                <div style={{ 
                                  fontWeight: (txn.type === 'payment' || txn.type === 'purchase_payment') ? '600' : '500',
                                  color: parseFloat(txn.balance_amount || 0) > 0 ? '#d32f2f' : '#2e7d32'
                                }}>
                                  ₹{parseFloat(txn.paid_amount).toFixed(2)}
                                </div>
                              </td>
                                <td>
                                <div >
                                  ₹{parseFloat(txn.balance_after).toFixed(2)}
                                </div>
                              </td>
                              
                              {/* <td>
                                {txn.payment_status && (
                                  <span style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    backgroundColor: txn.payment_status === 'fully_paid' ? '#d4edda' : '#fff3cd',
                                    color: txn.payment_status === 'fully_paid' ? '#155724' : '#856404'
                                  }}>
                                    {txn.payment_status.replace('_', ' ').toUpperCase()}
                                  </span>
                                )}
                              </td> */}
                              {/* <td style={{ textAlign: 'center' }}>
                                <button
                                  onClick={() => handleViewTransaction(txn)}
                                  className="btn btn-sm btn-primary"
                                  style={{ padding: '4px 12px', fontSize: '12px' }}
                                >
                                  View
                                </button>
                              </td> */}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {historyPagination && (
                      <div style={{ 
                        marginTop: '20px', 
                        marginBottom: '10px',
                        padding: '15px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '6px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <Pagination
                          currentPage={historyPage}
                          totalPages={historyPagination.totalPages}
                          onPageChange={(newPage) => {
                            setHistoryPage(newPage);
                            fetchTransactionHistory(selectedParty, newPage);
                          }}
                          totalRecords={historyPagination.totalRecords}
                          showTotalRecords={true}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => {
                setShowPartyDetailsModal(false);
                setSelectedParty(null);
                setPartyDetails(null);
                setTransactionHistory([]);
              }} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Make Payment Modal */}
      {showPaymentModal && selectedParty && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Make Payment - {selectedParty.party_name}</h3>
              <button className="modal-close" onClick={() => {
                setShowPaymentModal(false);
                setSelectedParty(null);
                setPaymentAmount('');
              }}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Current Balance</label>
                <div style={{
                  padding: '15px',
                  backgroundColor: parseFloat(selectedParty.balance_amount || 0) > 0 ? '#fff3cd' : '#d4edda',
                  borderRadius: '6px',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: parseFloat(selectedParty.balance_amount || 0) > 0 ? '#856404' : '#155724',
                  textAlign: 'center'
                }}>
                  ₹{parseFloat(selectedParty.balance_amount || 0).toFixed(2)}
                </div>
              </div>
              <div className="form-group">
                <label>Payment Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={parseFloat(selectedParty.balance_amount || 0)}
                  value={paymentAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    const maxAmount = parseFloat(selectedParty.balance_amount || 0);
                    if (val === '' || (parseFloat(val) >= 0 && parseFloat(val) <= maxAmount)) {
                      setPaymentAmount(val);
                    }
                  }}
                  placeholder="Enter payment amount"
                  style={{ width: '100%', padding: '12px', fontSize: '16px' }}
                />
                <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                  Maximum: ₹{parseFloat(selectedParty.balance_amount || 0).toFixed(2)}
                </small>
              </div>
              {paymentAmount && parseFloat(paymentAmount) > 0 && (
                <div className="form-group">
                  <label>Balance After Payment</label>
                  <div style={{
                    padding: '15px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '6px',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1976d2',
                    textAlign: 'center'
                  }}>
                    ₹{(parseFloat(selectedParty.balance_amount || 0) - parseFloat(paymentAmount || 0)).toFixed(2)}
                  </div>
                </div>
              )}
              {/* Payment Method field hidden - defaulting to 'Cash' */}
              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Add any notes about this payment..."
                  rows="3"
                  style={{ width: '100%', padding: '12px', fontSize: '14px', resize: 'vertical' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedParty(null);
                  setPaymentAmount('');
                  setPaymentMethod('Cash');
                  setPaymentNotes('');
                }}
                className="btn btn-secondary"
                disabled={processingPayment}
              >
                Cancel
              </button>
              <button
                onClick={handlePaymentSubmit}
                className="btn btn-success"
                disabled={processingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}
                style={{ opacity: (processingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0) ? 0.6 : 1 }}
              >
                {processingPayment ? 'Processing...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {showTransactionDetailsModal && selectedTransaction && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px', maxHeight: '90vh' }}>
            <div className="modal-header">
              <h3>
                Transaction Details - {
                  selectedTransaction.type === 'sale' ? 'Sale' : 
                  selectedTransaction.type === 'purchase' ? 'Purchase' : 
                  selectedTransaction.type === 'purchase_payment' ? 'Purchase Payment' : 
                  selectedTransaction.type === 'return' ? 'Return' : 
                  'Payment'
                }
              </h3>
              <button className="modal-close" onClick={() => {
                setShowTransactionDetailsModal(false);
                setSelectedTransaction(null);
                setTransactionDetails(null);
              }}>×</button>
            </div>
            <div className="modal-body">
              {loadingDetails ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading transaction details...</div>
              ) : transactionDetails ? (
                <>
                  {/* Transaction Header    */}
                  <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                      <div>
                        <strong>Date & Time:</strong><br />
                        {new Date(transactionDetails.transaction_date || transactionDetails.return_date || transactionDetails.payment_date || transactionDetails.created_at).toLocaleString()}
                      </div>
                      {(transactionDetails.bill_number || transactionDetails.receipt_number) && (
                        <div>
                          <strong>{(transactionDetails.type === 'payment' || transactionDetails.type === 'purchase_payment') ? 'Receipt' : 'Bill'} Number:</strong><br />
                          {transactionDetails.bill_number || transactionDetails.receipt_number}
                        </div>
                      )}
                      {transactionDetails.summary && (
                        <>
                          <div>
                            <strong>Total Amount:</strong><br />
                            ₹{parseFloat(transactionDetails.summary.total_amount || transactionDetails.summary.amount || 0).toFixed(2)}
                          </div>
                          {transactionDetails.type === 'sale' && (
                            <>
                              <div>
                                <strong>Paid Amount:</strong><br />
                                ₹{parseFloat(transactionDetails.summary.paid_amount || 0).toFixed(2)}
                              </div>
                              <div>
                                <strong>Remaining Balance:</strong><br />
                                ₹{parseFloat(transactionDetails.summary.balance_amount || 0).toFixed(2)}
                              </div>
                            </>
                          )}
                          {transactionDetails.type === 'purchase' && (
                            <>
                              <div>
                                <strong>Total Purchase Amount:</strong><br />
                                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1976d2' }}>
                                  ₹{parseFloat(transactionDetails.summary.total_amount || transactionDetails.summary.amount || selectedTransaction?.amount || 0).toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <strong>Payment Made:</strong><br />
                                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2e7d32' }}>
                                  ₹{parseFloat(transactionDetails.summary.paid_amount || selectedTransaction?.paid_amount || 0).toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <strong>Remaining Balance:</strong><br />
                                <span style={{ fontSize: '18px', fontWeight: 'bold', color: parseFloat(transactionDetails.summary.total_amount || transactionDetails.summary.amount || selectedTransaction?.amount || 0) - parseFloat(transactionDetails.summary.paid_amount || selectedTransaction?.paid_amount || 0) > 0 ? '#d32f2f' : '#2e7d32' }}>
                                  ₹{Math.max(0, parseFloat(transactionDetails.summary.total_amount || transactionDetails.summary.amount || selectedTransaction?.amount || 0) - parseFloat(transactionDetails.summary.paid_amount || selectedTransaction?.paid_amount || 0)).toFixed(2)}
                                </span>
                              </div>
                              {transactionDetails.summary.previous_balance !== undefined && (
                                <div>
                                  <strong>Previous Balance:</strong><br />
                                  ₹{parseFloat(transactionDetails.summary.previous_balance || selectedTransaction?.previous_balance || 0).toFixed(2)}
                                </div>
                              )}
                              {transactionDetails.summary.balance_amount !== undefined && (
                                <div>
                                  <strong>Balance After Transaction:</strong><br />
                                  ₹{parseFloat(transactionDetails.summary.balance_amount || selectedTransaction?.balance_amount || 0).toFixed(2)}
                                </div>
                              )}
                            </>
                          )}
                          {(transactionDetails.type === 'payment' || transactionDetails.type === 'purchase_payment') && (
                            <>
                              <div>
                                <strong>Previous Balance:</strong><br />
                                ₹{parseFloat(transactionDetails.summary.previous_balance || 0).toFixed(2)}
                              </div>
                              <div>
                                <strong>Updated Balance:</strong><br />
                                ₹{parseFloat(transactionDetails.summary.updated_balance || 0).toFixed(2)}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Party Information */}
                  {transactionDetails.party && (
                    <div style={{ marginBottom: '30px' }}>
                      <h4 style={{ marginBottom: '15px', color: '#333', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>
                        Party Information
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                        <div><strong>Name:</strong> {transactionDetails.party.party_name}</div>
                        {transactionDetails.party.mobile_number && (
                          <div><strong>Mobile:</strong> {transactionDetails.party.mobile_number}</div>
                        )}
                        {transactionDetails.party.email && (
                          <div><strong>Email:</strong> {transactionDetails.party.email}</div>
                        )}
                        {transactionDetails.party.gst_number && (
                          <div><strong>GST Number:</strong> {transactionDetails.party.gst_number}</div>
                        )}
                        {transactionDetails.party.address && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <strong>Address:</strong> {transactionDetails.party.address}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Items List */}
                  {transactionDetails.items && transactionDetails.items.length > 0 && (
                    <div style={{ marginBottom: '30px' }}>
                      <h4 style={{ marginBottom: '15px', color: '#333', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>
                        Items ({transactionDetails.items.length})
                      </h4>
                      <div className="table-container">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>S.N.</th>
                              <th>Product Name</th>
                              <th>Brand</th>
                              <th>HSN</th>
                              <th>Quantity</th>
                              <th>Rate</th>
                              {(transactionDetails.type === 'sale' || transactionDetails.type === 'return') && <th>Discount</th>}
                              <th>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactionDetails.items.map((item, idx) => (
                              <tr key={idx}>
                                <td>{idx + 1}</td>
                                <td>{item.product_name}</td>
                                <td>{item.brand || '-'}</td>
                                <td>{item.hsn_number || '-'}</td>
                                <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                                <td>₹{parseFloat(item.sale_rate || item.purchase_rate || item.return_rate || 0).toFixed(2)}</td>
                                {(transactionDetails.type === 'sale' || transactionDetails.type === 'return') && (
                                  <td>
                                    {item.discount && parseFloat(item.discount) > 0 ? (
                                      `${item.discount_type === 'percentage' ? item.discount_percentage + '%' : '₹' + parseFloat(item.discount).toFixed(2)}`
                                    ) : '-'}
                                  </td>
                                )}
                                <td style={{ fontWeight: '600' }}>₹{parseFloat(item.total_amount || 0).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {transactionDetails.summary && (
                    <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
                      <h4 style={{ marginBottom: '15px', color: '#333' }}>Transaction Summary</h4>
                      {transactionDetails.type === 'sale' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                          <div><strong>Subtotal:</strong> ₹{parseFloat(transactionDetails.summary.subtotal || 0).toFixed(2)}</div>
                          {transactionDetails.summary.discount > 0 && (
                            <div><strong>Discount:</strong> ₹{parseFloat(transactionDetails.summary.discount || 0).toFixed(2)}</div>
                          )}
                          {transactionDetails.summary.tax_amount > 0 && (
                            <div><strong>Tax (GST):</strong> ₹{parseFloat(transactionDetails.summary.tax_amount || 0).toFixed(2)}</div>
                          )}
                          <div><strong>Total Amount:</strong> ₹{parseFloat(transactionDetails.summary.total_amount || 0).toFixed(2)}</div>
                          <div><strong>Paid Amount:</strong> ₹{parseFloat(transactionDetails.summary.paid_amount || 0).toFixed(2)}</div>
                          <div><strong>Remaining Balance:</strong> ₹{parseFloat(transactionDetails.summary.balance_amount || 0).toFixed(2)}</div>
                          {transactionDetails.summary.previous_balance_paid > 0 && (
                            <div><strong>Previous Balance Paid:</strong> ₹{parseFloat(transactionDetails.summary.previous_balance_paid || 0).toFixed(2)}</div>
                          )}
                          <div><strong>Payment Status:</strong> {transactionDetails.summary.payment_status?.replace('_', ' ').toUpperCase() || 'N/A'}</div>
                          <div><strong>Total Items:</strong> {transactionDetails.summary.total_items || 0}</div>
                          <div><strong>Total Quantity:</strong> {transactionDetails.summary.total_quantity || 0}</div>
                        </div>
                      )}
                      {transactionDetails.type === 'purchase' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                          <div><strong>Total Items:</strong> {transactionDetails.summary.total_items || transactionDetails.items?.length || 0}</div>
                          <div><strong>Total Quantity:</strong> {transactionDetails.summary.total_quantity || transactionDetails.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0}</div>
                          <div><strong>Total Purchase Amount:</strong> ₹{parseFloat(transactionDetails.summary.total_amount || transactionDetails.summary.amount || 0).toFixed(2)}</div>
                          <div><strong>Payment Made:</strong> ₹{parseFloat(transactionDetails.summary.paid_amount || selectedTransaction?.paid_amount || 0).toFixed(2)}</div>
                          <div><strong>Remaining Balance:</strong> ₹{Math.max(0, parseFloat(transactionDetails.summary.total_amount || transactionDetails.summary.amount || selectedTransaction?.amount || 0) - parseFloat(transactionDetails.summary.paid_amount || selectedTransaction?.paid_amount || 0)).toFixed(2)}</div>
                          {transactionDetails.summary.previous_balance !== undefined && (
                            <div><strong>Previous Balance:</strong> ₹{parseFloat(transactionDetails.summary.previous_balance || selectedTransaction?.previous_balance || 0).toFixed(2)}</div>
                          )}
                          {transactionDetails.summary.balance_amount !== undefined && (
                            <div><strong>Balance After Transaction:</strong> ₹{parseFloat(transactionDetails.summary.balance_amount || selectedTransaction?.balance_amount || 0).toFixed(2)}</div>
                          )}
                          {transactionDetails.summary.payment_status && (
                            <div><strong>Payment Status:</strong> 
                              <span style={{
                                marginLeft: '8px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                backgroundColor: transactionDetails.summary.payment_status === 'fully_paid' ? '#d4edda' : transactionDetails.summary.payment_status === 'partially_paid' ? '#fff3cd' : '#f8d7da',
                                color: transactionDetails.summary.payment_status === 'fully_paid' ? '#155724' : transactionDetails.summary.payment_status === 'partially_paid' ? '#856404' : '#721c24'
                              }}>
                                {transactionDetails.summary.payment_status.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {transactionDetails.type === 'return' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                          <div><strong>Total Items:</strong> {transactionDetails.summary.total_items || 0}</div>
                          <div><strong>Total Quantity:</strong> {transactionDetails.summary.total_quantity || 0}</div>
                          <div><strong>Total Return Amount:</strong> ₹{parseFloat(transactionDetails.summary.total_amount || 0).toFixed(2)}</div>
                          {transactionDetails.reason && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <strong>Reason:</strong> {transactionDetails.reason}
                            </div>
                          )}
                        </div>
                      )}
                      {transactionDetails.type === 'payment' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                          <div><strong>Payment Amount:</strong> ₹{parseFloat(transactionDetails.summary.amount || 0).toFixed(2)}</div>
                          <div><strong>Payment Method:</strong> {transactionDetails.summary.payment_method || 'Cash'}</div>
                          <div><strong>Previous Balance:</strong> ₹{parseFloat(transactionDetails.summary.previous_balance || 0).toFixed(2)}</div>
                          <div><strong>Updated Balance:</strong> ₹{parseFloat(transactionDetails.summary.updated_balance || 0).toFixed(2)}</div>
                          {transactionDetails.summary.notes && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <strong>Notes:</strong> {transactionDetails.summary.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  No transaction details found
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                onClick={() => {
                  setShowTransactionDetailsModal(false);
                  setSelectedTransaction(null);
                  setTransactionDetails(null);
                }}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Party Modal */}
      {showEditModal && editingParty && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Edit {editingParty.party_type === 'buyer' ? 'Buyer' : 'Seller'} Party</h3>
              <button className="modal-close" onClick={() => {
                setShowEditModal(false);
                setEditingParty(null);
                setEditFormData({
                  party_name: '',
                  mobile_number: '',
                  email: '',
                  address: '',
                  opening_balance: '',
                  closing_balance: '',
                  gst_number: ''
                });
              }}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Party Name *</label>
                <input
                  type="text"
                  value={editFormData.party_name}
                  onChange={(e) => setEditFormData({ ...editFormData, party_name: e.target.value })}
                  required
                  placeholder="Enter party name"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Mobile Number</label>
                  <input
                    type="text"
                    value={editFormData.mobile_number}
                    onChange={(e) => setEditFormData({ ...editFormData, mobile_number: e.target.value })}
                    placeholder="Enter mobile number"
                    maxLength={20}
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    placeholder="Enter email address"
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  placeholder="Enter address"
                  rows="3"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Opening Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.opening_balance}
                    onChange={(e) => setEditFormData({ ...editFormData, opening_balance: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Closing Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.closing_balance}
                    onChange={(e) => setEditFormData({ ...editFormData, closing_balance: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>GST Number</label>
                <input
                  type="text"
                  value={editFormData.gst_number}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^A-Za-z0-9]/g, '');
                    if (value.length <= 20) {
                      setEditFormData({ ...editFormData, gst_number: value });
                    }
                  }}
                  placeholder="Enter GST number (alphanumeric, max 20 chars)"
                  maxLength={20}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingParty(null);
                  setEditFormData({
                    party_name: '',
                    mobile_number: '',
                    email: '',
                    address: '',
                    opening_balance: '',
                    closing_balance: '',
                    gst_number: ''
                  });
                }}
                className="btn btn-secondary"
                disabled={updating}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="btn btn-primary"
                disabled={updating}
              >
                {updating ? 'Updating...' : 'Update Party'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Parties;

