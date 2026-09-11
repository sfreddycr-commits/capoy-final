import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, Eye, EyeOff, History, Loader2, RotateCcw, Save, Search, Settings as SettingsIcon, ShieldCheck, ShieldOff, Upload, X } from 'lucide-react';

type AdminUser = { id: number; displayName: string; email: string; role: string; twoFactorEnabled: boolean };
type Setting = { value: string; updatedAt: string; updatedBy: { id: number; displayName: string; email: string } | null };
type SettingsMap = Record<string, Setting>;
type Session = { id: number; ipAddress: string | null; userAgent: string; createdAt: string; expiresAt: string; current: boolean };
type AuditEvent = { id: number; eventType: string; displayName: string | null; email: string | null; metadata: Record<string, unknown> | null; createdAt: string };

const HINTS: Record<string, string> = {
  business_name: 'Nombre comercial que aparece en correos y comprobantes.',
  timezone: 'Zona horaria usada para todas las fechas del sistema.',
  default_currency: 'Moneda predeterminada al crear nuevos tours.',
  default_language: 'Idioma por defecto para el público si no se especifica otro.',
  booking_email: 'Correo donde llegan las nuevas reservas.',
  booking_phone: 'Teléfono que se muestra en la landing de reservas.',
  reservation_prefix: 'Prefijo corto (mayúsculas/números/guión) para códigos de reserva.',
  maintenance_mode: 'Cuando está activo, el sitio público muestra un mensaje en vez del contenido.',
  company_legal_name: 'Razón social para facturas y documentos legales.',
  company_tax_id: 'Identificación tributaria de la empresa.',
  company_phone: 'Teléfono principal de la empresa.',
  company_whatsapp: 'Número de WhatsApp en formato internacional (ej. +506 8888 8888).',
  company_email: 'Correo corporativo de contacto.',
  company_address: 'Dirección física de la oficina.',
  company_hours: 'Horario de atención mostrado al público.',
  company_tagline: 'Eslogan corto (aparece en el footer y los correos).',
  company_country: 'País de operación.',
  company_website: 'Sitio web oficial.',
  company_logo_url: 'URL del logo principal (PNG/SVG recomendado).',
  company_favicon_url: 'URL del favicon (ICO/PNG, 32×32 o 64×64).',
  currency_symbol: 'Símbolo que se muestra junto a los precios.',
  social_facebook: 'URL completa de Facebook.',
  social_instagram: 'URL completa de Instagram.',
  social_tiktok: 'URL completa de TikTok.',
  social_whatsapp_link: 'Enlace wa.me/XXXXXXXXXX para abrir WhatsApp.',
  social_youtube: 'URL completa del canal de YouTube.',
};

const SECTIONS: Array<{ key: string; title: string; description: string; keys: string[] }> = [
  {
    key: 'general', title: 'Operación general', description: 'Ajustes base que afectan al sistema completo.',
    keys: ['business_name', 'timezone', 'reservation_prefix', 'maintenance_mode'],
  },
  {
    key: 'company', title: 'Empresa y contacto', description: 'Datos corporativos y cómo te encuentran los clientes.',
    keys: ['company_legal_name', 'company_tax_id', 'company_country', 'company_phone', 'company_whatsapp', 'company_email', 'company_address', 'company_hours', 'company_tagline', 'company_website', 'booking_email', 'booking_phone'],
  },
  {
    key: 'money', title: 'Moneda e idioma', description: 'Lo que ven los clientes en precios y textos.',
    keys: ['default_currency', 'currency_symbol', 'default_language'],
  },
  {
    key: 'brand', title: 'Identidad visual', description: 'Logo y favicon que aparecen en el sitio y los correos.',
    keys: ['company_logo_url', 'company_favicon_url'],
  },
  {
    key: 'social', title: 'Redes sociales', description: 'Enlaces a redes que se muestran en el footer.',
    keys: ['social_facebook', 'social_instagram', 'social_tiktok', 'social_whatsapp_link', 'social_youtube'],
  },
];

const SELECT_OPTIONS: Record<string, string[]> = {
  timezone: ['America/Costa_Rica', 'America/Panama', 'America/Guatemala', 'America/Mexico_City', 'America/New_York', 'UTC'],
  default_currency: ['USD', 'CRC'],
  currency_symbol: ['$', '₡', '€', '£', '¥', 'USD', 'CRC'],
  default_language: ['es', 'en'],
  maintenance_mode: ['false', 'true'],
};

function formatDate(value: string): string {
  try {
    const d = new Date(value);
    const now = Date.now();
    const diff = (now - d.getTime()) / 1000;
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return value;
  }
}

function FieldInput({
  settingKey, value, original, editable, sensitive, onChange,
}: {
  settingKey: string; value: string; original: string; editable: boolean; sensitive: boolean;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const options = SELECT_OPTIONS[settingKey];
  const isDirty = value !== original;

  if (options) {
    return (
      <select value={value} disabled={!editable} onChange={(e) => onChange(e.target.value)} className={isDirty ? 'is-dirty' : ''}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {settingKey === 'maintenance_mode' ? (opt === 'true' ? 'Activado' : 'Desactivado') : opt}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="field-input-wrap">
      <input
        type={sensitive && !show ? 'password' : 'text'}
        value={value}
        disabled={!editable}
        onChange={(e) => onChange(e.target.value)}
        placeholder={HINTS[settingKey] ?? ''}
        className={isDirty ? 'is-dirty' : ''}
        autoComplete="off"
      />
      {sensitive && (
        <button type="button" className="field-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar valor' : 'Mostrar valor'}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}
      {isDirty && <span className="field-dirty-dot" title="Cambio sin guardar" />}
    </div>
  );
}

function Toast({ tone, message, onClose }: { tone: 'ok' | 'err'; message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`settings-toast ${tone}`} role="status">
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Cerrar notificación"><X size={16} /></button>
    </div>
  );
}

export function SettingsPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [sessions, setSessions] = useState<Session[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ tone: 'ok' | 'err'; message: string } | null>(null);
  const [showMaintenanceConfirm, setShowMaintenanceConfirm] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const initialRef = useRef<Record<string, string> | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [sessionRes, settingsRes] = await Promise.all([
          fetch('/api/auth/session', { credentials: 'same-origin' }),
          fetch('/api/admin/settings', { credentials: 'same-origin' }),
        ]);
        if (sessionRes.status === 401 || settingsRes.status === 401) {
          location.assign('/admin/login');
          return;
        }
        const sessionData = await sessionRes.json();
        const settingsData = await settingsRes.json();
        setUser(sessionData.user);
        setSettings(settingsData.settings || {});
        const initial = Object.fromEntries(
          Object.entries(settingsData.settings || {}).map(([k, v]) => [k, (v as Setting).value]),
        );
        setDraft(initial);
        initialRef.current = initial;

        if (sessionData.user?.role === 'owner') {
          fetch('/api/admin/sessions', { credentials: 'same-origin' })
            .then((r) => r.ok ? r.json() : { sessions: [] })
            .then((d) => setSessions(d.sessions || []))
            .catch(() => null);
          fetch('/api/admin/audit?eventType=settings_updated&limit=10', { credentials: 'same-origin' })
            .then((r) => r.ok ? r.json() : { events: [] })
            .then((d) => setAudit(d.events || []))
            .catch(() => null);
        }
      } catch {
        setToast({ tone: 'err', message: 'No fue posible cargar la configuración.' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const editable = user?.role === 'owner';
  const dirtyKeys = useMemo(() => Object.keys(draft).filter((k) => draft[k] !== (settings[k]?.value ?? '')), [draft, settings]);
  const isDirty = dirtyKeys.length > 0;
  const maintenanceOn = draft.maintenance_mode === 'true';
  const maintenanceWasOn = settings.maintenance_mode?.value === 'true';

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDirty) return;
    if (maintenanceOn !== maintenanceWasOn && maintenanceOn && !showMaintenanceConfirm) {
      setShowMaintenanceConfirm(true);
      return;
    }
    setShowMaintenanceConfirm(false);
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const k of dirtyKeys) payload[k] = draft[k];
      const r = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ settings: payload }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || 'No fue posible guardar.');
      setToast({ tone: 'ok', message: `${body.updated || dirtyKeys.length} ajustes guardados.` });
      const settingsRes = await fetch('/api/admin/settings', { credentials: 'same-origin' });
      const data = await settingsRes.json();
      setSettings(data.settings || {});
      setDraft(Object.fromEntries(Object.entries(data.settings || {}).map(([k, v]) => [k, (v as Setting).value])));
    } catch (e) {
      setToast({ tone: 'err', message: e instanceof Error ? e.message : 'No fue posible guardar.' });
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (!initialRef.current) return;
    setDraft({ ...initialRef.current });
    setShowMaintenanceConfirm(false);
  }

  function update(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function revokeSession(id: number) {
    setRevokingSessionId(id);
    try {
      const r = await fetch(`/api/admin/sessions/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setToast({ tone: 'err', message: body.error || 'No fue posible revocar la sesión.' });
        return;
      }
      setSessions((s) => s.filter((x) => x.id !== id));
      setToast({ tone: 'ok', message: 'Sesión revocada.' });
    } finally {
      setRevokingSessionId(null);
    }
  }

  function exportSettings() {
    window.location.href = '/api/admin/settings/export';
  }

  async function importSettings(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 256 * 1024) {
      setToast({ tone: 'err', message: 'El archivo es demasiado grande (máx 256 KB).' });
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming = parsed?.settings && typeof parsed.settings === 'object' ? parsed.settings : parsed;
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        throw new Error('Archivo inválido.');
      }
      const r = await fetch('/api/admin/settings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ settings: incoming }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || 'No fue posible importar.');
      setToast({ tone: 'ok', message: `${body.imported || 0} ajustes importados. Revisa y guarda los cambios.` });
      const settingsRes = await fetch('/api/admin/settings', { credentials: 'same-origin' });
      const data = await settingsRes.json();
      setSettings(data.settings || {});
      setDraft(Object.fromEntries(Object.entries(data.settings || {}).map(([k, v]) => [k, (v as Setting).value])));
    } catch (e) {
      setToast({ tone: 'err', message: e instanceof Error ? e.message : 'No fue posible importar.' });
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = '';
    }
  }

  function resetField(key: string) {
    const original = settings[key]?.value ?? '';
    setDraft((d) => ({ ...d, [key]: original }));
  }

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS
      .map((s) => ({
        ...s,
        keys: s.keys.filter((k) => {
          const label = k.replace(/_/g, ' ');
          const hint = HINTS[k] ?? '';
          return label.toLowerCase().includes(q) || k.toLowerCase().includes(q) || hint.toLowerCase().includes(q);
        }),
      }))
      .filter((s) => s.keys.length > 0);
  }, [search]);

  const totalMatches = filteredSections.reduce((sum, s) => sum + s.keys.length, 0);

  return (
    <div className="admin-shell settings-shell">
      {toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}
      <aside className="admin-sidebar">
        <div className="admin-logo"><div className="admin-logo-mark">C</div><div><strong>Capoy</strong><span>Costa Rica</span></div></div>
        <nav>
          {[['Dashboard','/admin'],['Reservas','/admin/reservas'],['Tours','/admin/tours'],['Clientes','/admin/clientes'],['Proveedores','/admin/proveedores'],['Flota','/admin/flota'],['Reseñas','/admin/resenas'],['CMS','/admin/cms'],['Empresa','/admin/empresa'],['Usuarios','/admin/usuarios'],['Configuración','/admin/configuracion']].map(([n, h]) => (
            <a className={n === 'Configuración' ? 'active' : ''} href={h} key={n}>{n}</a>
          ))}
        </nav>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-kicker">SISTEMA</span>
            <h1>Configuración</h1>
            <p>Ajustes operativos generales de CAPOY. Los secretos permanecen fuera de esta pantalla.</p>
          </div>
          <SettingsIcon size={30} />
        </header>

        {loading && <div className="admin-state"><Loader2 className="spin" size={18} /> Cargando…</div>}

        {!loading && user && (
          <>
            {editable && (
              <div className="settings-toolbar">
                <div className="settings-search">
                  <Search size={16} />
                  <input
                    type="search"
                    placeholder="Buscar ajuste por nombre o descripción…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={14} /></button>
                  )}
                </div>
                <div className="settings-toolbar-info">
                  {search && <span>{totalMatches} resultado{totalMatches === 1 ? '' : 's'}</span>}
                </div>
                <div className="settings-toolbar-actions">
                  <button type="button" className="settings-toolbar-btn" onClick={exportSettings} title="Descargar JSON con toda la configuración">
                    <Download size={15} /> Exportar
                  </button>
                  <button type="button" className="settings-toolbar-btn" disabled={importing} onClick={() => importRef.current?.click()} title="Importar configuración desde un JSON">
                    {importing ? <><Loader2 className="spin" size={15} /> Importando…</> : <><Upload size={15} /> Importar</>}
                  </button>
                  <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importSettings} disabled={importing} />
                </div>
              </div>
            )}

            <form onSubmit={save}>
              {filteredSections.map((section) => (
                <section className="settings-card" key={section.key}>
                  <header>
                    <h2>{section.title}</h2>
                    <p>{section.description}</p>
                  </header>
                  {!editable && (
                    <div className="settings-locked"><ShieldOff size={16} /> Solo el propietario puede modificar estos ajustes.</div>
                  )}
                  <div className="settings-grid">
                    {section.keys.map((key) => {
                      const setting = settings[key];
                      const original = setting?.value ?? '';
                      const value = draft[key] ?? original;
                      const sensitive = key.includes('password') || key.includes('secret') || key === 'company_tax_id';
                      const isDirty = value !== original;
                      return (
                        <label key={key} className="settings-field">
                          <div className="settings-field-head">
                            <span className="settings-field-label">{key.replace(/_/g, ' ')}</span>
                            <div className="settings-field-head-right">
                              {setting?.updatedBy && (
                                <span className="settings-field-meta" title={`${setting.updatedBy.displayName} · ${setting.updatedBy.email}`}>
                                  por {setting.updatedBy.displayName} · {formatDate(setting.updatedAt)}
                                </span>
                              )}
                              {editable && isDirty && (
                                <button type="button" className="settings-field-reset" onClick={() => resetField(key)} title="Descartar cambio en este campo">
                                  <RotateCcw size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                          <FieldInput
                            settingKey={key}
                            value={value}
                            original={original}
                            editable={editable}
                            sensitive={sensitive}
                            onChange={(v) => update(key, v)}
                          />
                          {HINTS[key] && <small className="settings-field-hint">{HINTS[key]}</small>}
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}

              {search && totalMatches === 0 && (
                <div className="settings-empty">
                  <Search size={32} />
                  <strong>Sin resultados</strong>
                  <span>No hay ajustes que coincidan con «{search}».</span>
                  <button type="button" onClick={() => setSearch('')}>Limpiar búsqueda</button>
                </div>
              )}

              {editable && (
                <div className="settings-actions">
                  <button type="button" className="settings-cancel" disabled={!isDirty || saving} onClick={cancel}>Cancelar cambios</button>
                  <button type="submit" className="admin-primary" disabled={!isDirty || saving}>
                    {saving ? <><Loader2 className="spin" size={17} /> Guardando…</> : <><Save size={17} /> Guardar {dirtyKeys.length || ''} {dirtyKeys.length === 1 ? 'cambio' : 'cambios'}</>}
                  </button>
                </div>
              )}

              {showMaintenanceConfirm && (
                <div className="settings-confirm">
                  <AlertTriangle size={20} />
                  <div>
                    <strong>Vas a activar el modo mantenimiento.</strong>
                    <p>El sitio público dejará de mostrar tours y mostrará un mensaje. ¿Confirmas?</p>
                  </div>
                  <div className="settings-confirm-actions">
                    <button type="button" onClick={() => setShowMaintenanceConfirm(false)}>Cancelar</button>
                    <button type="submit" className="admin-primary">Sí, activar</button>
                  </div>
                </div>
              )}
            </form>
          </>
        )}

        {!loading && user?.role === 'owner' && (
          <section className="settings-card security-card">
            <header>
              <h2><ShieldCheck size={18} /> Seguridad y auditoría</h2>
              <p>Estado de tu cuenta, sesiones activas y últimos cambios al sistema.</p>
            </header>

            <div className="security-grid">
              <div className="security-tile">
                <div className="security-tile-label">Verificación en dos pasos</div>
                <div className={`security-tile-value ${user.twoFactorEnabled ? 'ok' : 'warn'}`}>
                  {user.twoFactorEnabled ? <><ShieldCheck size={18} /> Activada</> : <><ShieldOff size={18} /> No activada</>}
                </div>
                <small>Recomendado para el rol propietario. Te la pide al iniciar sesión.</small>
              </div>

              <div className="security-tile">
                <div className="security-tile-label">Sesiones activas</div>
                <div className="security-tile-value">{sessions.length}</div>
                <small>{sessions.filter((s) => s.current).length} es la actual. Las demás se pueden revocar.</small>
              </div>
            </div>

            {sessions.length > 0 && (
              <div className="security-sessions">
                <h3>Dispositivos conectados</h3>
                <ul>
                  {sessions.map((s) => (
                    <li key={s.id} className={s.current ? 'current' : ''}>
                      <div>
                        <strong>{s.current ? 'Esta sesión' : `Sesión ${s.id}`}</strong>
                        <small>{s.ipAddress || 'IP desconocida'} · {s.userAgent || 'navegador desconocido'}</small>
                        <small>Inició: {formatDate(s.createdAt)} · Expira: {formatDate(s.expiresAt)}</small>
                      </div>
                      {!s.current && (
                        <button type="button" disabled={revokingSessionId === s.id} onClick={() => revokeSession(s.id)}>
                          {revokingSessionId === s.id ? 'Revocando…' : 'Revocar'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {audit.length > 0 && (
              <div className="security-audit">
                <h3><History size={16} /> Cambios recientes al sistema</h3>
                <ul>
                  {audit.map((e) => {
                    const keys = (e.metadata?.keys as string[] | undefined) ?? [];
                    return (
                      <li key={e.id}>
                        <strong>{e.displayName || e.email || 'Sistema'}</strong>
                        <span>{keys.length ? `modificó ${keys.length} ajuste(s)` : 'actualizó la configuración'}</span>
                        <small>{formatDate(e.createdAt)} · {e.ipAddress || '—'}</small>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
