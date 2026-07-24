#!/usr/bin/env node
'use strict';

/**
 * Kin waitlist — lightweight self-hosted submission handler.
 *
 * Storage: SQLite via Node's built-in node:sqlite (see db.js). Zero external
 * dependencies. Designed to be exposed publicly behind a TLS reverse proxy.
 *
 * Security measures:
 *   - Parameterized SQL (no injection) — see db.js
 *   - Per-IP rate limiting (sliding window)
 *   - Request body size cap
 *   - Strict input validation + length limits
 *   - Honeypot field to drop obvious bots
 *   - CORS locked to a configured origin
 *   - Security response headers
 *   - X-Forwarded-For only trusted when TRUST_PROXY is set (anti-spoofing)
 *   - Generic error messages (no internal details leaked)
 *   - Token-protected read/export endpoint
 *
 * Run:   node server.js
 * Env:
 *   PORT           listen port                     (default 8080)
 *   HOST           bind address                    (default 127.0.0.1)
 *   DB_FILE        sqlite path                      (default ./data/waitlist.db)
 *   ALLOW_ORIGIN   exact CORS origin, or *          (default *)
 *   TRUST_PROXY    "1" to trust X-Forwarded-For     (default off)
 *   RATE_MAX       max requests per window per IP   (default 5)
 *   RATE_WINDOW_MS rate window in ms                (default 600000 = 10 min)
 *   ADMIN_TOKEN    bearer token for /admin routes   (default: disabled)
 */

const http = require('http');
const crypto = require('crypto');
const db = require('./db');

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '127.0.0.1';
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const RATE_MAX = parseInt(process.env.RATE_MAX || '5', 10);
const RATE_WINDOW_MS = parseInt(process.env.RATE_WINDOW_MS || '600000', 10);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const MAX_BODY_BYTES = 8 * 1024; // 8 KB

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------------------------------------------ */
/* Rate limiter — in-memory sliding window, keyed by client IP.        */
/* Adequate for a single-process deployment behind one proxy.          */
/* ------------------------------------------------------------------ */
const hits = new Map(); // ip -> number[] (timestamps)

function rateLimited(ip, now) {
  const windowStart = now - RATE_WINDOW_MS;
  const arr = (hits.get(ip) || []).filter((t) => t > windowStart);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_MAX;
}

// Periodically drop stale entries so the map can't grow unbounded.
const sweep = setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  for (const [ip, arr] of hits) {
    const live = arr.filter((t) => t > cutoff);
    if (live.length) hits.set(ip, live);
    else hits.delete(ip);
  }
}, RATE_WINDOW_MS);
sweep.unref();

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function clientIp(req) {
  if (TRUST_PROXY) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return fwd.toString().split(',')[0].trim();
  }
  return (req.socket.remoteAddress || '').toString();
}

function baseHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store'
  };
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json' }, baseHeaders()));
  res.end(body);
}

function validate(payload) {
  if (!payload || typeof payload !== 'object') return 'Invalid request body.';

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) return 'Please enter a name or nickname.';
  if (name.length > 100) return 'Name is too long.';

  const method = payload.contact_method;
  if (method !== 'email' && method !== 'phone') return 'Invalid contact method.';

  if (method === 'email') {
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    if (!email) return 'Email is required.';
    if (!EMAIL_RE.test(email) || email.length > 254) return 'Please enter a valid email.';
  } else {
    const phone = typeof payload.phone === 'string' ? payload.phone.trim() : '';
    const digits = phone.replace(/[^\d]/g, '');
    if (!phone) return 'Phone number is required.';
    if (digits.length < 7 || digits.length > 15) return 'Please enter a valid phone number.';
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */
function handleWaitlist(req, res, ip) {
  const now = Date.now();
  if (rateLimited(ip, now)) {
    return sendJson(res, 429, { error: 'Too many requests. Please try again later.' });
  }

  let size = 0;
  const chunks = [];

  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      sendJson(res, 413, { error: 'Payload too large.' });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (res.writableEnded) return;

    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (_) {
      return sendJson(res, 400, { error: 'Invalid JSON.' });
    }

    // Honeypot: a hidden field real users never fill. If populated, it's a
    // bot — pretend success and drop the submission silently.
    if (typeof payload.website === 'string' && payload.website.trim() !== '') {
      return sendJson(res, 201, { ok: true });
    }

    const error = validate(payload);
    if (error) return sendJson(res, 400, { error });

    const record = {
      name: payload.name.trim(),
      contact_method: payload.contact_method,
      email: payload.contact_method === 'email' ? payload.email.trim() : null,
      phone: payload.contact_method === 'phone' ? payload.phone.trim() : null,
      ip,
      user_agent: (req.headers['user-agent'] || '').slice(0, 300),
      created_at: new Date().toISOString()
    };

    try {
      const result = db.insertSignup(record);
      // Duplicate is reported as success so the endpoint can't be used to
      // probe whether an email/phone is already registered.
      console.log(`Signup ${result.status}: ${record.name} (${record.contact_method})`);
      sendJson(res, 201, { ok: true });
    } catch (err) {
      console.error('DB write failed:', err);
      sendJson(res, 500, { error: 'Could not save your signup. Please try again.' });
    }
  });

  req.on('error', () => {
    if (!res.writableEnded) sendJson(res, 400, { error: 'Request error.' });
  });
}

function authorized(req) {
  if (!ADMIN_TOKEN) return false;
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token.length !== ADMIN_TOKEN.length) return false;
  // Constant-time compare to avoid leaking the token via timing.
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(ADMIN_TOKEN));
}

function handleAdminList(req, res) {
  if (!authorized(req)) return sendJson(res, 401, { error: 'Unauthorized.' });
  const limit = 100;
  sendJson(res, 200, { count: db.count(), recent: db.recent(limit) });
}

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */
const server = http.createServer((req, res) => {
  const ip = clientIp(req);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, baseHeaders());
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && (req.url === '/waitlist' || req.url === '/waitlist/')) {
    return handleWaitlist(req, res, ip);
  }

  if (req.method === 'GET' && req.url === '/admin/signups') {
    return handleAdminList(req, res);
  }

  sendJson(res, 404, { error: 'Not found.' });
});

server.listen(PORT, HOST, () => {
  console.log(`Kin waitlist backend listening on ${HOST}:${PORT}`);
  console.log(`Storing signups in ${db.DB_FILE}`);
  console.log(`CORS origin: ${ALLOW_ORIGIN} | trust proxy: ${TRUST_PROXY} | rate: ${RATE_MAX}/${RATE_WINDOW_MS}ms`);
  if (!ADMIN_TOKEN) console.log('Admin endpoint disabled (set ADMIN_TOKEN to enable /admin/signups).');
});

function shutdown() {
  console.log('\nShutting down…');
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
