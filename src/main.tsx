import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AdminDashboard } from './AdminDashboard';
import { ReservationsPage } from './ReservationsPage';
import './styles.css';
import './admin.css';
import './reservations.css';

const pathname = window.location.pathname.replace(/\/$/, '') || '/';
const isLogin = pathname === '/admin/login' || pathname === '/login';
const isReservations = pathname === '/admin/reservas';
const isAdminDashboard = pathname === '/admin' || (pathname.startsWith('/admin/') && pathname !== '/admin/login');

const screen = isReservations ? <ReservationsPage/> : isAdminDashboard ? <AdminDashboard/> : <App/>;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{screen}</React.StrictMode>);

// Development credential policy: allow temporary QA passwords with a minimum of 8 characters.
// Production credential strength will be restored before launch.
if (isLogin) {
  requestAnimationFrame(() => {
    const passwordInput = document.querySelector<HTMLInputElement>('input[name="password"]');
    if (passwordInput) passwordInput.minLength = 8;
  });
}

// Public entry point to the administrative flow.
// Keep the login reachable from the landing page while CAPOY is in active QA.
if (pathname === '/') {
  requestAnimationFrame(() => {
    const navActions = document.querySelector<HTMLElement>('.nav-actions');
    if (navActions && !navActions.querySelector('[data-admin-login]')) {
      const loginLink = document.createElement('a');
      loginLink.href = '/admin/login';
      loginLink.textContent = 'Iniciar sesión';
      loginLink.setAttribute('data-admin-login', 'true');
      loginLink.setAttribute('aria-label', 'Iniciar sesión en el panel administrativo');
      loginLink.style.display = 'inline-flex';
      loginLink.style.alignItems = 'center';
      loginLink.style.justifyContent = 'center';
      loginLink.style.minHeight = '42px';
      loginLink.style.padding = '0 16px';
      loginLink.style.border = '1px solid rgba(255,255,255,.75)';
      loginLink.style.borderRadius = '999px';
      loginLink.style.color = '#fff';
      loginLink.style.fontWeight = '700';
      loginLink.style.textDecoration = 'none';
      loginLink.style.whiteSpace = 'nowrap';
      navActions.insertBefore(loginLink, navActions.firstChild);
    }

    if (window.innerWidth < 900 && !document.querySelector('[data-admin-login-mobile]')) {
      const mobileLogin = document.createElement('a');
      mobileLogin.href = '/admin/login';
      mobileLogin.textContent = 'Iniciar sesión';
      mobileLogin.setAttribute('data-admin-login-mobile', 'true');
      mobileLogin.setAttribute('aria-label', 'Iniciar sesión en el panel administrativo');
      mobileLogin.style.position = 'fixed';
      mobileLogin.style.right = '16px';
      mobileLogin.style.bottom = '16px';
      mobileLogin.style.zIndex = '9999';
      mobileLogin.style.display = 'inline-flex';
      mobileLogin.style.alignItems = 'center';
      mobileLogin.style.justifyContent = 'center';
      mobileLogin.style.minHeight = '46px';
      mobileLogin.style.padding = '0 18px';
      mobileLogin.style.borderRadius = '999px';
      mobileLogin.style.background = '#fff';
      mobileLogin.style.color = '#173b2d';
      mobileLogin.style.fontWeight = '800';
      mobileLogin.style.textDecoration = 'none';
      mobileLogin.style.boxShadow = '0 10px 30px rgba(0,0,0,.20)';
      document.body.appendChild(mobileLogin);
    }
  });
}
