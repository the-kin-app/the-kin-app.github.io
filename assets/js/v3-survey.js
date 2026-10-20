/* ============================================================
   min — the social moments survey, v3 (/survey/v3/)
   ------------------------------------------------------------
   Built on the same parts as moments-survey.js: the same reveal
   observer, honeypot and submit. The rules are the old ones:

     • Anonymous. No email, no name, nothing that identifies.
     • Nothing is required. The only validation is the shape of a
       number, and only when somebody typed one.
     • Question 9 is their unit (per moment or monthly), a yes/no
       at one price drawn at random from a short ladder, then their
       own number. The draw is the only price we name, and across
       everyone it gives the share who'd pay at each step.
       "I wouldn't pay" is a decision, not a blank.
     • The waitlist tap on the thank-you screen is reported against
       the anonymous response (a random token the Worker hands
       back), never against the signup.

   New here: list rows are shuffled per visit (the first row
   otherwise wins by being first), with the opt-out row pinned
   last.

   1. reveals()  — IntersectionObserver adds .in.
   2. rows       — builds the radio and tick lists below.
   3. form()     — validation + submit to the Worker.
   ============================================================ */

import { buttons } from '/assets/js/press.js';
import { minBodies } from '/assets/js/min.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- question 2: how they met the last one ----------
   Keys are what the Worker stores (V3_CHOICES.last_met in its
   index.js); it drops anything it doesn't recognise. The last row
   is pinned, the rest shuffle. */
const LAST_MET = [
  ['matching',      'A matching app',          'Tinder, Hinge, Bumble BFF…'],
  ['social',        'Social media or DMs',     'Instagram, TikTok…'],
  ['events',        'At an event',             'A party, a meetup, a gig…'],
  ['hobbies',       'Through a hobby',         'A sports club, climbing, board games…'],
  ['communities',   'Through a community',     'A student association, a guild, Discord…'],
  ['friends',       'Introduced by a friend',  'A friend of a friend'],
  ['work_school',   'At school or work',       'A class, a project, a colleague…'],
  ['chance',        'Just by chance',          'At a bar, on the tram, in a queue…'],
  ['cant_remember', "Can't remember"],
];

/* ---------- question 5: what gets in the way --------------- */
const BLOCKERS = [
  ['where',   "I don't know where to go"],
  ['no_one',  'No one to go with'],
  ['awkward', 'Walking up to strangers feels awkward'],
  ['no_time', 'No time or energy'],
  ['forced',  'Events feel forced'],
  ['cost',    'It costs too much'],
  ['fine',    "Nothing, I'm happy as I am"],
];
const BLOCKERS_MAX = 2;

/* ---------- questions 7 and 8: use, then first -------------
   The same moments the concept in question 6 names: one person or
   many, talking or doing. Both questions show them in one shuffled
   order; "None of these" is question 7's only. */
const MOMENTS = [
  ['one_on_one',     "A casual chat with someone who's into the same specific thing as you"],
  ['one_activity',   'Doing an activity with one new person', 'A run, climbing, a gallery, a gig…'],
  ['group_activity', 'Joining a small group of like-minded people for an activity or event'],
  ['mixer',          'A bigger social event where you can mingle with lots of new people'],
  ['group_to_group', 'Going out with your friends to meet another group of friends'],
  ['none',           'None of these'],
];

/* Short enough to sit inside a sentence: question 9 names the
   question-8 pick ("A casual chat with someone into your thing,
   set up for you…"). */
const MOMENT_SHORT = {
  one_on_one:     'A casual chat with someone into your thing',
  one_activity:   'An activity with one new person',
  group_activity: 'A shared activity with a like-minded group',
  mixer:          'A bigger social event to mingle at',
  group_to_group: 'A night out where your friends meet another group',
};

/* ---------- question 9: the price check -------------------
   One yes/no at a price drawn per visit, per unit. Must match
   V3_PRICE_LADDER in the Worker; any other amount is dropped there.
   crypto, not Math.random(): the draw is the experiment. */
const PRICE_LADDER = { per_moment: [3, 6, 10], monthly: [5, 10, 15] };
const PRICE_UNIT = { per_moment: 'per moment', monthly: 'a month' };
const draw = (list) => list[crypto.getRandomValues(new Uint32Array(1))[0] % list.length];
const CHECK_PRICE = {
  per_moment: draw(PRICE_LADDER.per_moment),
  monthly: draw(PRICE_LADDER.monthly),
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

/* ---------- 2. the lists ------------------------------------
   Every row but the last shuffles (Fisher–Yates); the last is the
   opt-out ("Can't remember", "Nothing", "None of these") and reads
   wrong anywhere but the bottom. */
function shuffled(rows) {
  const head = rows.slice(0, -1);
  for (let i = head.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [head[i], head[j]] = [head[j], head[i]];
  }
  return [...head, rows[rows.length - 1]];
}

function build(host, rows, type, shuffle = true) {
  const el = document.querySelector(host);
  const inputs = new Map();
  if (!el) return inputs;
  const name = el.dataset.radios || el.dataset.checks;

  for (const [key, label, note] of shuffle ? shuffled(rows) : rows) {
    const wrap = document.createElement('label');
    wrap.className = note ? 'option option--noted' : 'option';

    const input = document.createElement('input');
    input.type = type;
    input.name = type === 'radio' ? name : `${name}_${key}`;
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
    inputs.set(key, input);
  }
  return inputs;
}

/* Question 5: up to two, and "Nothing" stands alone. At two, the
   rest grey out rather than silently swapping a tick. */
function blockers() {
  const boxes = build('[data-checks="blockers"]', BLOCKERS, 'checkbox');
  const exclusive = 'fine';

  const sync = () => {
    const n = [...boxes.values()].filter((b) => b.checked).length;
    for (const box of boxes.values()) {
      box.disabled = !box.checked && n >= BLOCKERS_MAX;
      box.closest('label').classList.toggle('is-disabled', box.disabled);
    }
  };

  for (const [key, input] of boxes) {
    input.addEventListener('change', () => {
      if (input.checked) {
        if (key === exclusive) {
          for (const [k, other] of boxes) if (k !== exclusive) other.checked = false;
        } else if (boxes.has(exclusive)) {
          boxes.get(exclusive).checked = false;
        }
      }
      sync();
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

/* Questions 7 → 8 → 9. Question 8 offers only what 7 ticked (all
   of it when 7 was skipped) and hides when 7 has one tick, which is
   then the pick. "None of these" stands alone, opens "what instead"
   and hides 8 and 9. The pick names itself in question 9's note. */
function moments() {
  const order = shuffled(MOMENTS);
  const used = build('[data-checks="use_moments"]', order, 'checkbox', false);
  const picks = build('[data-radios="top_moment"]', order.filter(([k]) => k !== 'none'), 'radio', false);
  const topCard = document.getElementById('top-card');
  const priceCard = document.getElementById('price-card');
  const named = document.getElementById('price-moment');
  const other = document.getElementById('top_moment_other-field');
  const exclusive = 'none';

  const ticked = () => [...used].filter(([, box]) => box.checked).map(([key]) => key);

  const top = () => {
    const t = ticked();
    if (t.length === 1) return t[0];
    for (const [key, radio] of picks) if (radio.checked) return key;
    return null;
  };

  const sync = () => {
    const t = ticked();
    const none = t[0] === exclusive;
    if (topCard) topCard.hidden = none || t.length === 1;
    for (const [key, radio] of picks) {
      const shown = t.length === 0 || t.includes(key);
      radio.closest('label').style.display = shown ? '' : 'none';
      if (!shown) radio.checked = false;
    }
    if (other) other.hidden = !none;
    if (priceCard) priceCard.hidden = none;
    if (named) named.textContent = MOMENT_SHORT[top()] ?? 'Moments like these';
  };

  for (const [key, input] of used) {
    input.addEventListener('change', () => {
      if (input.checked) {
        if (key === exclusive) {
          for (const [k, box] of used) if (k !== exclusive) box.checked = false;
        } else if (used.has(exclusive)) {
          used.get(exclusive).checked = false;
        }
      }
      sync();
      if (key === exclusive && input.checked) other?.querySelector('input')?.focus();
    });
  }
  for (const radio of picks.values()) radio.addEventListener('change', sync);

  return { used: ticked, top };
}

/* ---------- question 9: how, then would you, then how much --
   The check and the amount open on per moment or monthly, and both
   say which; "I wouldn't pay" closes them and empties them. A new
   unit clears the yes/no, which was said about the other price. */
const PRICE_LABEL = {
  per_moment: 'How much per moment would feel fair?',
  monthly:    'How much a month would feel fair?',
};

function payModel() {
  const field = document.getElementById('price-field');
  const label = document.getElementById('price-label');
  const price = document.getElementById('price');
  const amount = document.getElementById('price-check-amount');
  if (!field || !price) return;
  document.querySelectorAll('input[name="pay_model"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      const on = input.value in PRICE_LABEL;
      field.hidden = !on;
      document.querySelectorAll('input[name="price_check"]').forEach((r) => { r.checked = false; });
      if (on) {
        label.textContent = PRICE_LABEL[input.value];
        if (amount) amount.textContent = `€${CHECK_PRICE[input.value]} ${PRICE_UNIT[input.value]}`;
      } else {
        price.value = '';
      }
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
const SUBMIT_URL = API_BASE + '/survey/v3';

/* The thank-you screen's one action, reported against the response
   the Worker just stored. sendBeacon with a text/plain body, like
   scan-attribution.js: no preflight, and it survives the navigation
   the tap starts. Never blocks the link. */
function reportWaitlistTap(token) {
  const link = document.getElementById('waitlist-link');
  if (!link || !token) return;
  link.addEventListener('click', () => {
    const url = API_BASE + '/survey/v3/waitlist';
    const body = JSON.stringify({ t: token });
    try {
      if (navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return;
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body, keepalive: true })
        .catch(() => {});
    } catch (_) { /* the tap still goes through */ }
  }, { once: true });
}

function form(blocked, chosen) {
  const el = document.getElementById('v3-form');
  if (!el) return;

  const priceInput = document.getElementById('price');
  const priceError = document.getElementById('price-error');
  const spendInput = document.getElementById('spend');
  const spendError = document.getElementById('spend-error');
  const priceCard = document.getElementById('price-card');
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

    priceError.textContent = '';
    spendError.textContent = '';
    formStatus.textContent = '';
    formStatus.className = 'status';

    // A hidden price card ("None of these") sends no price, even a stale
    // one; neither does a model with no amount ("I wouldn't pay").
    const priced = !priceCard?.hidden;
    const payModel = priced ? radioValue('pay_model') : null;
    const priceCheck = payModel in PRICE_LABEL ? radioValue('price_check') : null;
    const topMoment = chosen.top();
    const price = payModel in PRICE_LABEL ? parsePrice(priceInput.value) : { ok: true, value: null };
    if (!price.ok) {
      fail(priceInput, priceError, 'Just a number is fine, like 5 or 7.50.');
      return;
    }
    const spend = parsePrice(spendInput.value);
    if (!spend.ok) {
      fail(spendInput, spendError, 'Just a number is fine, like 0 or 12.50.');
      return;
    }

    const gender = radioValue('gender');
    const payload = {
      // Part 1: now
      city_tenure:     radioValue('city_tenure'),
      last_met:        radioValue('last_met'),
      met_count:       radioValue('met_count'),
      want_frequency:  radioValue('want_frequency'),
      blockers:        blocked.picked(),
      // Part 2: the idea
      appeal:          radioValue('appeal'),
      use_moments:     chosen.used(),
      top_moment:      topMoment,
      top_moment_other: topMoment === 'none' ? text('top_moment_other') : null,
      pay_model:       payModel,
      price_check:     priceCheck,
      price_check_amount: priceCheck ? CHECK_PRICE[payModel] : null,
      price:           price.value,
      spend_monthly:   spend.value,
      // Part 3: who
      age:             radioValue('age'),
      gender,
      gender_self_describe: gender === 'self_describe' ? text('gender_self_describe') : null,
      profession:      text('profession'),
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

      let token = null;
      try { ({ token } = await res.json()); } catch (_) { /* no token, no report */ }
      reportWaitlistTap(token);

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
build('[data-radios="last_met"]', LAST_MET, 'radio');
const blocked = blockers();
const chosen = moments();
payModel();
selfDescribe();
minBodies();
buttons();
form(blocked, chosen);
