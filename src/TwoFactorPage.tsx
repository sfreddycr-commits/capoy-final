import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, LockKeyhole, LogOut, Menu, ShieldCheck, X } from 'lucide-react';

type AdminUser = { id: number; displayName: string; email: string; role: string };

type Status = { enabled: boolean; enabledAt: string | null };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(v => v[0]?.toUpperCase()).join('') || 'CA';
}

export function TwoFactorPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<'overview' | 'enroll-step1' | 'enroll-step2' | 'recovery'>('overview');
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauthUrl: string; recoveryCodes: string[] } | null>(null);
  const [code, setCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const [s, st] = await Promise.all([
        fetch('/api/auth/session', { credentials: 'same-origin' }),
        fetch('/api/admin/2fa/status', { credentials: 'same-origin' }),
      ]);
      if (s.status === 401 || st.status === 401) {
        location.assign('/admin/login');
        return;
      }
      if (!s.ok || !st.ok) {
        const b = await st.json().catch(() => ({}));
        throw new Error(b.error || 'No fue posible cargar el estado de 2FA.');
      }
      setUser((await s.json()).user);
      setStatus(await st.json());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No fue posible cargar el estado.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => null);
    location.assign('/admin/login');
  }

  async function startEnroll(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage('');
    try {
      const r = await fetch('/api/admin/2fa/enroll/begin', {
        method: 'POST', credentials: 'same-origin',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No fue posible iniciar la activación.');
      setEnrollment({ secret: d.secret, otpauthUrl: d.otpauthUrl, recoveryCodes: d.recoveryCodes });
      setPhase('enroll-step2');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No fue posible iniciar la activación.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage('');
    try {
      const r = await fetch('/api/admin/2fa/enroll/confirm', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No fue posible confirmar el código.');
      setMessage('Verificación en dos pasos activada correctamente.');
      setPhase('overview');
      setEnrollment(null);
      setCode('');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No fue posible confirmar.');
    } finally {
      setBusy(false);
    }
  }

  async function disable(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage('');
    try {
      const r = await fetch('/api/admin/2fa/disable', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No fue posible desactivar.');
      setMessage('Verificación en dos pasos desactivada.');
      setDisablePassword('');
      setPhase('overview');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No fue posible desactivar.');
    } finally {
      setBusy(false);
    }
  }

  // Render QR code using a public CDN-free SVG QR encoder.
  // We use the Google Chart API as a quick option (it accepts otpauth URL).
  const qrUrl = enrollment ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(enrollment.otpauthUrl)}&margin=1` : null;

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
            ['Seguridad', '/admin/seguridad'],
            ['Usuarios', '/admin/usuarios'],
            ['Configuración', '/admin/configuracion'],
          ].map(([n, h]) => (
            <a className={n === 'Seguridad' ? 'active' : ''} href={h} key={n}>{n}</a>
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
            <strong>Seguridad</strong>
          </div>
          {user && <small>{user.email}</small>}
        </header>

        <section className="admin-card">
          <header className="company-header">
            <div>
              <span className="admin-kicker">AUTENTICACIÓN EN DOS PASOS (2FA · TOTP)</span>
              <h1>Seguridad de la cuenta</h1>
              <p>Activa la verificación en dos pasos (Google Authenticator, 1Password, Bitwarden, Authy).</p>
            </div>
            <LockKeyhole size={36}/>
          </header>

          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px 0' }}><Loader2 className="spin"/> Cargando…</p>
          ) : (
            <>
              <div className="twofactor-state">
                <strong>Estado actual:</strong>
                {status?.enabled ? (
                  <span className="ok">Activada desde {new Date(status.enabledAt!).toLocaleString('es-CR')}</span>
                ) : (
                  <span className="warn">No activada</span>
                )}
              </div>

              {!status?.enabled && phase === 'overview' && (
                <form onSubmit={startEnroll}>
                  <p style={{ marginBottom: '12px' }}>Al activar 2FA necesitarás tu app authenticator para iniciar sesión, además de tu contraseña.</p>
                  <button className="admin-primary" type="submit" disabled={busy}>
                    {busy ? 'Iniciando…' : 'Activar verificación en dos pasos'}
                  </button>
                </form>
              )}

              {status?.enabled && phase === 'overview' && (
                <form onSubmit={disable}>
                  <p style={{ marginBottom: '12px' }}>Para desactivar la verificación en dos pasos, confirma tu contraseña.</p>
                  <input
                    type="password"
                    placeholder="Tu contraseña actual"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    minLength={12}
                    maxLength={200}
                    required
                  />
                  <button className="admin-secondary danger" type="submit" disabled={busy}>
                    {busy ? 'Desactivando…' : 'Desactivar 2FA'}
                  </button>
                </form>
              )}

              {phase === 'enroll-step2' && enrollment && (
                <form onSubmit={confirmEnroll} className="twofactor-enroll">
                  <section className="twofactor-qr">
                    <strong>1. Escanea este código QR</strong>
                    <small>En tu app authenticator (Google Authenticator, 1Password, Bitwarden, Authy, Microsoft Authenticator).</small>
                    {qrUrl && <img src={qrUrl} alt="QR 2FA" />}
                    <small>Si no puedes escanear, introduce este secreto manualmente:</small>
                    <code>{enrollment.secret}</code>
                  </section>
                  <section>
                    <strong>2. Introduce el código de 6 dígitos</strong>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      autoFocus
                    />
                  </section>
                  <section>
                    <strong>3. Códigos de recuperación (guárdalos)</strong>
                    <small>Si pierdes tu dispositivo, cada código puede usarse una sola vez para iniciar sesión.</small>
                    <div className="twofactor-recovery">
                      {enrollment.recoveryCodes.map(c => (
                        <code key={c}>{c}</code>
                      ))}
                    </div>
                  </section>
                  <div className="twofactor-actions">
                    <button type="button" className="admin-secondary" onClick={() => { setPhase('overview'); setEnrollment(null); }}>Cancelar</button>
                    <button className="admin-primary" type="submit" disabled={busy || code.length !== 6}>
                      {busy ? 'Confirmando…' : 'Activar 2FA'}
                    </button>
                  </div>
                </form>
              )}

              {message && (
                <p className={`admin-message ${message.startsWith('Verif') ? 'success' : 'error'}`}>{message}</p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
