/**
 * Kin waitlist — Cloudflare Worker.
 *
 * Storage: D1 (serverless SQLite). Same request/response contract as the
 * previous self-hosted Node backend, so the frontend (assets/js/waitlist.js)
 * needs no changes.
 *
 * Deliberately NOT collected: IP address, user agent. Only what the form
 * asks for — name, and one of email/phone.
 *
 * Security measures (see worker/README.md for detail):
 *   - Parameterized D1 queries (no SQL injection)
 *   - Per-IP rate limiting (Workers Rate Limiting binding)
 *   - Request body size cap
 *   - Strict input validation + length limits
 *   - Honeypot field to drop obvious bots
 *   - CORS locked to a configured origin
 *   - Security response headers
 *   - Token-protected read endpoint (constant-time compare)
 *   - Generic error messages (no internal details leaked)
 *   - Duplicate signups report success (no enumeration of registered contacts)
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 8 * 1024; // 8 KiB

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  };
}

function json(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
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

// No crypto.timingSafeEqual in the Workers runtime — manual constant-time
// compare so an invalid admin token can't be brute-forced via response timing.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function handleWaitlist(request, env, origin) {
  if (env.RATE_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return json(429, { error: 'Too many requests. Please try again later.' }, origin);
    }
  }

  let raw;
  try {
    raw = await request.text();
  } catch {
    return json(400, { error: 'Invalid request.' }, origin);
  }
  if (raw.length > MAX_BODY_BYTES) {
    return json(413, { error: 'Payload too large.' }, origin);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(400, { error: 'Invalid JSON.' }, origin);
  }

  // Honeypot: hidden field real users never fill. If populated, pretend
  // success and drop the submission silently.
  if (typeof payload.website === 'string' && payload.website.trim() !== '') {
    return json(201, { ok: true }, origin);
  }

  const error = validate(payload);
  if (error) return json(400, { error }, origin);

  const name = payload.name.trim();
  const contactMethod = payload.contact_method;
  // Lower-cased for case-insensitive dedup against the unique index.
  const email = contactMethod === 'email' ? payload.email.trim().toLowerCase() : null;
  const phone = contactMethod === 'phone' ? payload.phone.trim() : null;
  const createdAt = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO signups (name, contact_method, email, phone, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(name, contactMethod, email, phone, createdAt)
      .run();
    return json(201, { ok: true }, origin);
  } catch (err) {
    if (String(err && err.message).includes('UNIQUE')) {
      // Already on the list — same response as success, so the endpoint
      // can't be used to check whether an email/phone is registered.
      return json(201, { ok: true }, origin);
    }
    console.error('D1 insert failed:', err);
    return json(500, { error: 'Could not save your signup. Please try again.' }, origin);
  }
}

async function handleAdminList(request, env, origin) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!env.ADMIN_TOKEN || !timingSafeEqual(token, env.ADMIN_TOKEN)) {
    return json(401, { error: 'Unauthorized.' }, origin);
  }

  const countRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM signups').first();
  const recent = await env.DB.prepare(
    `SELECT id, name, contact_method, email, phone, created_at
     FROM signups ORDER BY id DESC LIMIT 100`
  ).all();

  return json(200, { count: countRow.n, recent: recent.results }, origin);
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOW_ORIGIN || '*';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json(200, { ok: true }, origin);
    }

    if (request.method === 'POST' && (url.pathname === '/waitlist' || url.pathname === '/waitlist/')) {
      return handleWaitlist(request, env, origin);
    }

    if (request.method === 'GET' && url.pathname === '/admin/signups') {
      return handleAdminList(request, env, origin);
    }

    return json(404, { error: 'Not found.' }, origin);
  },
};
