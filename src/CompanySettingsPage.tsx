import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Building2, Camera, ImageIcon, LayoutDashboard, Loader2, LogOut, Menu, Save, ShieldCheck, Upload, X } from 'lucide-react';

type AdminUser = { id: number; displayName: string; email: string; role: string };

type Settings = Record<string, string>;

const SECTIONS = [
  {
    title: 'Identidad',
    keys: ['business_name', 'company_legal_name', 'company_tax_id', 'company_logo_url', 'company_favicon_url'],
  },
  {
    title: 'Contacto',
    keys: ['company_phone', 'company_whatsapp', 'company_email', 'company_address', 'company_website', 'company_hours', 'company_country'],
  },
  {
    title: 'Mensaje',
    keys: ['company_tagline'],
  },
  {
    title: 'Redes sociales',
    keys: ['social_facebook', 'social_instagram', 'social_tiktok', 'social_youtube', 'social_whatsapp_link'],
  },
  {
    title: 'Sistema',
    keys: ['default_currency', 'currency_symbol', 'timezone'],
  },
];

const LABELS: Record<string, string> = {
  business_name: 'Nombre comercial',
  company_legal_name: 'Razón social',
  company_tax_id: 'Identificación tributaria (RUC / Cédula)',
  company_logo_url: 'URL del logo (alternativa — usa el recuadro arriba)',
  company_favicon_url: 'URL del favicon',
  company_phone: 'Teléfono',
  company_whatsapp: 'WhatsApp (número con código país)',
  company_email: 'Correo electrónico',
  company_address: 'Dirección física',
  company_website: 'Sitio web',
  company_hours: 'Horario de atención',
  company_country: 'País',
  company_tagline: 'Eslogan corto',
  social_facebook: 'Facebook (URL completa)',
  social_instagram: 'Instagram (URL completa)',
  social_tiktok: 'TikTok (URL completa)',
  social_youtube: 'YouTube (URL completa)',
  social_whatsapp_link: 'WhatsApp click-to-chat (URL completa)',
  default_currency: 'Moneda predeterminada',
  currency_symbol: 'Símbolo de moneda (USD → $, CRC → ₡)',
  timezone: 'Zona horaria',
};

const OPTIONS: Record<string, string[]> = {
  default_currency: ['USD', 'CRC'],
  timezone: ['America/Costa_Rica', 'America/Panama', 'America/Guatemala', 'America/Mexico_City', 'America/New_York', 'UTC'],
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(v => v[0]?.toUpperCase()).join('') || 'CA';
}

export function CompanySettingsPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'logo' | 'favicon' | null>(null);
  const [active, setActive] = useState<string>('Identidad');

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const [s, st] = await Promise.all([
        fetch('/api/auth/session', { credentials: 'same-origin' }),
        fetch('/api/admin/settings', { credentials: 'same-origin' }),
      ]);
      if (s.status === 401 || st.status === 401) {
        location.assign('/admin/login');
        return;
      }
      if (!s.ok || !st.ok) {
        const b = await st.json().catch(() => ({}));
        throw new Error(b.error || 'No fue posible cargar la configuración.');
      }
      setUser((await s.json()).user);
      const data = await st.json();
      const flat: Settings = {};
      for (const [k, v] of Object.entries(data.settings || {})) flat[k] = (v as any).value ?? '';
      setSettings(flat);
      setLogoUrl(flat.company_logo_url || null);
      setFaviconUrl(flat.company_favicon_url || null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No fue posible cargar la configuración.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => null);
    location.assign('/admin/login');
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const r = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ settings }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No fue posible guardar la configuración.');
      setMessage(`Configuración guardada correctamente (${d.updated} campos). El sitio público la reflejará al instante.`);
      // Refresh logo preview from server
      setLogoUrl(settings.company_logo_url || null);
      setFaviconUrl(settings.company_favicon_url || null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No fue posible guardar la configuración.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(file: File, type: 'logo' | 'favicon') {
    if (!file.type.startsWith('image/')) {
      setMessage('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('La imagen no debe superar 5 MB.');
      return;
    }
    setUploading(type);
    setMessage('');
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('type', type);
      const r = await fetch('/api/admin/company/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No fue posible subir la imagen.');
      setSettings(s => ({ ...s, [d.settingKey]: d.url }));
      if (type === 'logo') setLogoUrl(d.url);
      else setFaviconUrl(d.url);
      setMessage('Imagen subida correctamente. Recuerda guardar los cambios.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No fue posible subir la imagen.');
    } finally {
      setUploading(null);
    }
  }

  const sections = SECTIONS.filter(s => s.keys.some(k => k in settings || true));
  const activeKeys = SECTIONS.find(s => s.title === active)?.keys ?? [];

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${mobileMenu ? 'open' : ''}`}>
        <div className="admin-logo">
          <div className="admin-logo-mark">C</div>
          <div><strong>Capoy</strong><span>Costa Rica</span></div>
        </div>
        <nav>
          {[
            ['Dashboard', '/admin'],
            ['Reservas', '/admin/reservas'],
            ['Tours', '/admin/tours'],
            ['Clientes', '/admin/clientes'],
            ['Proveedores', '/admin/proveedores'],
            ['Flota', '/admin/flota'],
            ['Reseñas', '/admin/resenas'],
            ['CMS', '/admin/cms'],
            ['Empresa', '/admin/empresa'],
            ['Usuarios', '/admin/usuarios'],
            ['Configuración', '/admin/configuracion'],
          ].map(([n, h]) => (
            <a className={n === 'Empresa' ? 'active' : ''} href={h} key={n}>{n}</a>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <div><ShieldCheck size={16}/> Sesión protegida</div>
          {user && (
            <div className="admin-user">
              <span>{initials(user.displayName)}</span>
              <div><strong>{user.displayName}</strong><small>{user.role}</small></div>
            </div>
          )}
          <button onClick={logout}><LogOut size={17}/> Cerrar sesión</button>
        </div>
      </aside>
      {mobileMenu && <button className="admin-backdrop" onClick={() => setMobileMenu(false)} />}
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <button className="admin-menu" onClick={() => setMobileMenu(true)}><Menu size={20}/></button>
            <a href="/admin"><ArrowLeft size={17}/> Administración</a>
            <span>/</span>
            <strong>Empresa</strong>
          </div>
          {user && <small>{user.email}</small>}
        </header>
        <section className="admin-card">
          <header className="company-header">
            <div>
              <span className="admin-kicker">DATOS DE LA EMPRESA</span>
              <h1>Empresa</h1>
              <p>Información corporativa que aparece en el sitio público. Los cambios se reflejan al instante.</p>
            </div>
            <Building2 size={36}/>
          </header>

          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px 0' }}><Loader2 className="spin"/> Cargando datos…</p>
          ) : (
            <>
              {/* Logo & Favicon uploaders */}
              <section className="company-media">
                <article>
                  <header><strong>Logo de la empresa</strong><small>Aparece en el header y footer del sitio público.</small></header>
                  <div className="company-media-preview">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo actual" />
                    ) : (
                      <div className="company-media-placeholder"><ImageIcon size={36}/><small>Sin logo cargado</small></div>
                    )}
                  </div>
                  <label className="company-file-input">
                    <Upload size={16}/>
                    {uploading === 'logo' ? 'Subiendo…' : 'Subir logo (PNG, JPG, WebP, SVG · máx 5 MB)'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      disabled={uploading !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadFile(f, 'logo');
                      }}
                    />
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      className="company-clear"
                      onClick={() => {
                        setSettings(s => ({ ...s, company_logo_url: '' }));
                        setLogoUrl(null);
                      }}
                    >
                      <X size={14}/> Quitar logo
                    </button>
                  )}
                </article>
                <article>
                  <header><strong>Favicon</strong><small>Icono del navegador (16×16 / 32×32).</small></header>
                  <div className="company-media-preview favicon">
                    {faviconUrl ? (
                      <img src={faviconUrl} alt="Favicon actual" />
                    ) : (
                      <div className="company-media-placeholder"><ImageIcon size={28}/><small>Sin favicon</small></div>
                    )}
                  </div>
                  <label className="company-file-input">
                    <Upload size={16}/>
                    {uploading === 'favicon' ? 'Subiendo…' : 'Subir favicon'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      disabled={uploading !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadFile(f, 'favicon');
                      }}
                    />
                  </label>
                  {faviconUrl && (
                    <button
                      type="button"
                      className="company-clear"
                      onClick={() => {
                        setSettings(s => ({ ...s, company_favicon_url: '' }));
                        setFaviconUrl(null);
                      }}
                    >
                      <X size={14}/> Quitar favicon
                    </button>
                  )}
                </article>
              </section>

              {/* Sections nav (sticky tabs) */}
              <nav className="company-tabs">
                {SECTIONS.map(s => (
                  <button
                    key={s.title}
                    type="button"
                    className={active === s.title ? 'active' : ''}
                    onClick={() => setActive(s.title)}
                  >
                    {s.title}
                  </button>
                ))}
              </nav>

              <form onSubmit={save}>
                <div className="company-grid">
                  {activeKeys.map(key => {
                    const opt = OPTIONS[key];
                    return (
                      <label key={key}>
                        {LABELS[key] || key}
                        {opt ? (
                          <select
                            value={settings[key] ?? ''}
                            onChange={(e) => setSettings(s => ({ ...s, [key]: e.target.value }))}
                          >
                            {opt.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        ) : (
                          <input
                            value={settings[key] ?? ''}
                            onChange={(e) => setSettings(s => ({ ...s, [key]: e.target.value }))}
                            placeholder={key === 'company_tagline' ? 'p. ej. Tours con alma local' : ''}
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
                <footer className="company-actions">
                  <a href="/" target="_blank" rel="noreferrer" className="admin-secondary">Ver sitio público</a>
                  <button className="admin-primary" type="submit" disabled={saving}>
                    <Save size={17}/> {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </footer>
              </form>
            </>
          )}
          {message && <p className={`admin-message ${message.startsWith('Configuración') ? 'success' : 'error'}`} role="status">{message}</p>}
        </section>
      </main>
    </div>
  );
}
