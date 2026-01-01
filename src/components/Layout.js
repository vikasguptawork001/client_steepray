import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/add-item', label: 'Add Item', roles: ['admin', 'super_admin'] },
    { path: '/sell-item', label: 'Sell Item' },
    { path: '/return-item', label: 'Return Item' },
    { path: '/add-buyer-party', label: 'Add Buyer Party', roles: ['admin', 'super_admin'] },
    { path: '/add-seller-party', label: 'Add Seller Party', roles: ['admin', 'super_admin'] },
    { path: '/sell-report', label: 'Sell Report' },
    { path: '/return-report', label: 'Return Report' },
    { path: '/order-sheet', label: 'Order Sheet' }
  ];

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter(item => {
    if (!item.roles) return true; // No role restriction
    return item.roles.includes(user?.role);
  });

  const getRoleLabel = (role) => {
    const roles = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      sales: 'Sales'
    };
    return roles[role] || role;
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-content">
          <h1>Steepray Info Solutions</h1>
          <div className="header-right">
            <span className="user-info">
              {user?.user_id} ({getRoleLabel(user?.role)})
            </span>
            <button onClick={handleLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="layout-body">
        <nav className={`sidebar ${menuOpen ? 'open' : ''}`}>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
            ☰
          </button>
          <ul className="menu">
            {filteredMenuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={location.pathname === item.path ? 'active' : ''}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="main-content">
          {children}
        </main>
      </div>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <p className="footer-copyright">
              © {new Date().getFullYear()} Steepray Information Services Private Limited. All rights reserved.
            </p>
          </div>
          <div className="footer-section">
            <p className="footer-credits">
              Designed and Developed by <strong>Steepray Info Solutions</strong>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

