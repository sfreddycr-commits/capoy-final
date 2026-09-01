import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AdminDashboard } from './AdminDashboard';
import { ReservationsPage } from './ReservationsPage';
import './styles.css';
import './admin.css';
import './reservations.css';

const pathname = window.location.pathname.replace(/\/$/, '') || '/';
const isReservations = pathname === '/admin/reservas';
const isAdminDashboard = pathname === '/admin' || (pathname.startsWith('/admin/') && pathname !== '/admin/login');

const screen = isReservations ? <ReservationsPage/> : isAdminDashboard ? <AdminDashboard/> : <App/>;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{screen}</React.StrictMode>);
