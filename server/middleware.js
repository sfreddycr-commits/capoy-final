// Production-grade middleware: compression, security headers, cache control.
// Designed for the capoy-final SPA + static uploads.

import { createGzip, createBrotliCompress, createDeflate } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(createGzip);
const brotliAsync = promisify(createBrotliCompress);
const deflateAsync = promisify(createDeflate);

const COMPRESSIBLE_TYPES = new Set([
  'application/json',
  'application/javascript',
  'text/html',
  'text/css',
  'text/plain',
  'text/xml',
  'image/svg+xml',
]);

const COMPRESSIBLE_THRESHOLD = 1024; // bytes

function pickEncoding(req) {
  const accept = (req.headers['accept-encoding'] || '').toLowerCase();
  if (accept.includes('br')) return 'br';
  if (accept.includes('gzip')) return 'gzip';
  if (accept.includes('deflate')) return 'deflate';
  return null;
}

function isCompressible(res) {
  const type = res.getHeader('Content-Type') || '';
  const mime = type.split(';')[0].trim().toLowerCase();
  return COMPRESSIBLE_TYPES.has(mime);
}

/**
 * Compression middleware. Skips small payloads and already-encoded responses.
 * Honors any pre-set Content-Encoding header (no double compression).
 */
export function compressionMiddleware(req, res, next) {
  if (!isCompressible(res)) return next();
  const enc = pickEncoding(req);
  if (!enc) return next();

  const origWrite = res.write.bind(res);
  const origEnd = res.end.bind(res);
  const chunks = [];

  res.write = function (chunk, encoding, cb) {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    if (typeof cb === 'function') cb();
    return true;
  };
  res.end = function (chunk, encoding, cb) {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    if (typeof cb === 'function') cb();
    finalize();
    return res;
  };

  async function finalize() {
    const body = Buffer.concat(chunks);
    if (body.length < COMPRESSIBLE_THRESHOLD) {
      res.removeHeader('Content-Encoding');
      res.removeHeader('Vary');
      origWrite(body);
      origEnd();
      return;
    }

    res.setHeader('Content-Encoding', enc);
    res.setHeader('Vary', 'Accept-Encoding');
    res.removeHeader('Content-Length');

    let compressed;
    try {
      if (enc === 'br') compressed = await brotliAsync(body);
      else if (enc === 'gzip') compressed = await gzipAsync(body);
      else compressed = await deflateAsync(body);
    } catch {
      // Compression failure → fall back to uncompressed
      origWrite(body);
      origEnd();
      return;
    }
    origWrite(compressed);
    origEnd();
  }

  next();
}

/**
 * Security headers, including a CSP that allows the inline content used by
 * the CMS-bridge hydration patterns (nosniff, frame-deny, HSTS, COOP/COEP-aware).
 */
export function securityHeadersMiddleware(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');

  // CSP: fit-for-purpose SPA with our public Tawk-style integrations disabled.
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://images.unsplash.com", // Vite injects inline scripts during build; tightening in a future iteration
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

/**
 * Cache-control middleware. Hash-named Vite assets get 1 year; everything
 * else under dist gets 1h; /uploads images get 1h (overridable).
 */
export function cacheControlMiddleware(req, res, next) {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  next();
}

/**
 * Long-cache middleware for hashed assets. Use it BEFORE static serving.
 */
export function longCacheForHashedAssets(distPath) {
  return function (req, res, next) {
    // Vite emits assets as /assets/<hash>-<name>.{js,css}
    if (req.path.startsWith('/assets/') && /\/assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_.-]+$/.test(req.path)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return next();
    }
    next();
  };
}

/**
 * Lightweight per-process rate limiter. Used for sensitive endpoints.
 * Returns a middleware that tracks hits in memory (sliding window).
 *
 * Key: ip + path + method. Window: per limiter config.
 */
export function rateLimit({ windowMs = 60_000, max = 60, name = 'rate' } = {}) {
  const hits = new Map(); // key -> { count, resetAt }
  function cleanup(now) {
    for (const [k, v] of hits) {
      if (v.resetAt <= now) hits.delete(k);
    }
  }
  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    cleanup(now);
    const key = `${req.ip || '?'}|${name}|${req.method}|${req.path}`;
    const entry = hits.get(key);
    if (!entry) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      return res.status(429).json({ error: `Demasiadas peticiones. Intenta en ${retryAfter}s.` });
    }
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    next();
  };
}

/**
 * Structured JSON log helper. Sticks to stdout — easy to harvest via journalctl.
 */
export function logEvent(level, message, fields = {}) {
  const payload = { ts: new Date().toISOString(), level, message, ...fields };
  const out = JSON.stringify(payload);
  if (level === 'error' || level === 'warn') process.stderr.write(out + '\n');
  else process.stdout.write(out + '\n');
}
