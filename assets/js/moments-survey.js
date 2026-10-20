/* ============================================================
   min — the social moments survey (/survey/v2/)
   ------------------------------------------------------------
   Built on the same parts as pro-survey.js: the same reveal
   observer, tick grids, honeypot and submit. The questions are
   new; the rules are the old ones:

     • Anonymous. No email, no name, nothing that identifies.
     • Nothing is required. The only validation is the shape of a
       number, and only when somebody typed one.
     • We name no price. Question 7 is their two numbers, and "I
       wouldn't pay" is a decision, not a blank.

   1. reveals()  — IntersectionObserver adds .in.
   2. checks()   — builds the tick grids from the lists below.
   3. form()     — validation + submit to the Worker.
   ============================================================ */

import { buttons } from '/assets/js/press.js';
import { minBodies } from '/assets/js/min.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- question 1: how they meet people ----------------
   Keys are what the Worker stores (MEET_KEYS in its index.js);
   it drops anything it doesn't recognise. */
const MEET = [
  ['matching',    'Matching apps',          'Tinder, Hinge, Bumble BFF…'],
  ['social',      'Social media or DMs',    'Instagram, TikTok…'],
  ['events',      'Events',                 'Parties, meetups, gigs…'],
  ['hobbies',     'Hobbies',                'Sports clubs, climbing, board games…'],
  ['communities', 'Communities',            'Student associations, guilds, Discord…'],
  ['friends',     'Introduced by friends',  'A friend of a friend'],
  ['chance',      'Just by chance',         'At a bar, in class, on the tram…'],
  ['no_way',      'No good way right now'],
];

/* ---------- question 2: how they find things to do ---------- */
const FIND = [
  ['social',      'Social media',           'Instagram, TikTok…'],
  ['event_apps',  'Event apps',             'Kide.app, Meetup, Eventbrite…'],
  ['community',   'Community apps',         'Discord, Telegram or WhatsApp groups…'],
  ['friends',     'Friends',                'Group chats, someone dragging me along…'],
  ['uni_work',    'School or work',         'Student union emails, guild channels, office Slack…'],
  ['guides',      'Websites and newsletters', 'City guides, event calendars, Google…'],
  ['venues',      'Places I follow',        'Bars, clubs, cafés, museums…'],
  ['chance',      'By chance',              'Posters, word of mouth, walking past…'],
];

/* ---------- question 4: which moments they'd actually do ---- */
const MOMENTS = [
  ['one_on_one',     "Chatting over a coffee or a drink with someone who's into the same specific thing as you"],
  ['group_activity', 'Meeting a group of like-minded people for a shared activity or event'],
  ['group_to_group', 'Going out with your friends to meet another group of friends'],
  ['none',           'None of these'],
];

/* The same moments, short enough to sit inside a sentence: question 7
   names their question-5 pick ("A coffee with someone into your thing,
   set up for you…"). */
const MOMENT_SHORT = {
  one_on_one:     'A coffee or a drink with someone into your thing',
  group_activity: 'A shared activity with a like-minded group',
  group_to_group: 'A night out where your friends meet another group',
};

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

/* ---------- 2. the tick grids -------------------------------
   `exclusive` is a row that clears the others and is cleared by
   them: "No good way right now" next to three ways is a row
   nobody can read. */
function checks(host, rows, { exclusive = null, event = null } = {}) {
  const el = document.querySelector(host);
  if (!el) return { picked: () => [] };

  const boxes = new Map();

  for (const [key, label, note] of rows) {
    const wrap = document.createElement('label');
    wrap.className = note ? 'option option--noted' : 'option';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = `${el.dataset.checks}_${key}`;
    input.value = key;

    const text = document.createElement('span');
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
      if (exclusive && input.checked) {
        if (key === exclusive) {
          for (const [k, other] of boxes) if (k !== exclusive) other.checked = false;
        } else {
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

/* ---------- question 3: a yes opens the amount ------------- */

function pays() {
  const field = document.getElementById('spend-field');
  if (!field) return;
  document.querySelectorAll('input[name="pays"]').forEach((input) => {
    input.addEventListener('change', () => {
      field.hidden = !(input.checked && input.value === 'yes');
    });
  });
}

/* ---------- question 5: the one they'd pick ----------------
   Rows are the moments they ticked in question 4 (all three when
   they ticked none yet); "None of these" hides the card. One tick
   is already their pick, so it comes pre-chosen. Question 7's note
   follows the pick. */
function topPick(moments) {
  const card = document.getElementById('top-card');
  const host = document.querySelector('[data-radios="top_moment"]');
  const named = document.getElementById('price-moment');
  if (!card || !host) return { picked: () => null };

  const rows = MOMENTS.filter(([key]) => key !== 'none');
  const radios = new Map();
  for (const [key, label] of rows) {
    const wrap = document.createElement('label');
    wrap.className = 'option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'top_moment';
    input.value = key;
    const text = document.createElement('span');
    text.textContent = label;
    wrap.append(input, text);
    host.appendChild(wrap);
    radios.set(key, input);
  }

  const picked = () => {
    if (card.hidden) return null;
    for (const [key, input] of radios) if (input.checked) return key;
    return null;
  };

  const name = () => {
    if (named) named.textContent = MOMENT_SHORT[picked()] ?? 'One moment like these';
  };

  const sync = () => {
    const ticked = moments.picked();
    card.hidden = ticked.includes('none');
    const shown = ticked.length && !card.hidden ? ticked : rows.map(([key]) => key);
    for (const [key, input] of radios) {
      const on = shown.includes(key);
      input.closest('label').hidden = !on;
      if (!on) input.checked = false;
    }
    if (shown.length === 1 && !card.hidden) radios.get(shown[0]).checked = true;
    name();
  };

  for (const input of radios.values()) input.addEventListener('change', name);
  document.addEventListener('moments:change', sync);
  sync();
  return { picked };
}

/* ---------- question 7: "I wouldn't pay" -------------------
   Ticking it empties and disables both amounts; typing an amount
   unticks it. A row with both is a row nobody can read. */
function wouldNotPay() {
  const box = document.getElementById('would_not_pay');
  const prices = ['price_bargain', 'price_too_much']
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (!box || !prices.length) return;

  box.addEventListener('change', () => {
    for (const price of prices) {
      price.disabled = box.checked;
      if (box.checked) price.value = '';
      price.closest('.field')?.classList.toggle('is-disabled', box.checked);
    }
  });
  for (const price of prices) {
    price.addEventListener('input', () => {
      if (price.value.trim() && box.checked) box.checked = false;
    });
  }
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

function form(meet, find, moments, top) {
  const el = document.getElementById('moments-form');
  if (!el) return;

  const bargainInput = document.getElementById('price_bargain');
  const bargainError = document.getElementById('price_bargain-error');
  const tooMuchInput = document.getElementById('price_too_much');
  const tooMuchError = document.getElementById('price_too_much-error');
  const spendInput = document.getElementById('spend');
  const spendError = document.getElementById('spend-error');
  const wontPay = document.getElementById('would_not_pay');
  const formStatus = document.getElementById('form-status');
  const submitButton = el.querySelector('button.submit');
  const submitLabel = submitButton.querySelector('.btn__label') || submitButton;

  const radioValue = (name) =>
    el.querySelector(`input[name="${name}"]:checked`)?.value ?? null;
  const text = (id) => document.getElementById(id)?.value.trim() || null;

  // "7", "7,50", "€7.50" all mean the same thing to a person.
  const parsePrice = (raw) => {
    const cleaned = raw.replace(/[€\s]/g, '').replace(',', '.');
    if (!cleaned) return { ok: true, value: null };
    if (!/^\d{1,4}(\.\d{1,2})?$/.test(cleaned)) return { ok: false };
    return { ok: true, value: Number(cleaned) };
  };

  const fail = (field, errorEl, message) => {
    errorEl.textContent = message;
    formStatus.textContent = 'Almost, that amount needs a look.';
    formStatus.className = 'status error';
    field.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    field.focus({ preventScroll: true });
  };

  el.addEventListener('submit', async (e) => {
    e.preventDefault();

    bargainError.textContent = '';
    tooMuchError.textContent = '';
    spendError.textContent = '';
    formStatus.textContent = '';
    formStatus.className = 'status';

    // A "no" with a stale amount still in the hidden field is a "no".
    const paysValue = radioValue('pays');
    const spend = paysValue === 'yes' ? parsePrice(spendInput.value) : { ok: true, value: null };
    if (!spend.ok) {
      fail(spendInput, spendError, 'Just a number is fine, like 20 or 12.50.');
      return;
    }

    const bargain = parsePrice(bargainInput.value);
    if (!bargain.ok) {
      fail(bargainInput, bargainError, 'Just a number is fine, like 5 or 7.50.');
      return;
    }
    const tooMuch = parsePrice(tooMuchInput.value);
    if (!tooMuch.ok) {
      fail(tooMuchInput, tooMuchError, 'Just a number is fine, like 15 or 20.');
      return;
    }
    // A bargain above "too expensive" is two boxes swapped, not an answer.
    if (bargain.value !== null && tooMuch.value !== null && bargain.value >= tooMuch.value) {
      fail(tooMuchInput, tooMuchError, 'This one should be higher than the bargain price.');
      return;
    }

    const gender = radioValue('gender');
    const payload = {
      // Part 1: now
      meet:            meet.picked(),
      find:            find.picked(),
      find_other:      text('find_other'),
      pays:            paysValue,
      spend_monthly:   spend.value,
      // Part 2: want
      moments:         moments.picked(),
      top_moment:      top.picked(),
      frequency:       radioValue('frequency'),
      price_bargain:   bargain.value,
      price_too_much:  tooMuch.value,
      would_not_pay:   !!wontPay?.checked,
      pay_model:       radioValue('pay_model'),
      // Part 3: who
      profession:      text('profession'),
      gender,
      gender_self_describe: gender === 'self_describe' ? text('gender_self_describe') : null,
      age:             radioValue('age'),
      relationship:    radioValue('relationship'),
      city_tenure:     radioValue('city_tenure'),
      comments:        text('comments'),
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
const meet = checks('[data-checks="meet"]', MEET, { exclusive: 'no_way' });
const find = checks('[data-checks="find"]', FIND);
const moments = checks('[data-checks="moments"]', MOMENTS, { exclusive: 'none', event: 'moments:change' });
const top = topPick(moments);
pays();
wouldNotPay();
selfDescribe();
minBodies();
buttons();
form(meet, find, moments, top);
