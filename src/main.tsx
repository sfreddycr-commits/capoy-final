import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AdminDashboard } from './AdminDashboard';
import './styles.css';
import './admin.css';

const pathname = window.location.pathname.replace(/\/$/, '') || '/';
const isAdminDashboard = pathname === '/admin' || (pathname.startsWith('/admin/') && pathname !== '/admin/login');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isAdminDashboard ? <AdminDashboard/> : <App/>}</React.StrictMode>,
);
