/* ============================================================
   min — the IRL moments survey, v2 (/survey/v2/)
   ------------------------------------------------------------
   Spec: min/my survey.md. The rules:

     • The answers are anonymous. The one exception is the
       optional invite email after a "joined", which the Worker
       stores in a table of its own, never on the response row.
     • Nothing is required. The only validation is the shape of
       an email, and only when somebody typed one.
     • The two counters start empty: − gives 0, + gives 1, so a
       0 is a tap, not a default. 0 skips the "who with" after it.
     • The notification says "in 15 min" or "in 2 hours", drawn
       per visit. Nothing else changes, so the "joined" rates of
       the two can be compared.
     • ?src= (waitlist, campus, social, friend) rides along.

   1. reveals()  — IntersectionObserver adds .in.
   2. controls   — counters, tick list, the conditional fields.
   3. form()     — validation + submit to the Worker.
   ============================================================ */

import { buttons } from '/assets/js/press.js';
import { minBodies } from '/assets/js/min.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- question 5: what keeps them from more ----------
   Keys are what the Worker stores (V2_BLOCKER_KEYS in its
   index.js); it drops anything it doesn't recognise. The first
   row stands alone and stays on top; the rest shuffle. */
const BLOCKERS = [
  ['dont_want',   "I don't want more"],
  ['effort',      'Finding or planning something takes too much effort'],
  ['schedules',   "My friends are busy, or our schedules don't line up"],
  ['few_people',  "I don't know enough people"],
  ['anxious',     'I feel awkward or anxious meeting new people'],
  ['unsafe',      "I don't feel safe meeting strangers"],
  ['cost',        'It costs too much money'],
  ['no_time',     'No time'],
];
const ALONE = 'dont_want';
const PICK_MAX = 2;

/* The counters run 0 to 10, and 10 reads "10+". */
const COUNT_MAX = 10;

/* ---------- question 6: the lead time ----------------------
   Must match V2_INVITE_LEADS in the Worker. crypto, not
   Math.random(): the draw is the experiment. */
const LEADS = { '15m': '15 min', '2h': '2 hours' };
const LEAD = Object.keys(LEADS)[crypto.getRandomValues(new Uint8Array(1))[0] % 2];
const JOINED = new Set(['joined', 'joined_friends']);

/* Where the link was shared. Must match V2_SOURCES in the Worker. */
const SOURCE = new URLSearchParams(location.search).get('src')?.toLowerCase() || null;

/* ---------- 1. reveals -------------------------------------- */

function reveals() {
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

/* ---------- 2. controls ------------------------------------- */

/* "Question n of m" over the cards still showing, so a skip
   doesn't leave a gap in the count. */
function renumber() {
  const cards = [...document.querySelectorAll('[data-q]')].filter((c) => !c.hidden);
  cards.forEach((card, i) => {
    const step = card.querySelector('[data-step]');
    if (step) step.textContent = `Question ${i + 1} of ${cards.length}`;
  });
}

/* A − / value / + stepper. Empty until the first tap. At 0 the
   card named by `skips` hides and its answer clears. */
function counter(name, skips) {
  const host = document.querySelector(`[data-counter="${name}"]`);
  const skipCard = document.getElementById(skips);
  let value = null;

  host.innerHTML = `
    <button type="button" class="counter__btn" data-d="-1" aria-label="One fewer">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
    <output class="counter__value" aria-live="polite"></output>
    <button type="button" class="counter__btn" data-d="1" aria-label="One more">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9h10M9 4v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>`;
  const out = host.querySelector('output');
  const [minus, plus] = host.querySelectorAll('button');

  const sync = () => {
    out.textContent = value === null ? 'Tap − or +' : value >= COUNT_MAX ? `${COUNT_MAX}+` : String(value);
    host.classList.toggle('is-empty', value === null);
    minus.disabled = value === 0;
    plus.disabled = value === COUNT_MAX;
    const skip = value === 0;
    if (skipCard && skipCard.hidden !== skip) {
      skipCard.hidden = skip;
      if (skip) skipCard.querySelectorAll('input').forEach((i) => { i.checked = false; });
      renumber();
    }
  };

  for (const btn of [minus, plus]) {
    btn.addEventListener('click', () => {
      const d = Number(btn.dataset.d);
      value = value === null ? (d > 0 ? 1 : 0) : Math.min(COUNT_MAX, Math.max(0, value + d));
      sync();
    });
  }
  sync();
  return () => value;
}

/* Question 5: up to two, and "I don't want more" stands alone. At
   two, the rest grey out rather than silently swapping a tick. */
function blockers() {
  const host = document.querySelector('[data-checks="blockers"]');
  const boxes = new Map();
  // The rest shuffle per visit (Fisher–Yates), so no row wins by being
  // first; "I don't want more" stays on top.
  const rest = BLOCKERS.slice(1);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  for (const [key, label] of [BLOCKERS[0], ...rest]) {
    const wrap = document.createElement('label');
    wrap.className = 'option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = `blockers_${key}`;
    input.value = key;
    const text = document.createElement('span');
    text.textContent = label;
    wrap.append(input, text);
    host.appendChild(wrap);
    boxes.set(key, input);
  }

  const sync = () => {
    const n = [...boxes.values()].filter((b) => b.checked).length;
    for (const box of boxes.values()) {
      box.disabled = !box.checked && n >= PICK_MAX;
      box.closest('label').classList.toggle('is-disabled', box.disabled);
    }
  };

  for (const [key, input] of boxes) {
    input.addEventListener('change', () => {
      if (input.checked) {
        if (key === ALONE) {
          for (const [k, other] of boxes) if (k !== ALONE) other.checked = false;
        } else {
          boxes.get(ALONE).checked = false;
        }
      }
      sync();
    });
  }

  return () => [...boxes].filter(([, b]) => b.checked).map(([k]) => k);
}

/* Question 6: the drawn lead time, "Depends…" opens its box, and
   a "joined" opens the invite email. */
function reaction() {
  document.getElementById('notif-lead').textContent = LEADS[LEAD];
  const depends = document.getElementById('depends-field');
  const invite = document.getElementById('invite-field');
  document.querySelectorAll('input[name="reaction"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      depends.hidden = input.value !== 'depends';
      invite.hidden = !JOINED.has(input.value);
      if (!depends.hidden) depends.querySelector('input').focus();
    });
  });
}

function selfDescribe() {
  const field = document.getElementById('gender_self_describe-field');
  if (!field) return;
  document.querySelectorAll('input[name="gender"]').forEach((input) => {
    input.addEventListener('change', () => {
      const on = input.checked && input.value === 'self_describe';
      field.style.display = on ? '' : 'none';
      if (on) field.querySelector('input')?.focus();
    });
  });
}

/* ---------- 3. the form -------------------------------------
   Local static server → local `wrangler dev`, so previewing never
   writes into the live database. Override with window.KIN_API_BASE. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const DEFAULT_API = LOCAL_HOSTS.has(location.hostname)
  ? 'http://localhost:8787'
  : 'https://api.hellomin.app';

const API_BASE = (window.KIN_API_BASE || DEFAULT_API).replace(/\/$/, '');
const SUBMIT_URL = API_BASE + '/survey/v2';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function form(past, want, picked) {
  const el = document.getElementById('survey-form');
  if (!el) return;

  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('email-error');
  const formStatus = document.getElementById('form-status');
  const submitButton = el.querySelector('button.submit');
  const submitLabel = submitButton.querySelector('.btn__label') || submitButton;

  const radioValue = (name) =>
    el.querySelector(`input[name="${name}"]:checked`)?.value ?? null;
  const text = (id) => document.getElementById(id)?.value.trim() || null;

  el.addEventListener('submit', async (e) => {
    e.preventDefault();

    emailError.textContent = '';
    formStatus.textContent = '';
    formStatus.className = 'status';

    const react = radioValue('reaction');
    // Only after a "joined" is the email showing, so only then is it sent.
    const email = JOINED.has(react) ? text('email') : null;
    if (email && !EMAIL_RE.test(email)) {
      emailError.textContent = "That email looks off. Or leave it empty, that's fine too.";
      formStatus.textContent = 'Almost, the email needs a look.';
      formStatus.className = 'status error';
      emailInput.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      emailInput.focus({ preventScroll: true });
      return;
    }

    const gender = radioValue('gender');
    const payload = {
      moments_past:     past(),
      with_past:        radioValue('with_past'),
      moments_want:     want(),
      with_want:        radioValue('with_want'),
      blockers:         picked(),
      reaction:         react,
      reaction_depends: react === 'depends' ? text('reaction_depends') : null,
      invite_lead:      LEAD,
      status:           radioValue('status'),
      moved_recently:   radioValue('moved_recently'),
      age:              radioValue('age'),
      gender,
      gender_self_describe: gender === 'self_describe' ? text('gender_self_describe') : null,
      email,            // split off by the Worker, never stored with the answers
      source:           SOURCE,
      website: document.getElementById('website')?.value ?? '' // honeypot
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
const past = counter('moments_past', 'with-past-card');
const want = counter('moments_want', 'with-want-card');
const picked = blockers();
reaction();
selfDescribe();
renumber();
minBodies();
buttons();
form(past, want, picked);
