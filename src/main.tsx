import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AdminDashboard } from './AdminDashboard';
import { ReservationsPage } from './ReservationsPage';
import { ToursPage } from './ToursPage';
import { CustomersPage } from './CustomersPage';
import './styles.css';
import './admin.css';
import './reservations.css';
import './tours.css';
import './customers.css';
import './login-entry.css';

const pathname = window.location.pathname.replace(/\/$/, '') || '/';
const isReservations = pathname === '/admin/reservas';
const isTours = pathname === '/admin/tours';
const isCustomers = pathname === '/admin/clientes';
const isAdminDashboard = pathname === '/admin' || (pathname.startsWith('/admin/') && pathname !== '/admin/login');

const screen = isReservations ? <ReservationsPage/> : isTours ? <ToursPage/> : isCustomers ? <CustomersPage/> : isAdminDashboard ? <AdminDashboard/> : <App/>;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{screen}</React.StrictMode>);
