import React, { useState } from 'react';
import Layout from '../components/Layout';
import apiClient from '../config/axios';
import config from '../config/config';
import './Party.css';

const AddBuyerParty = () => {
  const [formData, setFormData] = useState({
    party_name: '',
    mobile_number: '',
    email: '',
    address: '',
    opening_balance: 0,
    closing_balance: 0
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post(config.api.buyers, formData);
      alert('Buyer party added successfully!');
      setFormData({
        party_name: '',
        mobile_number: '',
        email: '',
        address: '',
        opening_balance: 0,
        closing_balance: 0
      });
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || 'Unknown error'));
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
                <input
                  type="text"
                  name="party_name"
                  value={formData.party_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Mobile Number</label>
                <input
                  type="text"
                  name="mobile_number"
                  value={formData.mobile_number}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Opening Balance</label>
                <input
                  type="number"
                  name="opening_balance"
                  value={formData.opening_balance}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Closing Balance</label>
                <input
                  type="number"
                  name="closing_balance"
                  value={formData.closing_balance}
                  onChange={handleChange}
                />
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
            <button type="submit" className="btn btn-primary">Add Buyer Party</button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default AddBuyerParty;


