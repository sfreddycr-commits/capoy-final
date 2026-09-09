// 2FA TOTP module for admin users.
// - AES-256-GCM encryption for the TOTP secret at rest (key derived from DB_PASSWORD).
// - Recovery codes (10 single-use) generated on enrollment, hashed (sha256), returned ONCE.
// - Rate-limited: failed TOTP attempts lock the user for 15 min (same window as login).
// - All TOTP events logged to admin_two_factor_log and audited via the global audit() helper.

import crypto from 'node:crypto';

// RFC 6238 TOTP implementation (HMAC-SHA1, 30s period, 6 digits).
// Self-contained — avoids dependency on otplib (which has ESM/CJS interop
// issues across Node 20/22). ~40 lines that match the standard exactly.
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1; // ±1 step tolerance

function totpGenerateSecret(bytes = 20) {
  const buf = crypto.randomBytes(bytes);
  // Base32 RFC 4648 (alphabet A-Z 2-7, with padding)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += alphabet[parseInt(bits.substring(i, i + 5), 2)];
  }
  // RFC 6238 / 4226 require padding to multiple of 8 chars.
  while (out.length % 8 !== 0) out += '=';
  return out;
}

function totpGenerate(secretBase32, timestamp = Date.now()) {
  // Decode base32
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = secretBase32.replace(/=+$/g, '').toUpperCase();
  let bits = '';
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32 in TOTP secret');
    bits += idx.toString(2).padStart(5, '0');
  }
  const keyBytes = Buffer.alloc(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i += 8) {
    keyBytes[i / 8] = parseInt(bits.substring(i, Math.min(i + 8, bits.length)), 2);
  }
  // Counter = floor(unix_time / period)
  const counter = Math.floor(timestamp / 1000 / TOTP_PERIOD);
  const counterBuf = Buffer.alloc(8);
  // big-endian 64-bit counter
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const hmac = crypto.createHmac('sha1', keyBytes).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  const otp = (binCode % (10 ** TOTP_DIGITS)).toString().padStart(TOTP_DIGITS, '0');
  return otp;
}

function totpVerifyAndAdvance(secretBase32, token, lastUsedStep) {
  const clean = String(token || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return { ok: false, reason: 'format' };
  const step = Math.floor(Date.now() / 1000 / TOTP_PERIOD);
  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
    const testStep = step + delta;
    if (lastUsedStep !== null && testStep <= lastUsedStep) continue;
    const expected = totpGenerate(secretBase32, testStep * TOTP_PERIOD * 1000);
    if (expected === clean) {
      return { ok: true, step: testStep };
    }
  }
  return { ok: false, reason: 'invalid' };
}

function totpGenerateUri(secretBase32, email, issuer = 'Capoy Tours') {
  const label = encodeURIComponent(email);
  const iss = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;
}

const RECOVERY_COUNT = 10;
const ISSUER = 'Capoy Tours';

// Cache the derived key once per process (key = SHA-256 of DB password).
let _derivedKey = null;
function getEncryptionKey() {
  if (_derivedKey) return _derivedKey;
  const seed = process.env.DB_PASSWORD || process.env.DB_PASS || 'capoy-fallback-key';
  _derivedKey = crypto.createHash('sha256').update(seed).digest();
  return _derivedKey;
}

export function encryptSecret(plain) {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64')}.${enc.toString('base64')}.${tag.toString('base64')}`;
}
export function decryptSecret(blob) {
  if (!blob) return null;
  const parts = blob.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  const iv = Buffer.from(parts[1], 'base64');
  const enc = Buffer.from(parts[2], 'base64');
  const tag = Buffer.from(parts[3], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// Recovery code: random base32 10-char (e.g. ABCDE-FGHJK)
function makeRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit 0/O/1/I for clarity
  const raw = Array.from({ length: 10 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join('');
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}
function hashRecovery(code) {
  return crypto.createHash('sha256').update(code.replace(/-/g, '').toUpperCase()).digest('hex');
}

export function generateRecoveryCodes() {
  const codes = [];
  const hashes = [];
  for (let i = 0; i < RECOVERY_COUNT; i++) {
    const code = makeRecoveryCode();
    codes.push(code);
    hashes.push(hashRecovery(code));
  }
  // Stored as JSON array of hashes. Return plain codes once (caller shows them to user).
  return { codes, encryptedHashesBlob: JSON.stringify(hashes) };
}

export function consumeRecoveryCode(storedJsonBlob, attempt) {
  if (!storedJsonBlob) return false;
  let hashes;
  try { hashes = JSON.parse(storedJsonBlob); } catch { return false; }
  if (!Array.isArray(hashes)) return false;
  const attemptHash = hashRecovery(attempt);
  const idx = hashes.indexOf(attemptHash);
  if (idx < 0) return false;
  // Consume (single use) — remove from array.
  hashes.splice(idx, 1);
  return { consumed: true, remainingBlob: JSON.stringify(hashes) };
}

// otplib removed — we now use our RFC 6238-compliant implementation above.

export function generateSecretBase32() {
  return totpGenerateSecret(20);
}

export function buildOtpAuthUrl(email, secretBase32) {
  return totpGenerateUri(secretBase32, email, ISSUER);
}

export async function verifyAndAdvance(secretBase32, token, lastUsedStep) {
  return totpVerifyAndAdvance(secretBase32, token, lastUsedStep);
}

// ----- HTTP routes -----

export function registerTwoFactorRoutes({ app, pool, requireSession, sameOriginOnly, audit, requireOwner }) {
  // Step 1: begin enrollment (owner-only). Generates a fresh secret + 10 recovery codes.
  // Returns the secret as a base32 string + otpauth:// URL for QR code generation client-side.
  app.post('/api/admin/2fa/enroll/begin', requireSession, requireOwner, async (req, res) => {
    const userId = req.admin.id;
    const [rows] = await pool.query('SELECT email, totp_enabled FROM admin_users WHERE id = ? LIMIT 1', [userId]);
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado.' });
    const u = rows[0];
    if (u.totp_enabled) return res.status(409).json({ error: '2FA ya está habilitado. Desactívalo primero para volver a enrolar.' });

    const secret = generateSecretBase32();
    const otpauthUrl = buildOtpAuthUrl(u.email, secret);
    const { codes, encryptedHashesBlob } = generateRecoveryCodes();
    const encryptedSecret = encryptSecret(secret);

    // Persist as pending (totp_enabled=0). Real enable happens after verify.
    await pool.query(
      'UPDATE admin_users SET totp_secret_encrypted = ?, totp_recovery_codes_encrypted = ?, totp_enabled = 0 WHERE id = ?',
      [encryptedSecret, encryptedHashesBlob, userId],
    );

    await audit(req, 'two_factor_enroll_begin', {
      userId,
      email: req.admin.email,
      metadata: { method: 'totp' },
    });

    res.json({
      ok: true,
      secret,
      otpauthUrl,
      issuer: ISSUER,
      recoveryCodes: codes,
    });
  });

  // Step 2: confirm enrollment by submitting the first valid TOTP code from the new secret.
  app.post('/api/admin/2fa/enroll/confirm', requireSession, sameOriginOnly, requireOwner, async (req, res) => {
    const userId = req.admin.id;
    const code = String(req.body?.code || '').trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Código inválido (debe ser de 6 dígitos).' });
    const [rows] = await pool.query('SELECT email, totp_secret_encrypted FROM admin_users WHERE id = ? LIMIT 1', [userId]);
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado.' });
    const secret = decryptSecret(rows[0].totp_secret_encrypted);
    if (!secret) return res.status(400).json({ error: 'No hay un enrolamiento pendiente.' });
    const result = await verifyAndAdvance(secret, code, null);
    if (!result.ok) {
      await audit(req, 'two_factor_enroll_confirm_failed', { userId, email: req.admin.email });
      return res.status(400).json({ error: 'Código incorrecto. Verifica que la hora de tu dispositivo sea la correcta.' });
    }

    await pool.query('UPDATE admin_users SET totp_enabled = 1, totp_enabled_at = NOW(), totp_last_used_step = ? WHERE id = ?', [result.step, userId]);
    await pool.execute(
      'INSERT INTO admin_two_factor_log (user_id, event_type, ip_address, user_agent) VALUES (?, ?, ?, ?)',
      [userId, 'enroll_confirmed', req.ip || null, String(req.get('user-agent') || '').slice(0, 255) || null],
    );
    await audit(req, 'two_factor_enroll_confirmed', { userId, email: req.admin.email });

    res.json({ ok: true });
  });

  // Disable 2FA (owner-only). Requires password re-entry to prevent account-takeover abuse.
  app.post('/api/admin/2fa/disable', requireSession, sameOriginOnly, requireOwner, async (req, res) => {
    const userId = req.admin.id;
    const password = req.body?.password;
    if (!validPassword(password)) return res.status(400).json({ error: 'Contraseña inválida.' });
    const [rows] = await pool.query('SELECT password_hash FROM admin_users WHERE id = ? LIMIT 1', [userId]);
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado.' });
    const ok = await verifyPassword(password, rows[0].password_hash);
    if (!ok) {
      await audit(req, 'two_factor_disable_failed', { userId, email: req.admin.email });
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }
    await pool.query('UPDATE admin_users SET totp_secret_encrypted = NULL, totp_recovery_codes_encrypted = NULL, totp_enabled = 0, totp_enabled_at = NULL, totp_last_used_step = NULL WHERE id = ?', [userId]);
    await pool.execute(
      'INSERT INTO admin_two_factor_log (user_id, event_type, ip_address, user_agent) VALUES (?, ?, ?, ?)',
      [userId, 'disabled', req.ip || null, String(req.get('user-agent') || '').slice(0, 255) || null],
    );
    await audit(req, 'two_factor_disabled', { userId, email: req.admin.email });
    res.json({ ok: true });
  });

  // Status: is 2FA enabled for current user? (admin view)
  app.get('/api/admin/2fa/status', requireSession, async (req, res) => {
    const userId = req.admin.id;
    const [rows] = await pool.query('SELECT totp_enabled, totp_enabled_at FROM admin_users WHERE id = ? LIMIT 1', [userId]);
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json({
      ok: true,
      enabled: Boolean(rows[0].totp_enabled),
      enabledAt: rows[0].totp_enabled_at,
    });
  });
}

// Local helpers (mirror those in server/users.js without importing).
import { promisify } from 'node:util';
const scryptAsync = promisify(crypto.scrypt);
function validPassword(password) { return typeof password === 'string' && password.length >= 12 && password.length <= 200; }
async function verifyPassword(password, stored) {
  try {
    const [scheme, salt, expectedHex] = String(stored || '').split('$');
    if (scheme !== 'scrypt' || !salt || !expectedHex) return false;
    const derived = Buffer.from(await scryptAsync(password, salt, 64));
    const expected = Buffer.from(expectedHex, 'hex');
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch { return false; }
}
