/* ============================================================
   Min — the waitlist survey
   ------------------------------------------------------------
   The questionnaire behind the welcome email's "Fill in the
   survey" button. Same shape as business.js, minus the sunrise:
   this page stays at cave, so there is no colour ramp and no
   three.js atmosphere to load, and it deliberately never stamps
   .js-ready (that class is what business.css uses to decide the
   cards no longer need their own opaque material).

   1. reveals()   — IntersectionObserver adds .in; CSS runs the
                    emergence recipe, shared with the landing page.
   2. sliders()   — builds every rail from the lists below and
                    keeps the readout and the fill in step.
   3. minBodies() — Min in the wordmark's i-dot, and on the thanks.
   4. buttons()   — the submerge press on .btn.
   5. form()      — validation + submit to the Worker.

   Nothing on the page is required. The only validation is the
   email's shape, and only if somebody typed one.
   ============================================================ */

import { buttons } from '/assets/js/press.js';
import { minBodies } from '/assets/js/min.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- the apps ----------------------------------------
   Keys are what the Worker stores, so they are lowercase slugs and
   they must stay in step with APP_KEYS in min-waitlist-worker src/index.js —
   anything it doesn't recognise is dropped on the way in.

   The list is deliberately short. Every extra rail is another thing
   to drag before the question people actually came to answer, and
   the long tail lands in the "anything we've missed" write-in. */
const APPS = {
  social: [
    ['instagram', 'Instagram'],
    ['tiktok',    'TikTok'],
    ['snapchat',  'Snapchat'],
    ['youtube',   'YouTube'],
    ['facebook',  'Facebook'],
    ['x',         'X / Twitter'],
    ['reddit',    'Reddit'],
  ],
  matching: [
    ['tinder', 'Tinder'],
    ['bumble', 'Bumble'],
    ['hinge',  'Hinge'],
    ['other_dating', 'Any other dating app'],
  ],
};

/* Minutes a day, in quarter-hour steps up to five hours. The top of
   the rail is open-ended ("5h+") because the people past it are rare
   and the exact figure stops mattering once it is that high. */
const MINUTES_MAX = 300;
const MINUTES_STEP = 15;

/* Conversations a week. Twenty is likewise a ceiling, not a limit. */
const TALKS_MAX = 20;

function minutesLabel(v) {
  if (v === 0) return 'None';
  const h = Math.floor(v / 60);
  const m = v % 60;
  const text = h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  return v >= MINUTES_MAX ? `${text}+` : text;
}

function talksLabel(v) {
  if (v === 0) return 'Never';
  if (v >= TALKS_MAX) return `${TALKS_MAX}+ a week`;
  return v === 1 ? 'Once a week' : `${v} a week`;
}

/* ---------- 1. reveals -------------------------------------- */

function reveals() {
  // No observer (very old browser) — show everything rather than leave
  // a form nobody can read. Same guarantee as the CSS fail-safe.
  if (!('IntersectionObserver' in window)) {
    document.documentElement.classList.remove('reveal-armed');
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '-8% 0px -8% 0px' }
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
}

/* ---------- 2. the sliders ---------------------------------- */

/* One row: a label, a live readout, and a real <input type="range">.
   The range does the work — keyboard, screen reader and touch all
   come free — and the only thing painted on top of it is --fill, the
   percentage the CSS stops the accent at. */
function sliderRow({ key, label, max, step, format, name }) {
  const row = document.createElement('div');
  row.className = 'slider-row is-zero';

  const id = `slider-${key}`;
  row.innerHTML = `
    <div class="slider-row__head">
      <label class="slider-row__label" for="${id}"></label>
      <output class="slider-row__value" for="${id}"></output>
    </div>
    <input class="slider" type="range" id="${id}" name="${name}"
           min="0" max="${max}" step="${step}" value="0">`;

  // Written in, not interpolated: an app name is data, and data never
  // goes into markup as HTML.
  row.querySelector('.slider-row__label').textContent = label;

  const input = row.querySelector('.slider');
  const value = row.querySelector('.slider-row__value');

  const sync = () => {
    const v = Number(input.value);
    value.textContent = format(v);
    // aria-valuetext, or a screen reader reads "45" with no unit.
    input.setAttribute('aria-valuetext', `${label}: ${format(v)}`);
    input.style.setProperty('--fill', `${(v / max) * 100}%`);
    row.classList.toggle('is-zero', v === 0);
  };

  input.addEventListener('input', sync);
  sync();

  return { row, input };
}

function sliders() {
  const values = new Map();

  for (const [group, list] of Object.entries(APPS)) {
    const host = document.querySelector(`[data-sliders="${group}"]`);
    if (!host) continue;
    for (const [key, label] of list) {
      const { row, input } = sliderRow({
        key,
        label,
        name: `app_${key}`,
        max: MINUTES_MAX,
        step: MINUTES_STEP,
        format: minutesLabel,
      });
      host.appendChild(row);
      values.set(key, input);
    }
  }

  const strangersHost = document.querySelector('[data-sliders="strangers"]');
  let strangers = null;
  if (strangersHost) {
    const built = sliderRow({
      key: 'strangers',
      label: 'Times a week I talk to someone new',
      name: 'strangers_per_week',
      max: TALKS_MAX,
      step: 1,
      format: talksLabel,
    });
    strangersHost.appendChild(built.row);
    strangers = built.input;
  }

  return {
    // Only the apps somebody actually moved. Sending eleven zeroes
    // would record "I use nothing" for every rail they never touched,
    // which is a different claim from "no answer".
    appUsage() {
      const out = {};
      for (const [key, input] of values) {
        const v = Number(input.value);
        if (v > 0) out[key] = v;
      }
      return out;
    },
    strangersPerWeek() {
      return strangers ? Number(strangers.value) : null;
    },
  };
}

/* ---------- 5. the form -------------------------------------
   Served from a local static server, talk to a local `wrangler dev`
   instead of production — otherwise previewing the page writes test
   rows into the live database. Any other host is production, so this
   can't leak off localhost. Override with window.KIN_API_BASE. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const DEFAULT_API = LOCAL_HOSTS.has(location.hostname)
  ? 'http://localhost:8787'
  : 'https://api.hellomin.app';

const API_BASE = (window.KIN_API_BASE || DEFAULT_API).replace(/\/$/, '');
const SUBMIT_URL = API_BASE + '/survey';

function form(rails) {
  const el = document.getElementById('survey-form');
  if (!el) return;

  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('email-error');
  const campusInput = document.getElementById('campus');
  const appsOtherInput = document.getElementById('apps_other');
  const whyInput = document.getElementById('apps_verdict_why');
  const websiteInput = document.getElementById('website');
  const formStatus = document.getElementById('form-status');
  const submitButton = el.querySelector('button.submit');
  const submitLabel = submitButton.querySelector('.btn__label') || submitButton;

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const radioValue = (name) =>
    el.querySelector(`input[name="${name}"]:checked`)?.value ?? null;

  el.addEventListener('submit', async (e) => {
    e.preventDefault();

    emailError.textContent = '';
    formStatus.textContent = '';
    formStatus.className = 'status';

    // The one check on the page, and only when there's something to
    // check: an address we can't write to is worse than none, because
    // the patch then quietly never arrives.
    const email = emailInput.value.trim();
    if (email && !isValidEmail(email)) {
      emailError.textContent = 'That email doesn’t look right.';
      formStatus.textContent = 'Almost — that email needs a look.';
      formStatus.className = 'status error';
      emailInput.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      emailInput.focus({ preventScroll: true });
      return;
    }

    const payload = {
      app_usage: rails.appUsage(),
      apps_other: appsOtherInput.value.trim() || null,
      apps_verdict: radioValue('apps_verdict'),
      apps_verdict_why: whyInput.value.trim() || null,
      strangers_per_week: rails.strangersPerWeek(),
      email: email || null,
      campus: campusInput.value.trim() || null,
      website: websiteInput ? websiteInput.value : '' // honeypot — always empty for real users
    };

    const originalLabel = submitLabel.textContent;
    submitButton.disabled = true;
    submitLabel.textContent = 'Sending…';

    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let message = 'Something went wrong. Please try again.';
        try {
          const data = await res.json();
          if (data && data.error) message = data.error;
        } catch (_) { /* non-JSON error response */ }
        throw new Error(message);
      }

      const success = document.getElementById('success-view');
      el.style.display = 'none';
      success.style.display = 'block';
      success.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    } catch (err) {
      submitButton.disabled = false;
      submitLabel.textContent = originalLabel;
      formStatus.textContent = err.message || 'Network error. Please try again.';
      formStatus.className = 'status error';
    }
  });
}

/* ---------- boot -------------------------------------------- */

reveals();
const rails = sliders();
minBodies();
buttons();
form(rails);
