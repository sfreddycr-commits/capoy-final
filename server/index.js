import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import path from 'node:path';
import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { registerReservationRoutes } from './reservations.js';
import {
  compressionMiddleware,
  securityHeadersMiddleware,
  longCacheForHashedAssets,
  cacheControlMiddleware,
  rateLimit,
  logEvent,
} from './middleware.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, '../dist');
const scryptAsync = promisify(crypto.scrypt);
const isProduction = process.env.NODE_ENV === 'production';
const SESSION_COOKIE = 'capoy_admin_session';
const SHORT_SESSION_MS = 12 * 60 * 60 * 1000;
const REMEMBER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map();

const dbConfigured = Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);
const pool = dbConfigured ? mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 5000,
  // CRITICAL: charset must be utf8mb4 to read accented characters / emojis correctly.
  // Without this, mysql2 defaults to 'utf8' (which MySQL aliases as utf8mb3, max 3 bytes),
  // causing mojibake like "fÃ¡ciles" instead of "fáciles" when the DB stores utf8mb4.
  charset: 'utf8mb4_unicode_ci',
  // Required for some MySQL 8 servers behind firewalls / chunked responses.
  multipleStatements: false,
  dateStrings: false,
  supportBigNumbers: true,
  bigNumberStrings: false,
}) : null;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb', type: 'application/json' }));

// Security headers + CSP
app.use(securityHeadersMiddleware);

// Compression (skips small/streaming responses automatically)
app.use(compressionMiddleware);

// Public rate limits — global 300/min/IP (covers most clients), then
// tighter limits per-endpoint to defend sensitive areas.
app.use(rateLimit({ windowMs: 60_000, max: 300, name: 'global' }));

// Tighter limit for auth endpoints (login attempts — we already have an in-memory
// tracker; this adds a coarse outer guard).
const sensitiveAuthRateLimiter = rateLimit({ windowMs: 60_000, max: 30, name: 'auth' });
const sensitiveAdminRateLimiter = rateLimit({ windowMs: 60_000, max: 600, name: 'admin' });

// Cache control defaults are handled per-path by express.static below via setHeaders.

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(email) {
  return email.length <= 190 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 200;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeSecretEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a || '')).digest();
  const right = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(left, right);
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived).toString('hex')}`;
}

async function verifyPassword(password, stored) {
  try {
    const [scheme, salt, expectedHex] = String(stored || '').split('$');
    if (scheme !== 'scrypt' || !salt || !expectedHex) return false;
    const derived = Buffer.from(await scryptAsync(password, salt, 64));
    const expected = Buffer.from(expectedHex, 'hex');
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return [part, ''];
    return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
  }));
}

function setSessionCookie(res, token, maxAgeMs) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (isProduction) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (isProduction) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function sameOriginOnly(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return next();
  try {
    if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Solicitud no permitida.' });
  } catch {
    return res.status(403).json({ error: 'Solicitud no permitida.' });
  }
  next();
}

function rateLimitKey(req, email) {
  return `${req.ip || 'unknown'}|${email}`;
}

function loginRateLimited(req, email) {
  const now = Date.now();
  const key = rateLimitKey(req, email);
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LOGIN_MAX_ATTEMPTS;
}

function clearLoginRate(req, email) {
  loginAttempts.delete(rateLimitKey(req, email));
}

async function audit(req, eventType, { userId = null, email = null, metadata = null } = {}) {
  if (!pool) return;
  try {
    await pool.execute(
      'INSERT INTO admin_audit_log (user_id, event_type, email_attempted, ip_address, user_agent, metadata_json) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, eventType, email, req.ip || null, String(req.get('user-agent') || '').slice(0, 255) || null, metadata ? JSON.stringify(metadata) : null],
    );
  } catch (error) {
    console.error('audit_write_failed', error.message);
  }
}

async function findSessionByToken(token) {
  if (!pool || !token || token.length < 40) return null;
  const [rows] = await pool.execute(
    `SELECT s.id AS session_id, s.user_id, s.expires_at, u.email, u.display_name, u.role, u.status
     FROM admin_sessions s
     JOIN admin_users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > NOW() AND u.status = 'active'
     LIMIT 1`,
    [sha256(token)],
  );
  return rows[0] || null;
}

async function requireSession(req, res, next) {
  if (!pool) return res.status(503).json({ error: 'Servicio temporalmente no disponible.' });
  const token = parseCookies(req)[SESSION_COOKIE];
  try {
    const session = await findSessionByToken(token);
    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Sesión requerida.' });
    }
    req.admin = {
      id: session.user_id,
      email: session.email,
      displayName: session.display_name,
      role: session.role,
      sessionId: session.session_id,
    };
    pool.execute('UPDATE admin_sessions SET last_seen_at = NOW() WHERE id = ?', [session.session_id]).catch(() => {});
    next();
  } catch (error) {
    console.error('session_check_failed', error.message);
    res.status(503).json({ error: 'Servicio temporalmente no disponible.' });
  }
}

const dashboardModuleDefinitions = [
  { key: 'reservations', label: 'Reservas', candidates: ['bookings', 'requests', 'reservations'] },
  { key: 'tours', label: 'Tours', candidates: ['tours'] },
  { key: 'customers', label: 'Clientes', candidates: ['customers', 'clients'] },
  { key: 'providers', label: 'Proveedores', candidates: ['providers', 'allies'] },
  { key: 'fleet', label: 'Flota', candidates: ['fleet', 'vehicles'] },
  { key: 'reviews', label: 'Reseñas', candidates: ['reviews'] },
];

async function findExistingTable(candidates) {
  for (const table of candidates) {
    const [rows] = await pool.execute(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       LIMIT 1`,
      [table],
    );
    if (rows.length) return table;
  }
  return null;
}

async function countWhitelistedTable(table) {
  const allowed = new Set(dashboardModuleDefinitions.flatMap((item) => item.candidates));
  if (!allowed.has(table)) throw new Error('dashboard_table_not_allowed');
  const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
  return Number(rows[0]?.total || 0);
}

async function loadDashboardModules() {
  return Promise.all(dashboardModuleDefinitions.map(async (definition) => {
    const table = await findExistingTable(definition.candidates);
    if (!table) return { key: definition.key, label: definition.label, available: false, count: null, table: null };
    const count = await countWhitelistedTable(table);
    return { key: definition.key, label: definition.label, available: true, count, table };
  }));
}

app.get('/api/health', async (_req, res) => {
  const startedAt = process.startupTime || Date.now() - (process.uptime?.() * 1000) || Date.now();
  const mem = process.memoryUsage();
  const processInfo = {
    uptime: Number(process.uptime?.().toFixed(2) ?? 0),
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
    },
    node: process.version,
    pid: process.pid,
  };

  let database = 'not-configured';
  let counts = null;
  let mysqlLatencyMs = null;
  if (pool) {
    const t0 = Date.now();
    try {
      await pool.query('SELECT 1');
      database = 'ok';
      mysqlLatencyMs = Date.now() - t0;
      // Light counts (cached for 30s to avoid load)
      counts = await getCachedCounts();
    } catch (error) {
      database = 'error';
      logEvent('error', 'health_check_db_error', { error: error.message });
    }
  }

  const ok = database === 'ok';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    service: 'capoy-final',
    version: process.env.CAPOY_BUILD_SHA || 'dev',
    startedAt: new Date(startedAt).toISOString(),
    database,
    mysqlLatencyMs,
    counts,
    process: processInfo,
  });
});

// Cached row-counts for /api/health (cheap)
let countsCache = { at: 0, value: null };
async function getCachedCounts() {
  const now = Date.now();
  if (countsCache.value && now - countsCache.at < 30_000) return countsCache.value;
  const tables = ['reservations', 'tours', 'customers', 'providers', 'fleet', 'reviews', 'cms_settings', 'admin_users', 'app_settings'];
  const out = {};
  for (const t of tables) {
    try { const [r] = await pool.query(`SELECT COUNT(*) AS c FROM ${t}`); out[t] = Number(r[0].c); } catch { out[t] = null; }
  }
  countsCache = { at: now, value: out };
  return out;
}

function authOnly(req, res, next) {
  // Apply only to /api/auth/* — coarser outer guard (login already has fine-grained in-memory limiter)
  if (req.path.startsWith('/api/auth')) return sensitiveAuthRateLimiter(req, res, next);
  next();
}
function adminOnly(req, res, next) {
  if (req.path.startsWith('/api/admin')) return sensitiveAdminRateLimiter(req, res, next);
  next();
}
app.use(authOnly);
app.use(adminOnly);

app.post('/api/auth/bootstrap', sameOriginOnly, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Servicio temporalmente no disponible.' });
  const bootstrapToken = process.env.BOOTSTRAP_TOKEN;
  if (!bootstrapToken || !safeSecretEqual(req.get('x-bootstrap-token'), bootstrapToken)) {
    await audit(req, 'bootstrap_denied');
    return res.status(404).json({ error: 'No disponible.' });
  }
  const email = normalizeEmail(req.body?.email);
  const displayName = String(req.body?.displayName || '').trim().slice(0, 120);
  const password = req.body?.password;
  if (!validEmail(email) || displayName.length < 2 || !validPassword(password)) {
    return res.status(400).json({ error: 'Datos inválidos. La contraseña debe tener al menos 12 caracteres.' });
  }
  try {
    const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM admin_users');
    if (Number(countRows[0]?.total || 0) > 0) return res.status(409).json({ error: 'Bootstrap no disponible.' });
    const passwordHash = await hashPassword(password);
    const [result] = await pool.execute(
      `INSERT INTO admin_users (email, display_name, password_hash, role, status)
       VALUES (?, ?, ?, 'owner', 'active')`,
      [email, displayName, passwordHash],
    );
    await audit(req, 'bootstrap_owner_created', { userId: result.insertId, email });
    res.status(201).json({ ok: true, message: 'Administrador inicial creado. Retire BOOTSTRAP_TOKEN del entorno.' });
  } catch (error) {
    console.error('bootstrap_failed', error.message);
    res.status(500).json({ error: 'No se pudo completar el bootstrap.' });
  }
});

app.post('/api/auth/login', sameOriginOnly, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Servicio temporalmente no disponible.' });
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const remember = req.body?.remember === true;
  const genericError = { error: 'Correo o contraseña incorrectos.' };
  if (!validEmail(email) || typeof password !== 'string' || password.length > 200) {
    await audit(req, 'login_failed', { email: validEmail(email) ? email : null });
    return res.status(401).json(genericError);
  }
  if (loginRateLimited(req, email)) {
    await audit(req, 'login_rate_limited', { email });
    res.setHeader('Retry-After', '900');
    return res.status(429).json({ error: 'Demasiados intentos. Intenta nuevamente más tarde.' });
  }
  try {
    const [rows] = await pool.execute(
      'SELECT id, email, display_name, password_hash, role, status, failed_attempts, locked_until FROM admin_users WHERE email = ? LIMIT 1',
      [email],
    );
    const user = rows[0];
    const locked = user?.locked_until && new Date(user.locked_until).getTime() > Date.now();
    const passwordOk = user && !locked && user.status === 'active' && await verifyPassword(password, user.password_hash);
    if (!passwordOk) {
      if (user) {
        const nextAttempts = Number(user.failed_attempts || 0) + 1;
        if (nextAttempts >= 8) {
          await pool.execute('UPDATE admin_users SET failed_attempts = 0, locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?', [user.id]);
        } else {
          await pool.execute('UPDATE admin_users SET failed_attempts = ? WHERE id = ?', [nextAttempts, user.id]);
        }
      }
      await audit(req, locked ? 'login_locked' : 'login_failed', { userId: user?.id || null, email });
      return res.status(401).json(genericError);
    }

    const maxAgeMs = remember ? REMEMBER_SESSION_MS : SHORT_SESSION_MS;
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + maxAgeMs);
    await pool.execute('DELETE FROM admin_sessions WHERE expires_at <= NOW()');
    await pool.execute(
      'INSERT INTO admin_sessions (user_id, token_hash, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
      [user.id, tokenHash, expiresAt, req.ip || null, String(req.get('user-agent') || '').slice(0, 255) || null],
    );
    await pool.execute('UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?', [user.id]);
    clearLoginRate(req, email);
    setSessionCookie(res, token, maxAgeMs);
    await audit(req, 'login_success', { userId: user.id, email });
    res.json({ ok: true, user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role } });
  } catch (error) {
    console.error('login_failed_internal', error.message);
    res.status(503).json({ error: 'Servicio temporalmente no disponible.' });
  }
});

app.get('/api/auth/session', requireSession, (req, res) => {
  res.json({ ok: true, user: { id: req.admin.id, email: req.admin.email, displayName: req.admin.displayName, role: req.admin.role } });
});

app.post('/api/auth/logout', sameOriginOnly, requireSession, async (req, res) => {
  try {
    await pool.execute('DELETE FROM admin_sessions WHERE id = ?', [req.admin.sessionId]);
    await audit(req, 'logout', { userId: req.admin.id, email: req.admin.email });
  } finally {
    clearSessionCookie(res);
  }
  res.json({ ok: true });
});

app.get('/api/admin/dashboard', requireSession, async (_req, res) => {
  try {
    const [modules, adminRows, sessionRows, auditCountRows, activityRows] = await Promise.all([
      loadDashboardModules(),
      pool.query("SELECT COUNT(*) AS total FROM admin_users WHERE status = 'active'"),
      pool.query('SELECT COUNT(*) AS total FROM admin_sessions WHERE expires_at > NOW()'),
      pool.query('SELECT COUNT(*) AS total FROM admin_audit_log WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'),
      pool.query(`SELECT id, event_type, email_attempted, created_at
                  FROM admin_audit_log
                  ORDER BY created_at DESC
                  LIMIT 8`),
    ]);

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      database: 'ok',
      metrics: {
        activeAdmins: Number(adminRows[0][0]?.total || 0),
        activeSessions: Number(sessionRows[0][0]?.total || 0),
        audit24h: Number(auditCountRows[0][0]?.total || 0),
      },
      modules,
      revenue: {
        available: false,
        amount: null,
        currency: 'USD',
        reason: 'No existe todavía una fuente financiera normalizada y verificable.',
      },
      activity: activityRows[0].map((row) => ({
        id: row.id,
        eventType: row.event_type,
        email: row.email_attempted,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('admin_dashboard_failed', error.message);
    res.status(503).json({ error: 'No fue posible cargar el dashboard administrativo.' });
  }
});

registerReservationRoutes({ app, pool, requireSession, sameOriginOnly, audit });

// Boutique status page (public, no auth) — lightweight read-only.
app.get('/api/public/status', async (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=15');
  res.setHeader('X-Robots-Tag', 'noindex');
  let db = 'not-configured';
  let mysqlLatencyMs = null;
  if (pool) {
    const t0 = Date.now();
    try {
      await pool.query('SELECT 1');
      db = 'ok';
      mysqlLatencyMs = Date.now() - t0;
    } catch { db = 'error'; }
  }
  res.json({
    status: db === 'ok' ? 'operational' : db === 'error' ? 'degraded' : 'unconfigured',
    service: 'capoy-tours',
    checkedAt: new Date().toISOString(),
    components: {
      database: db,
      mysqlLatencyMs,
    },
    monitorUrl: 'https://capoycostarica.com/status',
  });
});

app.get('/status', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Capoy Tours — Estado del sistema</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{--ok:#16a34a;--warn:#d97706;--err:#dc2626;--bg:#0b5a35;--card:#fff;--ink:#14271f;--mut:#5a6e63;--line:#dfe6e0}
  *{box-sizing:border-box}
  body{margin:0;font-family:'DM Sans',system-ui,sans-serif;background:#f6f8f5;color:var(--ink);padding:0}
  .wrap{max-width:760px;margin:0 auto;padding:32px 20px 64px}
  .hero{background:linear-gradient(135deg,#0b5a35 0%,#0a4a2f 100%);color:#fff;border-radius:18px;padding:36px 28px;box-shadow:0 14px 40px rgba(11,90,53,.18)}
  .hero h1{margin:0 0 8px;font-size:32px;letter-spacing:-.5px}
  .hero p{margin:0;opacity:.8}
  .badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.15);padding:6px 12px;border-radius:999px;font-size:13px;font-weight:700}
  .dot{width:9px;height:9px;border-radius:50%;background:#86efac;box-shadow:0 0 0 4px rgba(134,239,172,.25);animation:p 2s ease-in-out infinite}
  @keyframes p{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}
  .grid{display:grid;gap:14px;margin-top:24px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;display:flex;justify-content:space-between;align-items:center}
  .card strong{display:block}
  .card small{color:var(--mut);font-size:13px}
  .ok{color:var(--ok)}
  .err{color:var(--err)}
  .warn{color:var(--warn)}
  footer{margin-top:36px;text-align:center;color:var(--mut);font-size:13px}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <div class="badge"><span class="dot"></span><span id="status-text">Comprobando…</span></div>
    <h1 style="margin-top:14px">Capoy Tours</h1>
    <p>Estado operativo del sistema de reservas y tours.</p>
  </div>
  <div class="grid">
    <div class="card"><strong>Reservas y tours</strong><small>API + landing + persistencia</small><span id="c-app">—</span></div>
    <div class="card"><strong>Base de datos (MySQL)</strong><small>Latencia en vivo</small><span id="c-db">—</span></div>
    <div class="card"><strong>Imágenes y archivos</strong><small>Persistencia validada</small><span class="ok">OK</span></div>
  </div>
  <footer>
    <p>Endpoint programático: <a href="/api/public/status">/api/public/status</a> (JSON).</p>
    <p>Versión <span id="version">—</span> · Comprobado <span id="checked-at">—</span></p>
  </footer>
</div>
<script>
async function refresh() {
  try {
    const r = await fetch('/api/public/status', { credentials: 'omit', cache: 'no-store' });
    const d = await r.json();
    document.getElementById('c-app').innerHTML = '<span class="'+ (d.status==='operational'?'ok':d.status==='degraded'?'warn':'err')+'">'+d.status+'</span>';
    document.getElementById('c-db').innerHTML = (d.components.database === 'ok')
      ? '<span class="ok">OK · '+d.components.mysqlLatencyMs+' ms</span>'
      : '<span class="err">'+d.components.database+'</span>';
    const services = {operational:'Operacional',degraded:'Degradado',unconfigured:'Sin configurar'};
    document.getElementById('status-text').textContent = services[d.status] || d.status;
    document.getElementById('version').textContent = d.version || 'dev';
    document.getElementById('checked-at').textContent = new Date(d.checkedAt).toLocaleString('es-CR');
  } catch (e) {
    document.getElementById('status-text').textContent = 'Caído';
    document.getElementById('c-app').innerHTML = '<span class="err">indisponible</span>';
  }
}
refresh();
setInterval(refresh, 30000);
</script>
</body>
</html>`);
});

app.use('/api/admin', requireSession);

app.use(async (req, res, next) => {
  const protectedAdminPage = req.path === '/admin' || (req.path.startsWith('/admin/') && req.path !== '/admin/login');
  if (!protectedAdminPage) return next();
  if (!pool) return res.status(503).send('Servicio temporalmente no disponible.');
  try {
    const token = parseCookies(req)[SESSION_COOKIE];
    const session = await findSessionByToken(token);
    if (!session) {
      clearSessionCookie(res);
      return res.redirect(302, '/admin/login');
    }
    next();
  } catch (error) {
    console.error('admin_page_session_check_failed', error.message);
    res.status(503).send('Servicio temporalmente no disponible.');
  }
});

// Static SPA assets with proper ETag + cache strategy already handled by
// longCacheForHashedAssets (immutable) and cacheControlMiddleware (1h default).
// We override maxAge to '0' on the global handler so the explicit per-route
// Cache-Control headers from the middleware win.
app.use(express.static(dist, {
  index: false,
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (ext === 'js' || ext === 'css' || ext === 'woff2') {
      // Vite emits hashed filenames; cache them for a year.
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
}));
app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'uploads'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
  }),
);

// SPA fallback: always serves index.html with `no-cache` so HTML updates
// always reach the browser, but JS/CSS bundles remain immutable.
app.get('/{*splat}', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.sendFile(path.join(dist, 'index.html'));
});

// Set build SHA for /api/health if not provided by the environment.
if (!process.env.CAPOY_BUILD_SHA) {
  // Search common locations used by Dokploy, manual builds, and CI.
  const candidates = [
    path.join(process.cwd(), 'git_sha'),
    path.join(process.cwd(), '..', 'git_sha'),
    '/etc/capoy/git_sha',
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) {
        process.env.CAPOY_BUILD_SHA = readFileSync(p, 'utf8').trim();
        break;
      }
    } catch { /* ignore */ }
  }
  if (!process.env.CAPOY_BUILD_SHA) process.env.CAPOY_BUILD_SHA = 'unknown';
}

app.listen(port, '0.0.0.0', () => {
  logEvent('info', 'server_started', {
    port,
    env: process.env.NODE_ENV || 'development',
    version: process.env.CAPOY_BUILD_SHA || 'unknown',
    pid: process.pid,
    compression: true,
    securityHeaders: true,
    cacheStrategy: 'immutable-hashed + no-cache-html + 1d-uploads',
    rateLimit: 'global 300/min',
  });
});
