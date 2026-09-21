/* ============================================================
   Min — the Pro survey (what to gate, and at what price)
   ------------------------------------------------------------
   Sibling to survey.js, built on the same parts: the same reveal
   observer, the same submit, the same honeypot. What is new is
   question 5, which names a person's own question 4 ticks back to
   them and asks what that costs.

   The page is an instrument before it is a page, so its rules
   live in code rather than in copy:

     • Explain the free product first, price second. Nothing is
       priced until the person has read what the free version does
       and said what they would use it for. Asking earlier prices
       a blank.
     • Every extra is a tick, never a rating. The gating question
       is "who wants this", and a tick answers it; a five-point
       scale returns four out of five for everything.
     • We name no figure. Question 5 is their number against their
       own ticks, which means every person prices a different
       bundle. The analysis is a cross-tab, not an average.
     • Nothing is required. The only validation is the shape of an
       email and the shape of a number, and only when somebody
       typed one. A survey that blocks gets abandoned, and a
       partial answer beats no answer.

   ⚠️ No list in this file mentions AI, and none should.

   1. reveals()  — IntersectionObserver adds .in; CSS runs the
                   emergence recipe, shared with the landing page.
   2. checks()   — builds the three tick grids from the lists below.
   3. picks()    — question 4 read back into question 5, live.
   4. minBodies()— Min in the wordmark's i-dot, and on the thanks.
   5. buttons()  — the submerge press on .btn.
   6. form()     — validation + submit to the Worker.
   ============================================================ */

import { buttons } from '/assets/js/press.js';
import { minBodies } from '/assets/js/min.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- question 1: what they've already paid for -------
   Not a subscription audit. Every row is something somebody pays
   for in order to have a social life, because the question worth
   answering is whether this cohort treats meeting people as
   something you can buy at all. A page of empty ticks would be a
   finding about the whole tier, not about its price.

   Written for a Helsinki student specifically: guild and student
   association fees belong here and would be missing from any
   generic list.

   Keys are what the Worker stores, so they are lowercase slugs
   and must stay in step with SERVICE_KEYS in min-waitlist-worker
   src/index.js. Anything it doesn't recognise is dropped. */
const SERVICES = [
  ['dating',      'A dating app (Tinder, Bumble, Hinge…)'],
  ['gym',         'A gym or fitness club'],
  ['sports_club', 'A sports team or club fees'],
  ['guild',       'A student association or guild (AYY, HYY, a guild)'],
  ['hobby_club',  'A hobby club or society'],
  ['language',    'A language or conversation club'],
  ['course',      'A course you took partly to meet people'],
  ['meetup',      'A meetup or community membership'],
  ['events',      'Tickets to something you went to mainly to meet people'],
  ['online',      'A paid online community (Discord, Patreon…)'],
  ['none',        'None of these'],
];

/* ---------- question 3: intent ------------------------------
   The user-facing wording of the intents the product actually
   models. Min carries several at once rather than one label (see
   min-brain Product/Features/Min.md), so this is a multi-select
   and not a single choice.

   `dating` is on the list on purpose. The FAQ says Min is not a
   dating app and that what a meeting becomes is up to the two
   people. Leaving the row off would not change how many people
   want it, only our ability to see how many. */
const INTENTS = [
  ['friends',    'Making actual friends'],
  ['activity',   'Someone to do a specific thing with (sport, gym, games…)'],
  ['company',    'Company right now, not a friendship, just someone to talk to'],
  ['new_city',   'Meeting people outside my usual circle, or I’m new here'],
  ['language',   'Practising a language'],
  ['dating',     'Something that might turn into dating'],
  ['work',       'People in my field, or to work on something with'],
  ['curious',    'Not sure, just curious'],
];

/* ---------- question 4: the extras --------------------------
   Things that could sit on top of the free version. Each row has
   to read as something somebody could want on its own, because
   question 5 names them back individually.

   The first three rows are the three variables an encounter has:
   WHO, WHEN and WHERE. They sit together and first because the
   open question in min-brain's "chance vs control as the pro
   line" note is whether the paid tier sells control over those
   variables or sells planning as one thing. Separate rows are
   what makes that readable: if `when` and `where` are only ever
   ticked together, the tier is planning; if they come apart, it
   is control, and they can be gated apart.

   Three rows are not what they look like, and all three matter
   more than their tick count:

     choose  — scored SPLIT BY GENDER. It is a safety feature to
               one half of the cohort and a filtering feature to
               the other, and that difference is the largest
               single risk in the subscription model. It is the
               only reason question 6 asks gender.
     when    — read against `choose`. A male-skewed tick on both
               is the filter spiral wearing a calendar, which is
               the objection that note raises against itself.
     travel  — a control. Nobody who has not used the app can know
               whether another city is worth anything, so ticks
               here measure the appeal of the sentence rather than
               of the feature. A high count is not a reason to
               build it sooner.

   `short` is what question 5 lists back. It is a phrase in a
   list, so it drops the explanatory half of the label. */
const EXTRAS = [
  ['choose', 'Choose who you meet',
             'Say who you’re comfortable meeting, and only get introduced to those people',
             'choosing who you meet'],
  ['when',   'Pick when you meet',
             'Line up a meeting for a time that suits you, instead of waiting for one to come up',
             'picking when you meet'],
  ['where',  'Pick where you meet',
             'Choose the spot yourself, instead of taking the one Min suggests',
             'picking where you meet'],
  ['sooner', 'Skip the wait',
             'Get introduced sooner when there are people around',
             'skipping the wait'],
  ['more',   'More time with Min',
             'Talk to Min as much as you like, instead of a set amount each day',
             'more time with Min'],
  ['knows',  'A Min that knows you better',
             'It remembers more, and gets the introduction right more often',
             'a Min that knows you better'],
  ['groups', 'Curated group things',
             'Small organised activities, picked rather than open to everyone',
             'curated group things'],
  ['custom', 'Make Min yours',
             'Change how Min looks and sounds',
             'making Min yours'],
  ['travel', 'Works in other cities',
             'Use it properly when you travel',
             'using it in other cities'],
];

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

/* ---------- 2. the tick grids -------------------------------
   One builder for all three questions. A row is a real checkbox
   inside a label, so keyboard, screen reader and touch all come
   free and there is nothing to reimplement.

   `exclusive` is the key of a row that clears every other row and
   is cleared by them: "None of these" ticked alongside three
   others is unreadable, and there is no honest way to guess which
   half the person meant. */
function checks(host, rows, { exclusive = null, event = null } = {}) {
  const el = document.querySelector(host);
  if (!el) return { picked: () => [] };

  const boxes = new Map();

  for (const row of rows) {
    const [key, label, note] = row;

    const wrap = document.createElement('label');
    wrap.className = note ? 'option option--noted' : 'option';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = `${el.dataset.checks}_${key}`;
    input.value = key;

    const text = document.createElement('span');
    // Written in, not interpolated: a label is data, and data never
    // goes into markup as HTML.
    text.textContent = label;

    if (note) {
      const gloss = document.createElement('small');
      gloss.className = 'option__note';
      gloss.textContent = note;
      text.appendChild(gloss);
    }

    wrap.append(input, text);
    el.appendChild(wrap);
    boxes.set(key, input);
  }

  for (const [key, input] of boxes) {
    input.addEventListener('change', () => {
      if (exclusive) {
        if (key === exclusive && input.checked) {
          for (const [k, other] of boxes) if (k !== exclusive) other.checked = false;
        } else if (key !== exclusive && input.checked) {
          boxes.get(exclusive).checked = false;
        }
      }
      if (event) document.dispatchEvent(new CustomEvent(event));
    });
  }

  return {
    picked() {
      const out = [];
      for (const [key, input] of boxes) if (input.checked) out.push(key);
      return out;
    },
  };
}

/* ---------- 3. question 4, read back into question 5 --------
   The thing being priced has to be the thing they just chose, so
   the list rebuilds on every tick. With nothing ticked the block
   hides entirely rather than showing an empty list: somebody who
   wants none of the extras is about to answer question 5 with the
   checkbox, and a heading saying "you'd be paying for" above
   nothing would read as a bug. */
function picks(extras) {
  const block = document.querySelector('[data-picks]');
  const list = document.querySelector('[data-picks-list]');
  if (!block || !list) return;

  const SHORT = new Map(EXTRAS.map(([key, , , short]) => [key, short]));

  const write = () => {
    const chosen = extras.picked();
    list.replaceChildren();

    if (!chosen.length) {
      block.hidden = true;
      return;
    }

    for (const key of chosen) {
      const li = document.createElement('li');
      li.className = 'picks__item';
      li.textContent = SHORT.get(key) || key;
      list.appendChild(li);
    }
    block.hidden = false;
  };

  document.addEventListener('extras:change', write);
  write();
}

/* ---------- the "I wouldn't pay" checkbox -------------------
   A decision, not a blank. Ticking it empties and disables the
   amount field, because a row carrying both €5 and "I wouldn't
   pay" is a row nobody can read. */
function wouldNotPay() {
  const box = document.getElementById('would_not_pay');
  const price = document.getElementById('price');
  if (!box || !price) return;

  box.addEventListener('change', () => {
    price.disabled = box.checked;
    if (box.checked) price.value = '';
    price.closest('.field')?.classList.toggle('is-disabled', box.checked);
  });

  // Typing an amount contradicts the checkbox, so the checkbox gives way.
  price.addEventListener('input', () => {
    if (price.value.trim() && box.checked) box.checked = false;
  });
}

/* ---------- the self-describe box ---------------------------- */

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

/* ---------- 6. the form -------------------------------------
   Served from a local static server, talk to a local `wrangler dev`
   instead of production — otherwise previewing the page writes test
   rows into the live database. Any other host is production, so this
   can't leak off localhost. Override with window.KIN_API_BASE. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const DEFAULT_API = LOCAL_HOSTS.has(location.hostname)
  ? 'http://localhost:8787'
  : 'https://api.hellomin.app';

const API_BASE = (window.KIN_API_BASE || DEFAULT_API).replace(/\/$/, '');
const SUBMIT_URL = API_BASE + '/pricing';

function form(services, intents, extras) {
  const el = document.getElementById('pro-form');
  if (!el) return;

  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('email-error');
  const priceInput = document.getElementById('price');
  const priceError = document.getElementById('price-error');
  const wontPay = document.getElementById('would_not_pay');
  const formStatus = document.getElementById('form-status');
  const submitButton = el.querySelector('button.submit');
  const submitLabel = submitButton.querySelector('.btn__label') || submitButton;

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const radioValue = (name) =>
    el.querySelector(`input[name="${name}"]:checked`)?.value ?? null;
  const text = (id) => document.getElementById(id)?.value.trim() || null;

  // "7", "7,50", "€7.50" all mean the same thing to a person and all
  // have to mean the same thing here, because the one field we most
  // want filled in is the one most likely to be typed loosely.
  const parsePrice = (raw) => {
    const cleaned = raw.replace(/[€\s]/g, '').replace(',', '.');
    if (!cleaned) return { ok: true, value: null };
    if (!/^\d{1,4}(\.\d{1,2})?$/.test(cleaned)) return { ok: false };
    return { ok: true, value: Number(cleaned) };
  };

  const fail = (field, errorEl, message, status) => {
    errorEl.textContent = message;
    formStatus.textContent = status;
    formStatus.className = 'status error';
    field.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    field.focus({ preventScroll: true });
  };

  el.addEventListener('submit', async (e) => {
    e.preventDefault();

    emailError.textContent = '';
    priceError.textContent = '';
    formStatus.textContent = '';
    formStatus.className = 'status';

    const price = parsePrice(priceInput.value);
    if (!price.ok) {
      fail(priceInput, priceError, 'Just a number is fine, like 5 or 7.50.',
           'Almost, that amount needs a look.');
      return;
    }

    // An address we can't write to is worse than none, because the
    // patch then quietly never arrives.
    const email = emailInput.value.trim();
    if (email && !isValidEmail(email)) {
      fail(emailInput, emailError, 'That email doesn’t look right.',
           'Almost, that email needs a look.');
      return;
    }

    const payload = {
      services_paid:  services.picked(),
      services_other: text('services_other'),
      reaction:       radioValue('reaction'),
      reaction_why:   text('reaction_why'),
      intents:        intents.picked(),
      // The two halves of question 5, kept separate on purpose: what
      // they want, and what they'd pay for exactly that. A price with
      // no extras list beside it cannot be read.
      extras_wanted:  extras.picked(),
      price:          price.value,
      would_not_pay:  !!wontPay?.checked,
      billing_pref:   radioValue('billing_pref'),
      email:          email || null,
      campus:         text('campus'),
      gender:         radioValue('gender'),
      gender_self_describe: radioValue('gender') === 'self_describe'
        ? text('gender_self_describe') : null,
      comments:       text('comments'),
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
const services = checks('[data-checks="services"]', SERVICES, { exclusive: 'none' });
const intents  = checks('[data-checks="intents"]',  INTENTS);
const extras   = checks('[data-checks="extras"]',   EXTRAS, { event: 'extras:change' });
picks(extras);
wouldNotPay();
selfDescribe();
minBodies();
buttons();
form(services, intents, extras);
