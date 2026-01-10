import React, { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import { numberToWords } from '../utils/numberToWords';
import './SellItemV2.css';

function formatMoney(n) {
  const num = Number(n || 0);
  return `₹${num.toFixed(2)}`;
}

function clampMoney(n) {
  const num = Number(n || 0);
  if (Number.isNaN(num) || !Number.isFinite(num)) return 0;
  return Math.max(0, num);
}

function computeBill({ cartItems, withGst, previousBalancePaid }) {
  let subtotal = 0;
  let totalTaxAmount = 0;

  const computedItems = cartItems.map((it) => {
    const quantity = Math.max(0, parseFloat(it.quantity) || 0);
    const saleRate = Math.max(0, parseFloat(it.sale_rate) || 0);
    const taxRate = Math.max(0, parseFloat(it.tax_rate) || 0);

    const itemTotal = quantity * saleRate;

    // Discount logic: match backend
    let itemDiscount = 0;
    const discountType = it.discount_type || 'amount';
    if (discountType === 'percentage' && it.discount_percentage !== null && it.discount_percentage !== undefined && it.discount_percentage !== '') {
      itemDiscount = (itemTotal * (parseFloat(it.discount_percentage) || 0)) / 100;
    } else {
      itemDiscount = parseFloat(it.discount || 0);
    }
    itemDiscount = Math.min(Math.max(0, itemDiscount), itemTotal);

    const itemTotalAfterDiscount = itemTotal - itemDiscount;
    let taxableValue = itemTotalAfterDiscount;
    let itemTax = 0;
    let itemSubtotal = itemTotalAfterDiscount;

    if (withGst && taxRate > 0) {
      taxableValue = itemTotalAfterDiscount / (1 + taxRate / 100);
      itemTax = itemTotalAfterDiscount - taxableValue;
      itemSubtotal = taxableValue;

      subtotal += taxableValue;
      totalTaxAmount += itemTax;
    } else {
      subtotal += itemSubtotal;
    }

    return {
      ...it,
      quantity,
      saleRate,
      itemTotal,
      itemDiscount,
      itemTotalAfterDiscount,
      taxableValue,
      itemTax,
      taxRate
    };
  });

  const totalAmount = withGst ? (subtotal + totalTaxAmount) : subtotal;
  const prevPaid = clampMoney(previousBalancePaid);
  const grandTotal = totalAmount + prevPaid;

  return {
    items: computedItems,
    subtotal,
    taxAmount: totalTaxAmount,
    totalAmount,
    previousBalancePaid: prevPaid,
    grandTotal
  };
}

const SellItemV2 = () => {
  const toast = useToast();
  const itemSearchRef = useRef(null);
  const sellerSearchRef = useRef(null);

  const [loading, setLoading] = useState({
    sellers: false,
    sellerInfo: false,
    itemSearch: false,
    submit: false,
    pdf: false
  });

  // Seller party (customer) search
  const [sellerParties, setSellerParties] = useState([]);
  const [sellerSearch, setSellerSearch] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [sellerInfo, setSellerInfo] = useState(null);
  const [showSellerSuggest, setShowSellerSuggest] = useState(false);

  // Item search
  const [itemQuery, setItemQuery] = useState('');
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [showItemSuggest, setShowItemSuggest] = useState(false);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState(() => new Set());

  // Cart
  const [cartItems, setCartItems] = useState([]);

  // Bill options
  const [withGst, setWithGst] = useState(false);
  const [payPreviousBalance, setPayPreviousBalance] = useState(false);
  const [previousBalancePaid, setPreviousBalancePaid] = useState(0);

  // Payment
  const [paymentStatus, setPaymentStatus] = useState('fully_paid');
  const [paidAmount, setPaidAmount] = useState(0);

  // Submit result
  const [lastTransactionId, setLastTransactionId] = useState(null);
  const [lastBillNumber, setLastBillNumber] = useState(null);

  // Initial load: sellers
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading((p) => ({ ...p, sellers: true }));
      try {
        const res = await apiClient.get(config.api.sellers);
        const parties = res.data.parties || res.data.sellers || [];
        if (!mounted) return;
        setSellerParties(parties);
      } catch (e) {
        console.error(e);
        toast.error(e.response?.data?.error || 'Failed to load seller parties');
      } finally {
        if (mounted) setLoading((p) => ({ ...p, sellers: false }));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [toast]);

  // Fetch seller info when selected
  useEffect(() => {
    let mounted = true;
    if (!selectedSellerId) {
      setSellerInfo(null);
      return;
    }
    (async () => {
      setLoading((p) => ({ ...p, sellerInfo: true }));
      try {
        const res = await apiClient.get(`${config.api.sellers}/${selectedSellerId}`);
        const party = res.data.party || res.data.seller || null;
        if (!mounted) return;
        setSellerInfo(party);

        // Default previous balance handling
        const bal = clampMoney(party?.balance_amount);
        if (bal > 0 && !payPreviousBalance) {
          setPayPreviousBalance(true);
          setPreviousBalancePaid(bal);
        }
      } catch (e) {
        console.error(e);
        toast.error(e.response?.data?.error || 'Failed to load seller info');
      } finally {
        if (mounted) setLoading((p) => ({ ...p, sellerInfo: false }));
      }
    })();
    return () => {
      mounted = false;
    };
    // intentionally not depending on payPreviousBalance; we only auto-default once on selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSellerId, toast]);

  const filteredSellers = useMemo(() => {
    const q = sellerSearch.trim().toLowerCase();
    if (!q) return sellerParties.slice(0, 30);
    return sellerParties
      .filter((p) => {
        const name = (p.party_name || '').toLowerCase();
        const mobile = (p.mobile_number || '').toString();
        const addr = (p.address || '').toLowerCase();
        return name.includes(q) || mobile.includes(q) || addr.includes(q);
      })
      .slice(0, 30);
  }, [sellerParties, sellerSearch]);

  // Item search with debounce
  useEffect(() => {
    let mounted = true;
    const q = itemQuery.trim();
    if (q.length < 2) {
      setItemSuggestions([]);
      setSelectedSuggestionIds(new Set());
      return;
    }

    const t = setTimeout(async () => {
      setLoading((p) => ({ ...p, itemSearch: true }));
      try {
        const res = await apiClient.get(`${config.api.itemsSearch}?q=${encodeURIComponent(q)}`);
        if (!mounted) return;
        setItemSuggestions(res.data.items || []);
        setShowItemSuggest(true);
      } catch (e) {
        console.error(e);
        toast.error(e.response?.data?.error || 'Failed to search items');
      } finally {
        if (mounted) setLoading((p) => ({ ...p, itemSearch: false }));
      }
    }, 180);

    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [itemQuery, toast]);

  // Close suggestion panels on outside click / ESC
  useEffect(() => {
    const onDown = (e) => {
      if (!e.target.closest('.sell2-suggest')) {
        setShowItemSuggest(false);
        setShowSellerSuggest(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setShowItemSuggest(false);
        setShowSellerSuggest(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const addItemToCart = (item) => {
    setCartItems((prev) => {
      const existing = prev.find((x) => x.item_id === item.id);
      if (existing) {
        return prev.map((x) => (x.item_id === item.id ? { ...x, quantity: (parseFloat(x.quantity) || 0) + 1 } : x));
      }
      return [
        ...prev,
        {
          item_id: item.id,
          product_name: item.product_name,
          product_code: item.product_code,
          brand: item.brand,
          hsn_number: item.hsn_number || '',
          tax_rate: item.tax_rate || 0,
          available_quantity: item.quantity || 0,
          sale_rate: item.sale_rate || 0,
          quantity: 1,
          discount_type: 'percentage',
          discount_percentage: null,
          discount: 0
        }
      ];
    });

    // Keep focus on item search for fast flow (no scroll jump)
    setTimeout(() => itemSearchRef.current?.focus?.({ preventScroll: true }), 0);
  };

  const toggleSuggestion = (id) => {
    setSelectedSuggestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelectedSuggestions = () => {
    if (selectedSuggestionIds.size === 0) {
      toast.warning('Select at least one item from the list');
      return;
    }
    const toAdd = itemSuggestions.filter((it) => selectedSuggestionIds.has(it.id));
    toAdd.forEach(addItemToCart);
    toast.success(`${toAdd.length} item${toAdd.length !== 1 ? 's' : ''} added`);
  };

  const removeCartItem = (itemId) => {
    setCartItems((prev) => prev.filter((x) => x.item_id !== itemId));
  };

  const updateCartItem = (itemId, patch) => {
    setCartItems((prev) => prev.map((x) => (x.item_id === itemId ? { ...x, ...patch } : x)));
  };

  const sellerBalance = clampMoney(sellerInfo?.balance_amount);
  const effectivePreviousBalancePaid = payPreviousBalance ? Math.min(clampMoney(previousBalancePaid), sellerBalance) : 0;

  const bill = useMemo(() => {
    return computeBill({ cartItems, withGst, previousBalancePaid: effectivePreviousBalancePaid });
  }, [cartItems, withGst, effectivePreviousBalancePaid]);

  const effectivePaidAmount = useMemo(() => {
    if (paymentStatus === 'fully_paid') return bill.grandTotal;
    return Math.min(clampMoney(paidAmount), bill.grandTotal);
  }, [paymentStatus, paidAmount, bill.grandTotal]);

  const balanceDue = useMemo(() => {
    return Math.max(0, bill.grandTotal - effectivePaidAmount);
  }, [bill.grandTotal, effectivePaidAmount]);

  const canSubmit = selectedSellerId && cartItems.length > 0 && bill.grandTotal > 0;

  const resetForm = () => {
    setSellerSearch('');
    setSelectedSellerId('');
    setSellerInfo(null);
    setShowSellerSuggest(false);
    setItemQuery('');
    setItemSuggestions([]);
    setShowItemSuggest(false);
    setSelectedSuggestionIds(new Set());
    setCartItems([]);
    setWithGst(false);
    setPayPreviousBalance(false);
    setPreviousBalancePaid(0);
    setPaymentStatus('fully_paid');
    setPaidAmount(0);
    setLastTransactionId(null);
    setLastBillNumber(null);
    setTimeout(() => sellerSearchRef.current?.focus?.({ preventScroll: true }), 0);
  };

  const submitSale = async () => {
    if (!selectedSellerId) return toast.warning('Select a seller party first');
    if (cartItems.length === 0) return toast.warning('Add at least one item');
    if (effectivePaidAmount > bill.grandTotal + 0.0001) return toast.error('Paid amount cannot exceed total');

    // Basic validation: quantity must be > 0 and not exceed available
    for (const it of cartItems) {
      const qty = parseFloat(it.quantity) || 0;
      if (qty <= 0) return toast.error(`Quantity must be > 0 for ${it.product_name}`);
      const avail = parseFloat(it.available_quantity) || 0;
      if (qty > avail) return toast.error(`Insufficient stock for ${it.product_name}. Available: ${avail}`);
    }

    setLoading((p) => ({ ...p, submit: true }));
    try {
      const payload = {
        seller_party_id: selectedSellerId,
        items: cartItems.map((it) => ({
          item_id: it.item_id,
          quantity: parseFloat(it.quantity) || 0,
          sale_rate: parseFloat(it.sale_rate) || 0,
          discount: it.discount_type === 'percentage' ? 0 : (parseFloat(it.discount) || 0),
          discount_type: it.discount_type || 'amount',
          discount_percentage: it.discount_type === 'percentage'
            ? (it.discount_percentage === '' ? null : (it.discount_percentage ?? null))
            : null
        })),
        payment_status: paymentStatus,
        paid_amount: effectivePaidAmount,
        with_gst: withGst,
        previous_balance_paid: effectivePreviousBalancePaid
      };

      const res = await apiClient.post(config.api.sale, payload);
      const txId = res.data?.transaction?.id;
      const billNo = res.data?.transaction?.bill_number;
      setLastTransactionId(txId || null);
      setLastBillNumber(billNo || null);
      toast.success('Sale saved successfully');
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to save sale');
    } finally {
      setLoading((p) => ({ ...p, submit: false }));
    }
  };

  const downloadPdf = async () => {
    if (!lastTransactionId) {
      toast.warning('Save the sale first');
      return;
    }
    setLoading((p) => ({ ...p, pdf: true }));
    try {
      const res = await apiClient.get(config.api.billPdf(lastTransactionId), { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${lastBillNumber || `BILL-${lastTransactionId}`}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to download PDF');
    } finally {
      setLoading((p) => ({ ...p, pdf: false }));
    }
  };

  const invoiceDate = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString();
  }, []);

  const amountInWords = useMemo(() => {
    const rounded = Math.round(bill.grandTotal);
    if (!rounded || rounded <= 0) return '';
    return numberToWords(rounded);
  }, [bill.grandTotal]);

  return (
    <Layout>
      <div className="sell2">
        <div className="sell2-header">
          <div>
            <h2 className="sell2-title">Sell Item 2.0</h2>
            <p className="sell2-subtitle">Fast selling flow + clean bill preview + PDF based on the updated tax invoice template.</p>
          </div>
          <div className="sell2-actions">
            <button className="sell2-btn" onClick={resetForm} type="button">
              Reset
            </button>
            <button className="sell2-btn primary" onClick={submitSale} disabled={!canSubmit || loading.submit} type="button">
              {loading.submit ? 'Saving…' : 'Save Sale'}
            </button>
            <button className="sell2-btn" onClick={downloadPdf} disabled={!lastTransactionId || loading.pdf} type="button">
              {loading.pdf ? 'Downloading…' : 'Download PDF'}
            </button>
          </div>
        </div>

        <div className="sell2-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="sell2-card">
              <div className="sell2-card-hd">
                <h3>Customer (Seller Party)</h3>
                {loading.sellers || loading.sellerInfo ? <span className="sell2-muted">Loading…</span> : null}
              </div>
              <div className="sell2-card-bd">
                <div className="sell2-row">
                  <div className="sell2-field sell2-suggest">
                    <label>Search & select party</label>
                    <input
                      ref={sellerSearchRef}
                      className="sell2-input"
                      value={sellerSearch}
                      onChange={(e) => {
                        setSellerSearch(e.target.value);
                        setShowSellerSuggest(true);
                      }}
                      onFocus={() => setShowSellerSuggest(true)}
                      placeholder="Type name / mobile / address…"
                    />
                    {showSellerSuggest && filteredSellers.length > 0 && (
                      <div className="sell2-suggest-panel" role="listbox" aria-label="Seller suggestions">
                        {filteredSellers.map((p) => (
                          <div
                            key={p.id}
                            className="sell2-suggest-item"
                            onClick={() => {
                              setSelectedSellerId(String(p.id));
                              setSellerSearch(p.party_name);
                              setShowSellerSuggest(false);
                              setTimeout(() => itemSearchRef.current?.focus?.({ preventScroll: true }), 0);
                            }}
                            role="option"
                            aria-selected={String(p.id) === String(selectedSellerId)}
                          >
                            <div />
                            <div>
                              <p className="sell2-suggest-title">{p.party_name}</p>
                              <p className="sell2-suggest-sub">{p.mobile_number ? `Mob: ${p.mobile_number}` : ' '}</p>
                            </div>
                            <span className="sell2-pill">{formatMoney(p.balance_amount || 0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="sell2-field">
                    <label>Bill options</label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#111827', fontWeight: 800 }}>
                        <input
                          type="checkbox"
                          checked={withGst}
                          onChange={(e) => setWithGst(e.target.checked)}
                        />
                        GST Inclusive
                      </label>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#111827', fontWeight: 800 }}>
                        <input
                          type="checkbox"
                          checked={payPreviousBalance}
                          disabled={!sellerInfo || sellerBalance <= 0}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setPayPreviousBalance(next);
                            if (next) setPreviousBalancePaid(sellerBalance);
                            else setPreviousBalancePaid(0);
                          }}
                        />
                        Pay previous balance
                      </label>
                      {payPreviousBalance && (
                        <input
                          className="sell2-mini-input"
                          value={previousBalancePaid}
                          onChange={(e) => setPreviousBalancePaid(clampMoney(e.target.value))}
                          placeholder="Prev paid"
                        />
                      )}
                      {sellerInfo && sellerBalance > 0 && (
                        <span className="sell2-muted">Current balance: {formatMoney(sellerBalance)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {sellerInfo && (
                  <div style={{ marginTop: 12 }} className="sell2-muted">
                    <strong style={{ color: '#111827' }}>{sellerInfo.party_name}</strong>
                    {sellerInfo.address ? ` • ${sellerInfo.address}` : ''}
                    {sellerInfo.gst_number ? ` • GST: ${sellerInfo.gst_number}` : ''}
                  </div>
                )}
              </div>
            </div>

            <div className="sell2-card">
              <div className="sell2-card-hd">
                <h3>Add items</h3>
                {loading.itemSearch ? <span className="sell2-muted">Searching…</span> : null}
              </div>
              <div className="sell2-card-bd">
                <div className="sell2-row">
                  <div className="sell2-field sell2-suggest">
                    <label>Search items</label>
                    <input
                      ref={itemSearchRef}
                      className="sell2-input"
                      value={itemQuery}
                      onChange={(e) => setItemQuery(e.target.value)}
                      onFocus={() => setShowItemSuggest(true)}
                      placeholder="Search by name / code / brand…"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const first = itemSuggestions[0];
                          if (first) {
                            addItemToCart(first);
                            setShowItemSuggest(true);
                          }
                        }
                      }}
                    />
                    {showItemSuggest && itemSuggestions.length > 0 && (
                      <div className="sell2-suggest-panel" role="listbox" aria-label="Item suggestions">
                        {itemSuggestions.map((it) => {
                          const selected = selectedSuggestionIds.has(it.id);
                          return (
                            <div
                              key={it.id}
                              className={`sell2-suggest-item ${selected ? 'selected' : ''}`}
                              onClick={() => addItemToCart(it)}
                              role="option"
                              aria-selected={selected}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleSuggestion(it.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div>
                                <p className="sell2-suggest-title">
                                  {it.product_name} {it.brand ? <span className="sell2-muted">• {it.brand}</span> : null}
                                </p>
                                <p className="sell2-suggest-sub">
                                  {it.product_code ? `Code: ${it.product_code}` : ' '} • Stock: {it.quantity ?? 0} • HSN: {it.hsn_number || '-'} • Tax: {it.tax_rate || 0}%
                                </p>
                              </div>
                              <span className="sell2-pill">{formatMoney(it.sale_rate || 0)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="sell2-field">
                    <label>Multi select</label>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button className="sell2-btn" type="button" onClick={addSelectedSuggestions}>
                        Add Selected
                      </button>
                      <button
                        className="sell2-btn"
                        type="button"
                        onClick={() => setSelectedSuggestionIds(new Set(itemSuggestions.map((x) => x.id)))}
                        disabled={itemSuggestions.length === 0}
                      >
                        Select All
                      </button>
                      <button className="sell2-btn" type="button" onClick={() => setSelectedSuggestionIds(new Set())} disabled={selectedSuggestionIds.size === 0}>
                        Clear
                      </button>
                      <span className="sell2-muted">{selectedSuggestionIds.size} selected</span>
                    </div>
                    <div className="sell2-muted" style={{ marginTop: 8 }}>
                      Tip: Click row to instantly add. Use checkboxes for selecting many items.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sell2-card">
              <div className="sell2-card-hd">
                <h3>Cart</h3>
                <span className="sell2-muted">{cartItems.length} item(s)</span>
              </div>
              <div className="sell2-card-bd">
                {cartItems.length === 0 ? (
                  <div className="sell2-muted">Add items from the search box above.</div>
                ) : (
                  <div className="sell2-table-wrap">
                    <table className="sell2-table">
                      <thead>
                        <tr>
                          <th style={{ width: 60 }}>#</th>
                          <th>Item</th>
                          <th style={{ width: 110 }}>HSN</th>
                          <th style={{ width: 130 }}>Qty</th>
                          <th style={{ width: 140 }}>Rate</th>
                          <th style={{ width: 180 }}>Discount</th>
                          <th style={{ width: 130 }}>Tax %</th>
                          <th style={{ width: 140 }}>Amount</th>
                          <th style={{ width: 120 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bill.items.map((it, idx) => {
                          const over = (parseFloat(it.quantity) || 0) > (parseFloat(it.available_quantity) || 0);
                          return (
                            <tr key={it.item_id} style={{ background: over ? '#fff7ed' : 'transparent' }}>
                              <td>
                                {idx + 1}
                                {over ? <div style={{ marginTop: 6 }}><span className="sell2-badge-warn">Over stock</span></div> : null}
                              </td>
                              <td>
                                <div style={{ fontWeight: 900 }}>{it.product_name}</div>
                                <div className="sell2-muted">
                                  {it.brand ? `Brand: ${it.brand} • ` : ''}
                                  Stock: {it.available_quantity ?? 0}
                                </div>
                              </td>
                              <td>{it.hsn_number || '-'}</td>
                              <td>
                                <input
                                  className="sell2-mini-input"
                                  value={it.quantity}
                                  onChange={(e) => updateCartItem(it.item_id, { quantity: e.target.value })}
                                  inputMode="decimal"
                                />
                              </td>
                              <td>
                                <input
                                  className="sell2-mini-input"
                                  value={it.sale_rate}
                                  onChange={(e) => updateCartItem(it.item_id, { sale_rate: e.target.value })}
                                  inputMode="decimal"
                                />
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <select
                                    className="sell2-select"
                                    style={{ height: 36, borderRadius: 10, width: 120, padding: '0 10px' }}
                                    value={it.discount_type || 'amount'}
                                    onChange={(e) => {
                                      const nextType = e.target.value;
                                      if (nextType === 'percentage') {
                                        updateCartItem(it.item_id, { discount_type: 'percentage', discount_percentage: it.discount_percentage ?? 0, discount: 0 });
                                      } else {
                                        updateCartItem(it.item_id, { discount_type: 'amount', discount: it.discount ?? 0, discount_percentage: null });
                                      }
                                    }}
                                  >
                                    <option value="amount">₹ Amount</option>
                                    <option value="percentage">%</option>
                                  </select>
                                  {it.discount_type === 'percentage' ? (
                                    <input
                                      className="sell2-mini-input"
                                      style={{ width: 90 }}
                                      value={it.discount_percentage ?? ''}
                                      onChange={(e) => updateCartItem(it.item_id, { discount_percentage: e.target.value })}
                                      inputMode="decimal"
                                      placeholder="%"
                                    />
                                  ) : (
                                    <input
                                      className="sell2-mini-input"
                                      style={{ width: 110 }}
                                      value={it.discount ?? ''}
                                      onChange={(e) => updateCartItem(it.item_id, { discount: e.target.value })}
                                      inputMode="decimal"
                                      placeholder="₹"
                                    />
                                  )}
                                </div>
                              </td>
                              <td>
                                <input
                                  className="sell2-mini-input"
                                  style={{ width: 90 }}
                                  value={it.tax_rate}
                                  onChange={(e) => updateCartItem(it.item_id, { tax_rate: e.target.value })}
                                  inputMode="decimal"
                                />
                              </td>
                              <td style={{ fontWeight: 900 }}>
                                {formatMoney(withGst ? it.itemTotalAfterDiscount : it.itemTotalAfterDiscount)}
                              </td>
                              <td>
                                <button className="sell2-btn danger" type="button" onClick={() => removeCartItem(it.item_id)}>
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="sell2-card">
              <div className="sell2-card-hd">
                <h3>Payment</h3>
                <span className="sell2-muted">Paid + balance will reflect in transactions</span>
              </div>
              <div className="sell2-card-bd">
                <div className="sell2-row">
                  <div className="sell2-field">
                    <label>Payment status</label>
                    <select className="sell2-select" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                      <option value="fully_paid">Fully Paid</option>
                      <option value="partially_paid">Partially Paid</option>
                    </select>
                  </div>
                  <div className="sell2-field">
                    <label>Paid amount</label>
                    <input
                      className="sell2-input"
                      value={paymentStatus === 'fully_paid' ? bill.grandTotal : paidAmount}
                      onChange={(e) => setPaidAmount(clampMoney(e.target.value))}
                      disabled={paymentStatus === 'fully_paid'}
                      inputMode="decimal"
                      placeholder="Enter paid amount"
                    />
                  </div>
                </div>
                <div className="sell2-muted" style={{ marginTop: 10 }}>
                  Paid now: <strong style={{ color: '#111827' }}>{formatMoney(effectivePaidAmount)}</strong> • Balance due:{' '}
                  <strong style={{ color: '#111827' }}>{formatMoney(balanceDue)}</strong>
                </div>
              </div>
            </div>

            {loading.submit ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : null}
          </div>

          <div className="sell2-preview">
            <div className="sell2-card">
              <div className="sell2-card-hd">
                <h3>Bill preview</h3>
                <span className="sell2-muted">{lastBillNumber ? `Saved: ${lastBillNumber}` : 'Preview'}</span>
              </div>
              <div className="sell2-invoice">
                <div className="sell2-inv-top">
                  <div className="sell2-inv-company">
                    <h2>Steepray Information Services Private Limited</h2>
                    <p>115/19, J.N. Road, Anakaputhur, Chennai - 600070</p>
                    <p>GSTIN: 33ABCDE1234F1Z5 • Email: info@steepray.com</p>
                  </div>
                  <div className="sell2-inv-title">
                    <span className="tag">TAX INVOICE</span>
                    <p><strong>Invoice #:</strong> {lastBillNumber || '—'}</p>
                    <p><strong>Date:</strong> {invoiceDate}</p>
                  </div>
                </div>

                <div className="sell2-inv-blocks">
                  <div className="sell2-inv-block">
                    <h4>Billed To</h4>
                    <p><strong>{sellerInfo?.party_name || 'Select a party'}</strong></p>
                    <p>{sellerInfo?.address || '—'}</p>
                    <p>{sellerInfo?.mobile_number ? `Mobile: ${sellerInfo.mobile_number}` : ' '}</p>
                    <p>{sellerInfo?.gst_number ? `GST: ${sellerInfo.gst_number}` : ' '}</p>
                  </div>
                  <div className="sell2-inv-block">
                    <h4>Invoice Details</h4>
                    <p>GST Inclusive: <strong>{withGst ? 'Yes' : 'No'}</strong></p>
                    <p>Payment: <strong>{paymentStatus === 'fully_paid' ? 'Fully Paid' : 'Partially Paid'}</strong></p>
                    <p>Paid Now: <strong>{formatMoney(effectivePaidAmount)}</strong></p>
                    <p>Balance Due: <strong>{formatMoney(balanceDue)}</strong></p>
                  </div>
                </div>

                <div className="sell2-inv-mini">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 44 }}>#</th>
                        <th>Item</th>
                        <th style={{ width: 70 }}>Qty</th>
                        <th style={{ width: 86 }}>Rate</th>
                        <th style={{ width: 86 }}>Disc</th>
                        <th style={{ width: 70 }}>Tax%</th>
                        <th style={{ width: 100, textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="sell2-muted">Add items to see preview…</td>
                        </tr>
                      ) : (
                        bill.items.slice(0, 9).map((it, idx) => (
                          <tr key={it.item_id}>
                            <td>{idx + 1}</td>
                            <td>
                              <div style={{ fontWeight: 800 }}>{it.product_name}</div>
                              <div className="sell2-muted" style={{ fontSize: 11 }}>HSN: {it.hsn_number || '-'} {it.brand ? `• ${it.brand}` : ''}</div>
                            </td>
                            <td>{it.quantity}</td>
                            <td>{formatMoney(it.saleRate)}</td>
                            <td>{formatMoney(it.itemDiscount)}</td>
                            <td>{it.taxRate}%</td>
                            <td style={{ textAlign: 'right', fontWeight: 900 }}>{formatMoney(it.itemTotalAfterDiscount)}</td>
                          </tr>
                        ))
                      )}
                      {bill.items.length > 9 ? (
                        <tr>
                          <td colSpan={7} className="sell2-muted">+ {bill.items.length - 9} more item(s)…</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="sell2-inv-totals">
                  <div className="sell2-kv">
                    <span>Taxable value</span>
                    <strong>{formatMoney(bill.subtotal)}</strong>
                  </div>
                  <div className="sell2-kv">
                    <span>Total GST</span>
                    <strong>{formatMoney(bill.taxAmount)}</strong>
                  </div>
                  <div className="sell2-kv">
                    <span>Invoice total</span>
                    <strong>{formatMoney(bill.totalAmount)}</strong>
                  </div>
                  <div className="sell2-kv">
                    <span>Previous balance paid</span>
                    <strong>{formatMoney(bill.previousBalancePaid)}</strong>
                  </div>
                  <div className="sell2-kv grand">
                    <span>Grand total</span>
                    <span>{formatMoney(bill.grandTotal)}</span>
                  </div>
                  <div className="sell2-kv">
                    <span>Paid</span>
                    <strong>{formatMoney(effectivePaidAmount)}</strong>
                  </div>
                  <div className="sell2-kv">
                    <span>Balance due</span>
                    <strong>{formatMoney(balanceDue)}</strong>
                  </div>
                </div>

                <div className="sell2-foot">
                  <div className="sell2-inv-block">
                    <h4>Amount in words</h4>
                    <p>{amountInWords ? `${amountInWords} only` : '—'}</p>
                    <p className="sell2-note">Rounded to nearest rupee for words.</p>
                  </div>
                  <div className="sell2-inv-block">
                    <h4>Bank details</h4>
                    <p><strong>Bank:</strong> HDFC Bank</p>
                    <p><strong>A/C:</strong> 1234567890</p>
                    <p><strong>IFSC:</strong> HDFC0000123</p>
                    <p><strong>UPI:</strong> steepray@hdfc</p>
                  </div>
                </div>

                <div className="sell2-foot">
                  <div className="sell2-inv-block">
                    <h4>Terms &amp; conditions</h4>
                    <p>Goods once sold will not be taken back.</p>
                    <p>Subject to local jurisdiction.</p>
                  </div>
                  <div className="sell2-inv-block">
                    <h4>Authorized signature</h4>
                    <p style={{ marginTop: 26 }}>For Steepray Information Services Pvt Ltd</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SellItemV2;


