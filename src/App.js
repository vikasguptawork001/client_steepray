import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddItem from './pages/AddItem';
import SellItem from './pages/SellItem';
import AddBuyerParty from './pages/AddBuyerParty';
import AddSellerParty from './pages/AddSellerParty';
import SellReport from './pages/SellReport';
import ReturnReport from './pages/ReturnReport';
import ReturnItem from './pages/ReturnItem';
import OrderSheet from './pages/OrderSheet';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import './App.css';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }
  
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <ToastProvider>
          <Router>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/add-item"
            element={
              <PrivateRoute>
                <AddItem />
              </PrivateRoute>
            }
          />
          <Route
            path="/sell-item"
            element={
              <PrivateRoute>
                <SellItem />
              </PrivateRoute>
            }
          />
          <Route
            path="/add-buyer-party"
            element={
              <PrivateRoute>
                <AddBuyerParty />
              </PrivateRoute>
            }
          />
          <Route
            path="/add-seller-party"
            element={
              <PrivateRoute>
                <AddSellerParty />
              </PrivateRoute>
            }
          />
          <Route
            path="/sell-report"
            element={
              <PrivateRoute>
                <SellReport />
              </PrivateRoute>
            }
          />
          <Route
            path="/return-report"
            element={
              <PrivateRoute>
                <ReturnReport />
              </PrivateRoute>
            }
          />
          <Route
            path="/return-item"
            element={
              <PrivateRoute>
                <ReturnItem />
              </PrivateRoute>
            }
          />
          <Route
            path="/order-sheet"
            element={
              <PrivateRoute>
                <OrderSheet />
              </PrivateRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
    </Provider>
  );
}

export default App;

