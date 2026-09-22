import { useEffect } from 'react';

// Updates header (logo + brand) and footer (phones, address, hours, social links)
// whenever the company profile changes. Refreshes on focus so admin edits appear
// the next time the visitor lands on the page.

const PHONE_RE = /\+?[\d][\d\s().-]{6,}/g;

function safeUrl(value, fallback = '#') {
  if (!value) return fallback;
  try {
    const u = new URL(value, window.location.origin);
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'tel:' || u.protocol === 'mailto:' || u.protocol === 'wa') return u.href;
  } catch { /* ignore */ }
  return fallback;
}

function setText(selector, value) {
  if (value === undefined || value === null || value === '') return;
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function setHref(selector, value) {
  if (!value) return;
  const el = document.querySelector(selector);
  if (el) el.setAttribute('href', value);
}

function setStyle(selector, prop, value) {
  if (!value) return;
  const el = document.querySelector(selector);
  if (el) el.style.setProperty(prop, value);
}

function setInner(selector, html) {
  if (!html) return;
  const el = document.querySelector(selector);
  if (el) el.innerHTML = html;
}

function setImage(selector, url) {
  const el = document.querySelector(selector);
  if (!el) return;
  if (url) {
    el.src = url;
    el.style.display = '';
  } else {
    el.src = '';
    el.style.display = 'none';
  }
}

export function PublicCompanyBridge() {
  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function apply() {
      try {
        const r = await fetch('/api/public/company', { credentials: 'omit', cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled || !data?.company) return;
        const c = data.company;

        // Header: brand
        if (c.business_name) {
          const brand = document.querySelector('.brand strong');
          const brandSpan = document.querySelector('.brand span');
          const footerBrand = document.querySelector('.footer-brand strong');
          const footerBrandSpan = document.querySelector('.footer-brand span');
          if (brand) brand.textContent = c.business_name;
          if (brandSpan) brandSpan.textContent = c.business_tagline || 'Costa Rica';
          if (footerBrand) footerBrand.textContent = c.business_name;
          if (footerBrandSpan) footerBrandSpan.textContent = c.company_country || 'Costa Rica';
        }

        // Logo: header (.brand-mark) and footer (.footer-brand .brand-mark)
        if (c.company_logo_url) {
          setStyle('.brand-mark', 'background-image', `url("${c.company_logo_url}")`);
          setStyle('.brand-mark', 'background-size', 'contain');
          setStyle('.brand-mark', 'background-repeat', 'no-repeat');
          setStyle('.brand-mark', 'background-position', 'center');
          setStyle('.brand-mark', 'border', '0');
          setStyle('.brand-mark', 'color', 'transparent');
          setStyle('.footer-brand .brand-mark', 'background-image', `url("${c.company_logo_url}")`);
          setStyle('.footer-brand .brand-mark', 'background-size', 'contain');
          setStyle('.footer-brand .brand-mark', 'background-repeat', 'no-repeat');
          setStyle('.footer-brand .brand-mark', 'background-position', 'center');
          setStyle('.footer-brand .brand-mark', 'border', '0');
          setStyle('.footer-brand .brand-mark', 'color', 'transparent');
        } else {
          setStyle('.brand-mark', 'background-image', '');
          setStyle('.brand-mark', 'border', '');
          setStyle('.brand-mark', 'color', '');
          setStyle('.footer-brand .brand-mark', 'background-image', '');
          setStyle('.footer-brand .brand-mark', 'border', '');
          setStyle('.footer-brand .brand-mark', 'color', '');
        }

        // Header phone CTA
        if (c.company_phone) {
          const navPhone = document.querySelector('.nav-actions .phone');
          if (navPhone) {
            navPhone.textContent = c.company_phone;
            const telHref = `tel:${c.company_phone.replace(/[^+\d]/g, '')}`;
            navPhone.setAttribute('href', telHref);
          }
        }

        // Footer: copy, contact block, hours, legal name
        if (c.company_tagline) setText('.footer-grid > div:first-child > p', c.company_tagline);
        // company_legal_name is intentionally NOT injected into the footer
        // here: that area is React-managed and appending/mutating nodes causes
        // 'removeChild' reconciliation errors on re-renders. The legal name
        // is rendered into the document title (see below) instead.

        // Footer contact block: now managed by React (src/App.tsx) from
        // landing.contact data returned by /api/public/landing. The bridge
        // intentionally does NOT mutate the footer Contacto column anymore
        // to avoid React reconciliation errors (removeChild on detached nodes).

        // Social links: also React-managed now (src/App.tsx renders the
        // .socials div from landing.contact.instagram/facebook/tiktok).
        // Skip innerHTML mutation to avoid React reconciliation errors.

        // Title and meta
        if (c.business_name) document.title = `${c.business_name} | Tours y experiencias`;

        // Favicon
        if (c.company_favicon_url) {
          let link = document.querySelector('link[rel="icon"]');
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = c.company_favicon_url;
        }
      } catch { /* swallow */ }
    }

    apply();
    timer = setInterval(apply, 60000); // refresh every minute
    const onFocus = () => apply();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
  return null;
}
