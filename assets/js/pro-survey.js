/* ============================================================
   min — the Pro survey (will people pay, and for which extras)
   ------------------------------------------------------------
   Sibling to survey.js, built on the same parts: the same reveal
   observer, the same submit, the same honeypot. What is new is
   question 2, which lists a person's own question 1 ticks back as
   "which of these do you pay for", and question 7, which names
   their question 6 ticks back and asks what that costs.

   Source: min-brain/Business/Narrative/user facing question.md

   The page is an instrument before it is a page, so its rules
   live in code rather than in copy:

     • Discovery before the pitch. Part 1 never names min.
     • Explain the free product first, price second. Nothing is
       priced until the person has read what the free version does
       and said what they would use it for.
     • Every extra is a tick, never a rating.
     • We name no figure. Question 7 is their number against their
       own ticks. The analysis is a cross-tab, read against what
       they already spend (question 2).
     • Nothing is required. The only validation is the shape of an
       email and the shape of a number, and only when somebody
       typed one.

   ⚠️ No list in this file mentions AI, and none should.

   1. reveals()  — IntersectionObserver adds .in; CSS runs the
                   emergence recipe, shared with the landing page.
   2. checks()   — builds the tick grids from the lists below.
   3. paid()     — question 1 read back into question 2.
   4. picks()    — question 6 read back into question 7, live.
   5. minBodies()— min in the wordmark's i-dot, and on the thanks.
   6. buttons()  — the submerge press on .btn.
   7. form()     — validation + submit to the Worker.
   ============================================================ */

import { buttons } from '/assets/js/press.js';
import { minBodies } from '/assets/js/min.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- question 1: what they use --------------------
   Categories from the outline, with brands only as examples so
   every row reads the same to everybody. Written for a Helsinki
   student: Kide.app, Jodel and guilds belong here.

   `short` is what question 2 lists back as "which of these do you
   pay for", so it drops the examples.

   Keys are what the Worker stores, so they are lowercase slugs.
   Anything it doesn't recognise should be dropped. */
const SERVICES = [
  ['social',    'Social media',      'Instagram, TikTok, Jodel, Snapchat…',     'Social media'],
  ['dating',    'Dating apps',       'Tinder, Bumble, Hinge…',                  'Dating apps'],
  ['community', 'Communities',       'Discord, guilds, student associations…',  'Communities'],
  ['events',    'Events',            'Kide.app, Meetup, Eventbrite…',           'Events'],
  ['hobbies',   'Hobbies',           'Sports clubs, gyms, courses…',            'Hobbies'],
  ['groups',    'Groups',            'WhatsApp or Telegram groups, Facebook groups…', 'Groups'],
  ['wellbeing', 'Fitness and wellbeing apps', 'Strava, Headspace, running or workout apps…', 'Fitness and wellbeing apps'],
  ['none',      'None of these'],
];

/* ---------- question 5: intent ------------------------------
   The outline's five, multi-select. `dating` is on the list on
   purpose: leaving it off would not change how many people want
   it, only our ability to see how many. */
const INTENTS = [
  ['dating',  'Dating'],
  ['friends', 'Making friends'],
  ['hobbies', 'Hobbies, or trying new ones'],
  ['chats',   'Just chatting with someone new'],
  ['career',  'Career and people in my field'],
];

/* ---------- question 6: the extras --------------------------
   Three groups, from the outline. Each row has to read as
   something somebody could want on its own, because question 7
   names them back individually.

     filter — scored SPLIT BY GENDER. A safety feature to one half
              of the cohort and a filtering feature to the other,
              and the largest single risk in the subscription
              model. The only reason question 8 asks gender.
     more   — read against `filter`. Both ticked, male-skewed, is
              the filter spiral.

   `short` is what question 7 lists back. */
const EXTRAS = {
  app: [
    ['filter', 'Choose your matches',
               'More control over what kind of people min matches you with',
               'choosing your matches'],
    ['more',   'More matches',
               'min usually lets you know when it finds someone. This lets you ask for one',
               'asking for more matches'],
    ['groups', 'Group matching',
               'Match your group of friends with another group, instead of one on one',
               'group matching'],
  ],
  irl: [
    ['events', 'Scheduled group events',
               'Planned activities with a matched group of people',
               'scheduled group events'],
  ],
  self: [
    ['talk',    'More time with min',
                'More conversations and questions with min',
                'more time with min'],
    ['insight', 'Deeper insight into yourself',
                'See what min has learned about you and your memories',
                'deeper insight into yourself'],
  ],
};

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

/* ---------- 3. question 1, read back into question 2 --------
   A yes opens the follow-up: their own question 1 picks as ticks,
   and one monthly total. The list rebuilds on every question 1
   tick and keeps whatever was already ticked, so going back up to
   add a row doesn't wipe the answer.

   With nothing picked in question 1 (or only "None"), the list
   hides and only the total shows. */
function paid(services) {
  const field = document.getElementById('paid-field');
  const set = document.querySelector('[data-paid-set]');
  const host = document.querySelector('[data-paid]');
  if (!field || !set || !host) return { picked: () => [] };

  const SHORT = new Map(SERVICES.map(([key, label, , short]) => [key, short || label]));
  const ticked = new Set();

  const write = () => {
    host.replaceChildren();
    const rows = services.picked().filter((k) => k !== 'none');
    for (const key of rows) {
      const wrap = document.createElement('label');
      wrap.className = 'option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = `paid_${key}`;
      input.value = key;
      input.checked = ticked.has(key);
      input.addEventListener('change', () => {
        input.checked ? ticked.add(key) : ticked.delete(key);
      });
      const text = document.createElement('span');
      text.textContent = SHORT.get(key) || key;
      wrap.append(input, text);
      host.appendChild(wrap);
    }
    set.hidden = !rows.length;
  };

  document.querySelectorAll('input[name="pays"]').forEach((input) => {
    input.addEventListener('change', () => {
      field.hidden = !(input.checked && input.value === 'yes');
    });
  });
  document.addEventListener('services:change', write);
  write();

  return {
    // Only rows still on screen count: a tick on a service they
    // later unticked in question 1 is not an answer.
    picked: () => services.picked().filter((k) => ticked.has(k)),
  };
}

/* ---------- 4. question 6, read back into question 7 --------
   The thing being priced has to be the thing they just chose, so
   the list rebuilds on every tick. With nothing ticked the block
   hides entirely rather than showing an empty list: somebody who
   wants none of the extras is about to answer question 7 with the
   checkbox, and a heading saying "you'd be paying for" above
   nothing would read as a bug. */
function picks(extras) {
  const block = document.querySelector('[data-picks]');
  const list = document.querySelector('[data-picks-list]');
  if (!block || !list) return;

  const SHORT = new Map(Object.values(EXTRAS).flat().map(([key, , , short]) => [key, short]));

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
  const followups = document.querySelector('[data-pay-followups]');
  if (!box || !price) return;

  // "Would you sign up at that price" and "how would you pay" only
  // mean something to someone who would pay, so a decided "no"
  // hides them instead of collecting guesses.
  box.addEventListener('change', () => {
    price.disabled = box.checked;
    if (box.checked) price.value = '';
    price.closest('.field')?.classList.toggle('is-disabled', box.checked);
    if (followups) followups.hidden = box.checked;
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

/* ---------- 7. the form -------------------------------------
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

function form(services, paidFor, intents, extras) {
  const el = document.getElementById('pro-form');
  if (!el) return;

  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('email-error');
  const priceInput = document.getElementById('price');
  const priceError = document.getElementById('price-error');
  const spendInput = document.getElementById('spend');
  const spendError = document.getElementById('spend-error');
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
    spendError.textContent = '';
    formStatus.textContent = '';
    formStatus.className = 'status';

    // Only read when the follow-up is open: a "no" with a stale
    // amount still in the hidden field is a "no".
    const pays = radioValue('pays');
    const spend = pays === 'yes' ? parsePrice(spendInput.value) : { ok: true, value: null };
    if (!spend.ok) {
      fail(spendInput, spendError, 'Just a number is fine, like 20 or 12.50.',
           'Almost, that amount needs a look.');
      return;
    }

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
      // Part 1: discovery
      services_used:    services.picked(),
      services_other:   text('services_other'),
      pays:             pays,
      services_paid:    pays === 'yes' ? paidFor.picked() : [],
      spend_monthly:    spend.value,
      satisfaction:     radioValue('satisfaction'),
      satisfaction_why: text('satisfaction_why'),
      // Part 2: reaction
      reaction:       radioValue('reaction'),
      reaction_why:   text('reaction_why'),
      intents:        intents.picked(),
      frequency:      radioValue('frequency'),
      // What they want, and what they'd pay for exactly that, kept
      // side by side. A price with no extras list beside it cannot
      // be read.
      extras_wanted:  extras.picked(),
      price:          price.value,
      would_not_pay:  !!wontPay?.checked,
      // Blank when they won't pay: the questions were hidden.
      commitment:     wontPay?.checked ? null : radioValue('commitment'),
      billing_pref:   wontPay?.checked ? null : radioValue('billing_pref'),
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
const services = checks('[data-checks="services"]', SERVICES,
                        { exclusive: 'none', event: 'services:change' });
const paidFor  = paid(services);
const intents  = checks('[data-checks="intents"]', INTENTS);
// Three hosts, one question: read back as a single list.
const extraGroups = Object.entries(EXTRAS).map(([group, rows]) =>
  checks(`[data-extras="${group}"]`, rows, { event: 'extras:change' }));
const extras = { picked: () => extraGroups.flatMap((g) => g.picked()) };
picks(extras);
wouldNotPay();
selfDescribe();
minBodies();
buttons();
form(services, paidFor, intents, extras);
