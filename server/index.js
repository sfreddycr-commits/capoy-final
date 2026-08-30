import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import path from 'node:path';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

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
}) : null;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb', type: 'application/json' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

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

async function requireSession(req, res, next) {
  if (!pool) return res.status(503).json({ error: 'Servicio temporalmente no disponible.' });
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token || token.length < 40) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Sesión requerida.' });
  }
  try {
    const tokenHash = sha256(token);
    const [rows] = await pool.execute(
      `SELECT s.id AS session_id, s.user_id, s.expires_at, u.email, u.display_name, u.role, u.status
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > NOW() AND u.status = 'active'
       LIMIT 1`,
      [tokenHash],
    );
    const session = rows[0];
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

app.get('/api/health', async (_req, res) => {
  let database = 'not-configured';
  try {
    if (pool) {
      await pool.query('SELECT 1');
      database = 'ok';
    }
  } catch {
    database = 'error';
  }
  res.status(database === 'error' ? 503 : 200).json({
    status: database === 'error' ? 'degraded' : 'ok',
    service: 'capoy-final',
    database,
  });
});

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

app.use('/api/admin', requireSession);

app.use((req, res, next) => {
  const protectedAdminPage = req.path === '/admin' || (req.path.startsWith('/admin/') && req.path !== '/admin/login');
  if (!protectedAdminPage) return next();
  requireSession(req, res, (error) => {
    if (error) return next(error);
    next();
  });
});

app.use(express.static(dist, { index: false, maxAge: '1h' }));
app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

app.listen(port, '0.0.0.0', () => {
  console.log(`Capoy listening on ${port}`);
});
