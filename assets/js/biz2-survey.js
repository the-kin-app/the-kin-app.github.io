/* ============================================================
   min — the business survey, v2 (/business/v2/)
   ------------------------------------------------------------
   Built on the same parts as v3-survey.js: the same reveal
   observer, shuffled lists, honeypot and submit.

     • business_name is the only required answer; the only other
       validation is that, and only on submit.
     • We name no price. Question 8 is their bucket per guest, one
       row per delivery they ticked, so the deliveries compare.

   Question 6 drives 7–9: none ticked or "None of these" hides
   all three; one tick is already the question-7 pick; the
   value rows follow the ticks.

   1. reveals()  — IntersectionObserver adds .in.
   2. lists      — quiet times, deliveries, the pick, the values.
   3. form()     — validation + submit to the Worker.
   ============================================================ */

import { buttons } from '/assets/js/press.js';
import { minBodies } from '/assets/js/min.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- question 2: when it's quiet ---------------------
   Keys are what the Worker stores (BIZ2_QUIET_KEYS in its
   index.js). Time order, not shuffled: it's a calendar. */
const QUIET = [
  ['wd_morning',   'Weekday mornings'],
  ['wd_afternoon', 'Weekday afternoons'],
  ['wd_evening',   'Weekday evenings'],
  ['we_day',       'Weekend daytime'],
  ['we_evening',   'Weekend evenings'],
  ['never',        "We're rarely quiet"],
];

/* ---------- question 6: the deliveries ----------------------
   (BIZ2_DELIVERY_KEYS.) Shuffled, "None of these" pinned last. */
const DELIVERIES = [
  ['pairs',        'Two people meeting up',              'Matched for a chat or a drink at your place'],
  ['small_group',  'Small groups doing an activity',     '4–8 people for board games, a run that ends at your door…'],
  ['group_night',  'Friend groups meeting each other',   'Two groups matched for a night out, 8–20 people'],
  ['hosted_event', 'A hosted event in your quiet hours', "We organise and run it; you're the place it happens"],
  ['recurring',    'A regular group, every week',        'A club that meets at your place on a set night'],
  ['same_day',     "Same-day fill when you're quiet",    'People sent in at short notice when you have empty tables'],
  ['none',         'None of these'],
];
const DELIVERIES_MAX = 3;
const LABEL = Object.fromEntries(DELIVERIES.map(([k, l]) => [k, l]));

/* ---------- question 8: € per guest -------------------------
   (BIZ2_VALUE_KEYS.) One unit for every delivery, so they compare. */
const VALUES = [
  ['zero',    '€0'],
  ['1_2',     '€1–2'],
  ['3_5',     '€3–5'],
  ['6_10',    '€6–10'],
  ['over_10', '€10+'],
];

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

/* ---------- 2. the lists ------------------------------------ */

// Every row but the last shuffles; the last is the opt-out.
function shuffled(rows) {
  const head = rows.slice(0, -1);
  for (let i = head.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [head[i], head[j]] = [head[j], head[i]];
  }
  return [...head, rows[rows.length - 1]];
}

function option(type, name, key, label, note) {
  const wrap = document.createElement('label');
  wrap.className = note ? 'option option--noted' : 'option';
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
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
  return { wrap, input };
}

/* Tick lists with an opt-out row that stands alone, and an
   optional cap: at the cap the rest grey out rather than silently
   swapping a tick. */
function ticks(host, rows, { exclusive, max = Infinity, onChange = () => {} }) {
  const el = document.querySelector(host);
  const boxes = new Map();
  if (!el) return { picked: () => [] };
  const name = el.dataset.checks;

  for (const [key, label, note] of rows) {
    const { wrap, input } = option('checkbox', `${name}_${key}`, key, label, note);
    el.appendChild(wrap);
    boxes.set(key, input);
  }

  const sync = () => {
    const n = [...boxes.values()].filter((b) => b.checked).length;
    for (const box of boxes.values()) {
      box.disabled = !box.checked && n >= max;
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
      onChange();
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

/* Questions 7–9 follow question 6. Rebuilt on every change, keeping
   whatever was already chosen for a delivery that's still ticked. */
function followers(deliveries) {
  const topCard = document.getElementById('top-card');
  const topHost = document.querySelector('[data-radios="top_delivery"]');
  const valuesCard = document.getElementById('values-card');
  const valueRows = document.getElementById('value-rows');
  const payCard = document.getElementById('pay-card');

  const top = () => topHost.querySelector('input:checked')?.value ?? null;
  const valueOf = (key) => valueRows.querySelector(`input[name="value_${key}"]:checked`)?.value ?? null;

  const sync = () => {
    const picked = deliveries.picked().filter((k) => k !== 'none');
    const any = picked.length > 0;

    // 7: only a real choice with two or more.
    const keepTop = top();
    topHost.textContent = '';
    for (const key of picked) {
      const { wrap, input } = option('radio', 'top_delivery', key, LABEL[key]);
      input.checked = key === keepTop;
      topHost.appendChild(wrap);
    }
    topCard.hidden = picked.length < 2;

    // 8: one row per ticked delivery.
    const keep = Object.fromEntries(picked.map((k) => [k, valueOf(k)]));
    valueRows.textContent = '';
    for (const key of picked) {
      const set = document.createElement('fieldset');
      set.className = 'fieldset value-row';
      const legend = document.createElement('legend');
      legend.textContent = LABEL[key];
      const group = document.createElement('div');
      group.className = 'value-scale';
      for (const [v, label] of VALUES) {
        const { wrap, input } = option('radio', `value_${key}`, v, label);
        input.checked = keep[key] === v;
        group.appendChild(wrap);
      }
      set.append(legend, group);
      valueRows.appendChild(set);
    }
    valuesCard.hidden = !any;

    // 9
    payCard.hidden = !any;
  };

  return {
    sync,
    top() {
      const picked = deliveries.picked().filter((k) => k !== 'none');
      return picked.length === 1 ? picked[0] : top();
    },
    values() {
      const out = {};
      for (const key of deliveries.picked()) {
        const v = key !== 'none' && valueOf(key);
        if (v) out[key] = v;
      }
      return out;
    },
  };
}

/* ---------- 3. the form -------------------------------------
   Local static server → local `wrangler dev`, so previewing never
   writes into the live database. Override with window.KIN_API_BASE. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const DEFAULT_API = LOCAL_HOSTS.has(location.hostname)
  ? 'http://localhost:8787'
  : 'https://api.hellomin.app';

const API_BASE = (window.KIN_API_BASE || DEFAULT_API).replace(/\/$/, '');
const SUBMIT_URL = API_BASE + '/business/v2';

function form(quiet, deliveries, follow) {
  const el = document.getElementById('biz2-form');
  if (!el) return;

  const nameInput = document.getElementById('business_name');
  const nameError = document.getElementById('business_name-error');
  const payCard = document.getElementById('pay-card');
  const formStatus = document.getElementById('form-status');
  const submitButton = el.querySelector('button.submit');
  const submitLabel = submitButton.querySelector('.btn__label') || submitButton;

  const radioValue = (name) =>
    el.querySelector(`input[name="${name}"]:checked`)?.value ?? null;
  const text = (id) => document.getElementById(id)?.value.trim() || null;

  nameInput.addEventListener('input', () => { nameError.textContent = ''; });

  el.addEventListener('submit', async (e) => {
    e.preventDefault();

    nameError.textContent = '';
    formStatus.textContent = '';
    formStatus.className = 'status';

    const businessName = nameInput.value.trim();
    if (!businessName) {
      nameError.textContent = 'We need a name to go on.';
      formStatus.textContent = 'Almost, your business name is missing.';
      formStatus.className = 'status error';
      nameInput.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      nameInput.focus({ preventScroll: true });
      return;
    }

    const payload = {
      // Part 1: your place
      business_name:   businessName,
      business_type:   radioValue('business_type'),
      quiet_times:     quiet.picked(),
      avg_spend:       radioValue('avg_spend'),
      marketing_spend: radioValue('marketing_spend'),
      // Part 2: the idea
      appeal:          radioValue('appeal'),
      deliveries:      deliveries.picked(),
      top_delivery:    follow.top(),
      delivery_values: follow.values(),
      pay_model:       payCard.hidden ? null : radioValue('pay_model'),
      // Part 3: next
      followup:        radioValue('followup'),
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
const quiet = ticks('[data-checks="quiet"]', QUIET, { exclusive: 'never' });
let follow;
const deliveries = ticks('[data-checks="deliveries"]', shuffled(DELIVERIES), {
  exclusive: 'none',
  max: DELIVERIES_MAX,
  onChange: () => follow.sync(),
});
follow = followers(deliveries);
follow.sync();
minBodies();
buttons();
form(quiet, deliveries, follow);
