/**
 * Min waitlist + business interest form — Cloudflare Worker.
 *
 * Storage: D1 (serverless SQLite). Same request/response contract as the
 * previous self-hosted Node backend, so the frontends
 * (assets/js/waitlist-hero.js, assets/js/business.js) need no changes.
 *
 * Two forms, two tables, one Worker:
 *   - /waitlist  -> signups          (consumer waitlist, name + email/phone)
 *   - /business  -> business_signups (business interest form, only
 *                   business_name + location required, rest optional)
 *   - /survey    -> survey_responses (the waitlist survey linked from the
 *                   welcome email; every field optional)
 *
 * Plus poster A/B tracking (see migrations/0004_poster_tracking.sql):
 *   - GET /<location>/<poster> -> poster_scans, then a 302 to
 *     /waitlist/?l=<location>&p=<poster>
 *
 * Transactional email lives in src/emails.js — one template catalogue and
 * one send helper, so a new message is a new key there, not a new function
 * here.
 *
 * Deliberately NOT collected: IP address, user agent. Only what each form
 * actually asks for. Poster tracking stores nothing on the visitor's device
 * and nothing that identifies them, so the site needs no consent banner.
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

import { sendEmail } from './emails.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 16 * 1024; // 16 KiB — business form carries more optional fields than the waitlist

const BUSINESS_TYPES = new Set(['cafe_restaurant', 'bar_nightlife', 'gym_fitness', 'salon_spa', 'retail', 'services', 'other']);
const MARKETING_CHANNELS = new Set(['word_of_mouth', 'social_media', 'paid_ads', 'physical_ads', 'flyers_press', 'nothing']);
const CONCEPT_INTEREST = new Set(['definitely', 'maybe', 'not_really']);
const PRICING_PREF = new Set(['per_post', 'monthly', 'per_redemption', 'not_sure']);
const PILOT_INTEREST = new Set(['yes', 'maybe', 'no']);

// The survey (site: /survey/, reached from the welcome email). One slider per
// app, and these are the slugs the page sends — assets/js/survey.js holds the
// same list with its display names. Anything outside this set is dropped
// rather than rejected: a stale page from an old cache must still be able to
// hand in the answers it did collect.
const APP_KEYS = new Set([
  'instagram', 'tiktok', 'snapchat', 'youtube', 'facebook', 'x', 'reddit',
  'tinder', 'bumble', 'hinge', 'other_dating',
]);
// Minutes a day, matching the rail: 0-300 in quarter hours, where 300 means
// "five hours or more".
const APP_MINUTES_MAX = 300;
// Conversations a week, likewise a ceiling rather than a limit.
const TALKS_MAX = 20;
const APPS_VERDICT = new Set(['yes', 'no']);

// Printed poster variants and the places they hang. Together these are the
// only values GET /<location>/<poster> and the signup fields will accept —
// every other value is ignored, never rejected.
//
// Posters are named after their tagline, not lettered, so a row in the
// scoreboard says which artwork it is without anyone holding a key.
//
// Slugs are ASCII on purpose: 'myyrmaki' keeps the printed QR free of
// percent-encoding. Adding or retiring a poster or a location is an edit
// here; assets/js/waitlist-hero.js only checks the shape and leaves the
// vocabulary to this file.
const POSTERS = new Set(['unclesam', 'happy']);
const LOCATIONS = new Set([
  'meilahti', 'pasila', 'myllypuro', 'kumpula', 'keskusta', 'arabia',
  'viikki', 'otaniemi', 'hanken', 'uniarts', 'diak', 'myyrmaki',
]);

// One path segment: a short lowercase slug, the shape both halves of a
// poster URL take.
const SLUG_RE = /^[a-z0-9-]{1,32}$/;

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

function validateBusiness(payload) {
  if (!payload || typeof payload !== 'object') return 'Invalid request body.';

  const businessName = typeof payload.business_name === 'string' ? payload.business_name.trim() : '';
  if (!businessName) return 'Please enter your business name.';
  if (businessName.length > 150) return 'Business name is too long.';

  const location = typeof payload.location === 'string' ? payload.location.trim() : '';
  if (!location) return 'Please enter a location.';
  if (location.length > 200) return 'Location is too long.';

  if (payload.business_type != null && !BUSINESS_TYPES.has(payload.business_type)) {
    return 'Invalid business type.';
  }

  // The "Something else, what?" write-in. Free text, so it gets the same
  // treatment as every other free-text field: a type check and a length
  // cap here, and .bind() at the insert — never string-built SQL.
  if (payload.business_type_other != null) {
    if (typeof payload.business_type_other !== 'string' || payload.business_type_other.length > 150) {
      return 'That answer is too long.';
    }
  }

  if (payload.contact_name != null) {
    if (typeof payload.contact_name !== 'string' || payload.contact_name.length > 100) {
      return 'Contact name is too long.';
    }
  }

  const method = payload.contact_method;
  if (method != null && method !== 'email' && method !== 'phone') return 'Invalid contact method.';

  if (method === 'email') {
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    if (!email || !EMAIL_RE.test(email) || email.length > 254) return 'Please enter a valid email.';
  } else if (method === 'phone') {
    const phone = typeof payload.phone === 'string' ? payload.phone.trim() : '';
    const digits = phone.replace(/[^\d]/g, '');
    if (!phone || digits.length < 7 || digits.length > 15) return 'Please enter a valid phone number.';
  }

  if (payload.current_marketing != null) {
    if (!Array.isArray(payload.current_marketing) || payload.current_marketing.length > MARKETING_CHANNELS.size) {
      return 'Invalid marketing selection.';
    }
    for (const v of payload.current_marketing) {
      if (!MARKETING_CHANNELS.has(v)) return 'Invalid marketing selection.';
    }
  }

  if (payload.slow_times != null) {
    if (typeof payload.slow_times !== 'string' || payload.slow_times.length > 300) return 'That answer is too long.';
  }

  if (payload.concept_interest != null && !CONCEPT_INTEREST.has(payload.concept_interest)) {
    return 'Invalid concept response.';
  }

  if (payload.walkin_value != null) {
    if (typeof payload.walkin_value !== 'string' || payload.walkin_value.length > 50) return 'That answer is too long.';
  }

  if (payload.pricing_pref != null && !PRICING_PREF.has(payload.pricing_pref)) {
    return 'Invalid pricing response.';
  }

  if (payload.pilot_interest != null && !PILOT_INTEREST.has(payload.pilot_interest)) {
    return 'Invalid pilot response.';
  }

  if (payload.trust_notes != null) {
    if (typeof payload.trust_notes !== 'string' || payload.trust_notes.length > 1000) return 'That answer is too long.';
  }

  return null;
}

/**
 * Every field on the survey is optional — a partial answer is worth more than
 * an abandoned one — so this only ever rejects a value that is the wrong
 * *shape*, never a missing one.
 */
function validateSurvey(payload) {
  if (!payload || typeof payload !== 'object') return 'Invalid request body.';

  if (payload.app_usage != null) {
    if (typeof payload.app_usage !== 'object' || Array.isArray(payload.app_usage)) {
      return 'Invalid app usage.';
    }
    // Cap the object before walking it: the body limit already bounds this,
    // but the allowlist is the real ceiling and it should be stated here.
    if (Object.keys(payload.app_usage).length > APP_KEYS.size) return 'Invalid app usage.';
    for (const v of Object.values(payload.app_usage)) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > APP_MINUTES_MAX) {
        return 'Invalid app usage.';
      }
    }
  }

  if (payload.apps_other != null) {
    if (typeof payload.apps_other !== 'string' || payload.apps_other.length > 150) {
      return 'That answer is too long.';
    }
  }

  if (payload.apps_verdict != null && !APPS_VERDICT.has(payload.apps_verdict)) {
    return 'Invalid answer.';
  }

  if (payload.apps_verdict_why != null) {
    if (typeof payload.apps_verdict_why !== 'string' || payload.apps_verdict_why.length > 1000) {
      return 'That answer is too long.';
    }
  }

  if (payload.strangers_per_week != null) {
    const n = payload.strangers_per_week;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > TALKS_MAX) {
      return 'Invalid answer.';
    }
  }

  if (payload.email != null) {
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    // Empty is fine — the field is optional. A typo is not, because the patch
    // then quietly never arrives.
    if (email && (!EMAIL_RE.test(email) || email.length > 254)) return 'Please enter a valid email.';
  }

  if (payload.campus != null) {
    if (typeof payload.campus !== 'string' || payload.campus.length > 100) {
      return 'That answer is too long.';
    }
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

async function handleWaitlist(request, env, origin, ctx) {
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
  // Which poster's QR brought them here, and where it was hanging. Anything
  // outside the allowlists is dropped rather than rejected — a mangled query
  // string must never cost a signup. The two are independent: a recognised
  // poster still counts even if the location came through unreadable.
  const poster = POSTERS.has(payload.poster) ? payload.poster : null;
  const posterLocation = LOCATIONS.has(payload.poster_location) ? payload.poster_location : null;
  const createdAt = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO signups (name, contact_method, email, phone, poster, poster_location, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(name, contactMethod, email, phone, poster, posterLocation, createdAt)
      .run();
    // Only a genuine new row gets a welcome email — never the duplicate path
    // below, and never a phone-only signup.
    if (contactMethod === 'email' && ctx) {
      // SURVEY_URL is optional. With one configured the welcome mail carries
      // the survey ask and the patch that comes with it; without one it is
      // the plain welcome, rather than an ask linking somewhere broken.
      const surveyUrl = env.SURVEY_URL || null;
      ctx.waitUntil(sendEmail(env, {
        to: email,
        template: surveyUrl ? 'welcomeWithSurvey' : 'welcome',
        data: { name, surveyUrl },
      }));
    }
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

async function handleBusiness(request, env, origin) {
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

  const error = validateBusiness(payload);
  if (error) return json(400, { error }, origin);

  const businessName = payload.business_name.trim();
  const location = payload.location.trim();
  const businessType = payload.business_type || null;
  // Only meaningful alongside 'other' — anything sent with a real category
  // is dropped, so the column can't disagree with business_type.
  const businessTypeOther = businessType === 'other'
    ? ((typeof payload.business_type_other === 'string' && payload.business_type_other.trim()) || null)
    : null;
  const contactName = (typeof payload.contact_name === 'string' && payload.contact_name.trim()) || null;
  const contactMethod = payload.contact_method || null;
  // Lower-cased for case-insensitive dedup against the unique index.
  const email = contactMethod === 'email' ? payload.email.trim().toLowerCase() : null;
  const phone = contactMethod === 'phone' ? payload.phone.trim() : null;
  const currentMarketing = Array.isArray(payload.current_marketing) && payload.current_marketing.length
    ? payload.current_marketing.join(',')
    : null;
  const slowTimes = (typeof payload.slow_times === 'string' && payload.slow_times.trim()) || null;
  const conceptInterest = payload.concept_interest || null;
  const walkinValue = (typeof payload.walkin_value === 'string' && payload.walkin_value.trim()) || null;
  const pricingPref = payload.pricing_pref || null;
  const pilotInterest = payload.pilot_interest || null;
  const trustNotes = (typeof payload.trust_notes === 'string' && payload.trust_notes.trim()) || null;
  const createdAt = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO business_signups (
         business_name, location, business_type, business_type_other,
         contact_name, contact_method, email, phone, current_marketing,
         slow_times, concept_interest, walkin_value, pricing_pref,
         pilot_interest, trust_notes, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        businessName, location, businessType, businessTypeOther,
        contactName, contactMethod, email, phone, currentMarketing,
        slowTimes, conceptInterest, walkinValue, pricingPref,
        pilotInterest, trustNotes, createdAt
      )
      .run();
    return json(201, { ok: true }, origin);
  } catch (err) {
    if (String(err && err.message).includes('UNIQUE')) {
      // Already submitted with this email/phone — same response as
      // success, so the endpoint can't be used to check registration.
      return json(201, { ok: true }, origin);
    }
    console.error('D1 insert failed:', err);
    return json(500, { error: 'Could not save your submission. Please try again.' }, origin);
  }
}

async function handleSurvey(request, env, origin) {
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

  const error = validateSurvey(payload);
  if (error) return json(400, { error }, origin);

  // Keep only the apps this Worker knows, and round to whole minutes so the
  // stored JSON can't carry a float the page never produced. An app nobody
  // moved is absent, not zero — "not answered" and "I use it none" are
  // different answers and the column keeps them apart.
  let appUsage = null;
  if (payload.app_usage) {
    const kept = {};
    for (const [key, minutes] of Object.entries(payload.app_usage)) {
      if (APP_KEYS.has(key) && minutes > 0) kept[key] = Math.round(minutes);
    }
    if (Object.keys(kept).length) appUsage = JSON.stringify(kept);
  }

  const appsOther = (typeof payload.apps_other === 'string' && payload.apps_other.trim()) || null;
  const appsVerdict = payload.apps_verdict || null;
  const appsVerdictWhy =
    (typeof payload.apps_verdict_why === 'string' && payload.apps_verdict_why.trim()) || null;
  const strangers = typeof payload.strangers_per_week === 'number' ? payload.strangers_per_week : null;
  // Lower-cased to match how signups store an address, so the patch list can
  // be lined up against the waitlist without a case-folding join.
  const email = (typeof payload.email === 'string' && payload.email.trim().toLowerCase()) || null;
  const campus = (typeof payload.campus === 'string' && payload.campus.trim()) || null;
  const createdAt = new Date().toISOString();

  // Somebody who dragged nothing, picked nothing and typed nothing has told us
  // nothing — that's a stray submit, not a response, and it shouldn't sit in
  // the counts. An email alone is likewise not an answer.
  if (!appUsage && !appsOther && !appsVerdict && !appsVerdictWhy && strangers === null) {
    return json(201, { ok: true }, origin);
  }

  try {
    await env.DB.prepare(
      `INSERT INTO survey_responses (
         app_usage, app_usage_other, apps_verdict, apps_verdict_why,
         strangers_per_week, email, campus, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(appUsage, appsOther, appsVerdict, appsVerdictWhy, strangers, email, campus, createdAt)
      .run();
    return json(201, { ok: true }, origin);
  } catch (err) {
    console.error('D1 insert failed:', err);
    return json(500, { error: 'Could not save your answers. Please try again.' }, origin);
  }
}

// GET /<location>/<poster> — the URL printed on the posters. Counts the scan,
// then bounces to the waitlist carrying both values in the query string.
//
// Counting here rather than in page JS means a reload of the landing page
// doesn't recount, and nothing has to be stored on the visitor's device.
async function handleScan(location, poster, request, env) {
  const site = env.SITE_ORIGIN || 'https://hellomin.app';

  // Its own limiter namespace: if scans shared RATE_LIMITER with the forms,
  // a burst of scans from one network could 429 somebody's actual signup.
  let allowed = true;
  if (env.SCAN_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    ({ success: allowed } = await env.SCAN_LIMITER.limit({ key: ip }));
  }

  if (allowed) {
    try {
      await env.DB.prepare(
        'INSERT INTO poster_scans (location, poster, created_at) VALUES (?, ?, ?)'
      )
        .bind(location, poster, new Date().toISOString())
        .run();
    } catch (err) {
      // Never strand a real person on an error page over a counter.
      console.error('D1 scan insert failed:', err);
    }
  }

  return new Response(null, {
    status: 302,
    headers: {
      // no-store matters: a cached 302 would skip the Worker and undercount.
      Location: `${site}/waitlist/?l=${encodeURIComponent(location)}&p=${encodeURIComponent(poster)}`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function handleAdminList(request, env, origin) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!env.ADMIN_TOKEN || !timingSafeEqual(token, env.ADMIN_TOKEN)) {
    return json(401, { error: 'Unauthorized.' }, origin);
  }

  const countRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM signups').first();
  const recent = await env.DB.prepare(
    `SELECT id, name, contact_method, email, phone, poster, poster_location, created_at
     FROM signups ORDER BY id DESC LIMIT 100`
  ).all();

  return json(200, { count: countRow.n, recent: recent.results }, origin);
}

async function handleAdminBusinessList(request, env, origin) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!env.ADMIN_TOKEN || !timingSafeEqual(token, env.ADMIN_TOKEN)) {
    return json(401, { error: 'Unauthorized.' }, origin);
  }

  const countRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM business_signups').first();
  const recent = await env.DB.prepare(
    `SELECT id, business_name, location, business_type, business_type_other,
            contact_name, contact_method, email, phone, current_marketing,
            slow_times, concept_interest, walkin_value, pricing_pref,
            pilot_interest, trust_notes, created_at
     FROM business_signups ORDER BY id DESC LIMIT 100`
  ).all();

  return json(200, { count: countRow.n, recent: recent.results }, origin);
}

async function handleAdminSurvey(request, env, origin) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!env.ADMIN_TOKEN || !timingSafeEqual(token, env.ADMIN_TOKEN)) {
    return json(401, { error: 'Unauthorized.' }, origin);
  }

  const countRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM survey_responses').first();
  const recent = await env.DB.prepare(
    `SELECT id, app_usage, app_usage_other, apps_verdict, apps_verdict_why,
            strangers_per_week, email, campus, created_at
     FROM survey_responses ORDER BY id DESC LIMIT 100`
  ).all();

  // The two aggregates worth having without a spreadsheet: the yes/no split,
  // and the average number of conversations a week. Both skip the rows that
  // left the question alone, so an unanswered question can't read as a zero.
  const verdict = await env.DB.prepare(
    `SELECT apps_verdict, COUNT(*) AS n FROM survey_responses
      WHERE apps_verdict IS NOT NULL GROUP BY apps_verdict`
  ).all();
  const talks = await env.DB.prepare(
    `SELECT AVG(strangers_per_week) AS avg, COUNT(*) AS n FROM survey_responses
      WHERE strangers_per_week IS NOT NULL`
  ).first();

  const verdictSplit = { yes: 0, no: 0 };
  for (const row of verdict.results) verdictSplit[row.apps_verdict] = row.n;

  return json(200, {
    count: countRow.n,
    verdict: verdictSplit,
    strangers_per_week: {
      answered: talks.n,
      average: talks.avg == null ? null : Number(talks.avg.toFixed(2)),
    },
    // app_usage arrives as the stored JSON string; parsed here so the caller
    // reads numbers rather than doing it once per row itself.
    recent: recent.results.map((row) => ({
      ...row,
      app_usage: row.app_usage ? JSON.parse(row.app_usage) : null,
    })),
  }, origin);
}

async function handleAdminPosters(request, env, origin) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!env.ADMIN_TOKEN || !timingSafeEqual(token, env.ADMIN_TOKEN)) {
    return json(401, { error: 'Unauthorized.' }, origin);
  }

  const scans = await env.DB.prepare(
    `SELECT location, poster, COUNT(*) AS scans
       FROM poster_scans GROUP BY location, poster`
  ).all();
  const signups = await env.DB.prepare(
    `SELECT poster_location AS location, poster, COUNT(*) AS signups
       FROM signups WHERE poster IS NOT NULL GROUP BY poster_location, poster`
  ).all();

  // Seed both views from the allowlists, so a cell nobody has scanned yet
  // reports a zero row instead of vanishing from the comparison.
  const byPoster = new Map();
  for (const p of POSTERS) byPoster.set(p, { poster: p, scans: 0, signups: 0, conversion: 0 });

  const byLocation = new Map();
  for (const loc of LOCATIONS) {
    for (const p of POSTERS) {
      byLocation.set(`${loc}/${p}`, { location: loc, poster: p, scans: 0, signups: 0, conversion: 0 });
    }
  }

  function tally(rows, field) {
    for (const row of rows) {
      // Pool first. A row whose location is missing or unrecognised still
      // belongs in the poster comparison, which is the headline number.
      if (byPoster.has(row.poster)) byPoster.get(row.poster)[field] += row[field];
      const cell = byLocation.get(`${row.location}/${row.poster}`);
      if (cell) cell[field] += row[field];
    }
  }
  tally(scans.results, 'scans');
  tally(signups.results, 'signups');

  for (const row of [...byPoster.values(), ...byLocation.values()]) {
    row.conversion = row.scans ? Number((row.signups / row.scans).toFixed(4)) : 0;
  }

  // by_poster is where the sample size is — 24 cells split the traffic thin,
  // so read by_location for placement, not for deciding the A/B.
  return json(200, {
    by_poster: [...byPoster.values()],
    by_location: [...byLocation.values()],
  }, origin);
}

export default {
  async fetch(request, env, ctx) {
    const origin = env.ALLOW_ORIGIN || '*';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json(200, { ok: true }, origin);
    }

    if (request.method === 'POST' && (url.pathname === '/waitlist' || url.pathname === '/waitlist/')) {
      return handleWaitlist(request, env, origin, ctx);
    }

    if (request.method === 'POST' && (url.pathname === '/business' || url.pathname === '/business/')) {
      return handleBusiness(request, env, origin);
    }

    if (request.method === 'POST' && (url.pathname === '/survey' || url.pathname === '/survey/')) {
      return handleSurvey(request, env, origin);
    }

    if (request.method === 'GET' && url.pathname === '/admin/signups') {
      return handleAdminList(request, env, origin);
    }

    if (request.method === 'GET' && url.pathname === '/admin/business-signups') {
      return handleAdminBusinessList(request, env, origin);
    }

    if (request.method === 'GET' && url.pathname === '/admin/survey') {
      return handleAdminSurvey(request, env, origin);
    }

    if (request.method === 'GET' && url.pathname === '/admin/posters') {
      return handleAdminPosters(request, env, origin);
    }

    // /<location>/<poster> — the URL printed on the posters, kept short so it
    // reads cleanly under a QR code. Matched last, after every named endpoint
    // above, so a two-segment path like /admin/signups can never fall in here.
    if (request.method === 'GET') {
      const segments = url.pathname.replace(/\/$/, '').split('/').slice(1);
      if (segments.length === 2 && segments.every((seg) => SLUG_RE.test(seg))) {
        const [location, poster] = segments;
        if (LOCATIONS.has(location) && POSTERS.has(poster)) {
          return handleScan(location, poster, request, env);
        }
        // A typo'd or retired poster still lands somewhere useful — QR codes
        // on paper outlive the campaign that printed them.
        const site = env.SITE_ORIGIN || 'https://hellomin.app';
        return Response.redirect(`${site}/waitlist/`, 302);
      }
    }

    return json(404, { error: 'Not found.' }, origin);
  },
};
