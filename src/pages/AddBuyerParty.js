import React, { useState } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import { useToast } from '../context/ToastContext';
import './Party.css';

const AddBuyerParty = () => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    party_name: '',
    mobile_number: '',
    email: '',
    address: '',
    opening_balance: 0,
    closing_balance: 0,
    gst_number: ''
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation functions
  const validateEmail = (email) => {
    if (!email) return true; // Optional field
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validateMobile = (mobile) => {
    if (!mobile || mobile.trim().length === 0) {
      return false; // Required field
    }
    const re = /^[0-9]{10}$/;
    return re.test(mobile);
  };

  const validateGST = (gst) => {
    if (!gst) return true; // Optional field
    return /^[A-Za-z0-9]+$/.test(gst) && gst.length <= 20;
  };

  const validateField = (name, value) => {
    let error = '';
    switch (name) {
      case 'party_name':
        if (!value || value.trim().length === 0) {
          error = 'Party name is required';
        } else if (value.length > 255) {
          error = 'Party name must be less than 255 characters';
        }
        break;
      case 'email':
        if (value && !validateEmail(value)) {
          error = 'Invalid email format';
        }
        break;
      case 'mobile_number':
        if (!value || value.trim().length === 0) {
          error = 'Mobile number is required';
        } else if (!validateMobile(value)) {
          error = 'Mobile number must be exactly 10 digits';
        }
        break;
      case 'gst_number':
        if (value && !validateGST(value)) {
          error = 'GST number must be alphanumeric and maximum 20 characters';
        }
        break;
      default:
        break;
    }
    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;

    if (name === 'opening_balance' || name === 'closing_balance') {
      processedValue = value === '' ? 0 : parseFloat(value) || 0;
      setFormData({
        ...formData,
        [name]: processedValue
      });
    } else if (name === 'mobile_number') {
      // Only allow digits, max 10
      processedValue = value.replace(/[^0-9]/g, '').substring(0, 10);
      setFormData({
        ...formData,
        [name]: processedValue
      });
      // Validate on change
      if (touched[name]) {
        const error = validateField(name, processedValue);
        setErrors({ ...errors, [name]: error });
      }
    } else if (name === 'gst_number') {
      // Only allow alphanumeric, max 20
      processedValue = value.replace(/[^A-Za-z0-9]/g, '').substring(0, 20).toUpperCase();
      setFormData({
        ...formData,
        [name]: processedValue
      });
      // Validate on change
      if (touched[name]) {
        const error = validateField(name, processedValue);
        setErrors({ ...errors, [name]: error });
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
      // Validate on change for other fields
      if (touched[name]) {
        const error = validateField(name, value);
        setErrors({ ...errors, [name]: error });
      }
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched({ ...touched, [name]: true });
    const error = validateField(name, value);
    setErrors({ ...errors, [name]: error });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    // Validate all fields
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key]);
      if (error) newErrors[key] = error;
    });

    // Mark all fields as touched
    const allTouched = {};
    Object.keys(formData).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fix the validation errors before submitting');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post(config.api.buyers, formData);
      toast.success('Buyer party added successfully!');
      setFormData({
        party_name: '',
        mobile_number: '',
        email: '',
        address: '',
        opening_balance: 0,
        closing_balance: 0,
        gst_number: ''
      });
      setErrors({});
      setTouched({});
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Unknown error';
      
      // Check for duplicate mobile/email errors and set them in the form
      if (errorMessage.includes('Mobile number already exists')) {
        setErrors(prev => ({ ...prev, mobile_number: 'Mobile number already exists' }));
        setTouched(prev => ({ ...prev, mobile_number: true }));
      } else if (errorMessage.includes('Email already exists')) {
        setErrors(prev => ({ ...prev, email: 'Email already exists' }));
        setTouched(prev => ({ ...prev, email: true }));
      }
      
      toast.error('Error: ' + errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="party-form">
        <h2>Add Buyer Party</h2>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Party Name *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    name="party_name"
                    value={formData.party_name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: errors.party_name ? '2px solid #dc3545' : touched.party_name && !errors.party_name && formData.party_name ? '2px solid #28a745' : '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      backgroundColor: errors.party_name ? '#fff5f5' : touched.party_name && !errors.party_name && formData.party_name ? '#f0fff4' : 'white'
                    }}
                  />
                  {touched.party_name && !errors.party_name && formData.party_name && (
                    <span style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#28a745',
                      fontSize: '18px'
                    }}>✓</span>
                  )}
                </div>
                {errors.party_name && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    marginTop: '6px',
                    padding: '8px 12px',
                    backgroundColor: '#fff5f5',
                    borderRadius: '6px',
                    border: '1px solid #fecaca'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <small style={{ color: '#dc3545', fontSize: '13px', fontWeight: '500' }}>
                      {errors.party_name}
                    </small>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Mobile Number <span style={{ color: '#dc3545' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    name="mobile_number"
                    value={formData.mobile_number}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="10 digits"
                    maxLength={10}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: errors.mobile_number ? '2px solid #dc3545' : touched.mobile_number && !errors.mobile_number && formData.mobile_number ? '2px solid #28a745' : '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      backgroundColor: errors.mobile_number ? '#fff5f5' : touched.mobile_number && !errors.mobile_number && formData.mobile_number ? '#f0fff4' : 'white'
                    }}
                  />
                  {touched.mobile_number && !errors.mobile_number && formData.mobile_number && (
                    <span style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#28a745',
                      fontSize: '18px'
                    }}>✓</span>
                  )}
                </div>
                {errors.mobile_number && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    marginTop: '6px',
                    padding: '8px 12px',
                    backgroundColor: '#fff5f5',
                    borderRadius: '6px',
                    border: '1px solid #fecaca'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <small style={{ color: '#dc3545', fontSize: '13px', fontWeight: '500' }}>
                      {errors.mobile_number}
                    </small>
                  </div>
                )}
                {touched.mobile_number && !errors.mobile_number && formData.mobile_number && (
                  <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {formData.mobile_number.length}/10 digits
                  </small>
                )}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="example@email.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: errors.email ? '2px solid #dc3545' : touched.email && !errors.email && formData.email ? '2px solid #28a745' : '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      backgroundColor: errors.email ? '#fff5f5' : touched.email && !errors.email && formData.email ? '#f0fff4' : 'white'
                    }}
                  />
                  {touched.email && !errors.email && formData.email && (
                    <span style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#28a745',
                      fontSize: '18px'
                    }}>✓</span>
                  )}
                </div>
                {errors.email && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    marginTop: '6px',
                    padding: '8px 12px',
                    backgroundColor: '#fff5f5',
                    borderRadius: '6px',
                    border: '1px solid #fecaca'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <small style={{ color: '#dc3545', fontSize: '13px', fontWeight: '500' }}>
                      {errors.email}
                    </small>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Opening Balance</label>
                <input
                  type="number"
                  step="0.01"
                  name="opening_balance"
                  value={formData.opening_balance === 0 ? '' : formData.opening_balance}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Closing Balance</label>
                <input
                  type="number"
                  step="0.01"
                  name="closing_balance"
                  value={formData.closing_balance === 0 ? '' : formData.closing_balance}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div className="form-group">
                <label>GST Number (Alphanumeric, Max 20)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    name="gst_number"
                    value={formData.gst_number}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    maxLength={20}
                    placeholder="Enter GST number"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: errors.gst_number ? '2px solid #dc3545' : touched.gst_number && !errors.gst_number && formData.gst_number ? '2px solid #28a745' : '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      backgroundColor: errors.gst_number ? '#fff5f5' : touched.gst_number && !errors.gst_number && formData.gst_number ? '#f0fff4' : 'white',
                      textTransform: 'uppercase'
                    }}
                  />
                  {touched.gst_number && !errors.gst_number && formData.gst_number && (
                    <span style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#28a745',
                      fontSize: '18px'
                    }}>✓</span>
                  )}
                </div>
                {errors.gst_number && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    marginTop: '6px',
                    padding: '8px 12px',
                    backgroundColor: '#fff5f5',
                    borderRadius: '6px',
                    border: '1px solid #fecaca'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <small style={{ color: '#dc3545', fontSize: '13px', fontWeight: '500' }}>
                      {errors.gst_number}
                    </small>
                  </div>
                )}
                {touched.gst_number && !errors.gst_number && formData.gst_number && (
                  <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {formData.gst_number.length}/20 characters
                  </small>
                )}
              </div>
            </div>
            <div className="form-group">
              <label>Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="3"
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{
                opacity: isSubmitting ? 0.6 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? 'Adding...' : 'Add Buyer Party'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default AddBuyerParty;


