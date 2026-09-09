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
        if (c.company_legal_name) {
          const legalEl = document.querySelector('.footer-grid > div:first-child small');
          if (!legalEl) {
            const footerCol = document.querySelector('.footer-grid > div:first-child');
            if (footerCol) {
              const small = document.createElement('small');
              small.style.cssText = 'display:block;color:#a8b8af;font-size:9px;margin-top:4px;';
              small.textContent = c.company_legal_name;
              footerCol.appendChild(small);
            }
          } else legalEl.textContent = c.company_legal_name;
        }

        // Footer contact block (replaces the hardcoded phone/email/location)
        if (c.company_phone || c.company_email || c.company_address || c.company_hours) {
          const footer = document.querySelector('.footer-grid');
          if (footer) {
            // Find or rebuild the "Contacto" column (4th child)
            let contact = footer.children[3];
            if (contact) {
              contact.innerHTML = '<b>Contacto</b>';
              if (c.company_phone) {
                const phoneA = document.createElement('span');
                phoneA.innerHTML = `<a href="tel:${String(c.company_phone).replace(/[^+\d]/g,'')}" style="color:inherit;text-decoration:none">${c.company_phone}</a>`;
                contact.appendChild(phoneA);
              }
              if (c.company_whatsapp) {
                const waA = document.createElement('span');
                const waClean = String(c.company_whatsapp).replace(/[^+\d]/g, '');
                waA.innerHTML = `<a href="https://wa.me/${waClean}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">WhatsApp · ${c.company_whatsapp}</a>`;
                contact.appendChild(waA);
              }
              if (c.company_email) {
                const emA = document.createElement('span');
                emA.innerHTML = `<a href="mailto:${c.company_email}" style="color:inherit;text-decoration:none">${c.company_email}</a>`;
                contact.appendChild(emA);
              }
              if (c.company_address) {
                const addr = document.createElement('span');
                addr.textContent = c.company_address;
                contact.appendChild(addr);
              }
              if (c.company_hours) {
                const hrs = document.createElement('span');
                hrs.textContent = c.company_hours;
                contact.appendChild(hrs);
              }
              if (c.company_website) {
                const w = document.createElement('span');
                w.innerHTML = `<a href="${c.company_website}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${c.company_website.replace(/^https?:\/\//,'')}</a>`;
                contact.appendChild(w);
              }
            }
          }
        }

        // Social links (small dots in footer, first column)
        const socials = document.querySelector('.footer-grid > div:first-child .socials');
        if (socials) {
          const socialItems = [
            ['facebook', c.social_facebook],
            ['instagram', c.social_instagram],
            ['tiktok', c.social_tiktok],
            ['youtube', c.social_youtube],
            ['whatsapp', c.social_whatsapp_link],
          ].filter(([, url]) => !!url);
          if (socialItems.length) {
            socials.innerHTML = socialItems.map(([key, url]) => {
              const label = ({ facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', whatsapp: 'WhatsApp' })[key] || key;
              return `<a href="${url}" target="_blank" rel="noopener" aria-label="${label}" style="color:inherit;text-decoration:none;margin-right:8px">${label}</a>`;
            }).join(' · ');
          }
        }

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
