/* ============================================================
   min — the IRL activities survey, v2 (/survey/v2/)
   ------------------------------------------------------------
   Spec: min/surveys/user survey.md. The rules:

     • One page at a time. "Next" checks the page; every question
       is required unless it says optional.
     • The answers are anonymous. The one exception is the
       optional email on the last page, which the Worker stores
       in a table of its own, never on the response row.
     • Every counter starts at 0. A 0 on page 2's first counter
       skips page 3. Page 3's four counts must add up to it.
     • Page 7 shows one offer, for the first activity ticked on
       page 6 (coffee if only "something else"), a people line
       from a random one of their "who with" picks, and a €0.25 or
       a €1.00 fee drawn per visit. The fee is the only thing the
       draw changes, so the "yes" rates of the two can be compared.
     • ?src= (waitlist, campus, social, friend, poster), the fee
       drawn and the start / finish times ride along. A survey
       poster's QR code sends ?src=poster with ?l= (the place) and
       ?p= (the design), and those ride along too.

   1. reveals()  — IntersectionObserver adds .in.
   2. controls   — counters, tick lists, the conditional fields.
   3. pages      — back / next, the skip, the checks.
   4. send()     — submit to the Worker.
   ============================================================ */

import { buttons } from '/assets/js/press.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- the tick lists ----------------------------------
   Keys are what the Worker stores (IA_MULTI in its index.js); it
   drops anything it doesn't recognise. `shuffle` rows reorder per
   visit so no row wins by being first; the rest stay last, in
   order. `alone` can't be combined with anything. */
const CHECKS = {
  missed_reasons: {
    max: 2,
    alone: 'cant_think',
    shuffle: [
      ['cant_decide', "I couldn't decide what to do"],
      ['nobody_free', 'Nobody was free to join me'],
      ['effort',      'Planning or getting there felt like too much effort'],
      ['expensive',   'The activity or ticket was too expensive'],
      ['comfortable', 'I got too comfortable at home or on my phone'],
    ],
    fixed: [
      ['other',      'Something else'],
      ['cant_think', "I can't think of a time like this"],
    ],
  },
  more_kinds: {
    max: 2,
    shuffle: [
      ['eat_drink', 'Hang out over coffee, food or drinks (café, lunch, bar)'],
      ['play',      'Play something (board games, bowling, climbing)'],
      ['see',       'See something (museum, gallery, cinema)'],
      ['move',      'Move (gym, sport, a walk)'],
      ['go_to',     'Go to something (concert, club night, student event)'],
    ],
    fixed: [['other', 'Something else']],
  },
  more_with: {
    max: Infinity,
    shuffle: [],
    fixed: [
      ['alone',      'Alone'],
      ['friends',    'With only friends'],
      ['mixed',      "With friends and new people I'd vibe with"],
      ['new_people', "With only new people I'd vibe with"],
    ],
  },
};

/* The counters run 0 to 10, and 10 reads "10+". */
const COUNT_MAX = 10;

/* ---------- page 7: the fee ---------------------------------
   Must match fee_variant in the Worker. crypto, not Math.random():
   the draw is the experiment. */
const FEES = { A: '€0.25', B: '€1.00' };
const FEE = crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? 'B' : 'A';

/* ---------- page 7: the offer -------------------------------
   One offer, for the first activity ticked on page 6 in the order
   it was shown. That list is shuffled, so with two ticks this is a
   random pick of the two. "Something else" alone gets the coffee.
   Keys must match offer_shown in the Worker. Only the fee differs
   between A and B; the offer follows the person's own picks.
   Each activity has its own group size, min–max. The venue names
   are made up, so no real business is shown or implied. */
const OFFERS = {
  eat_drink: { icon: '☕', title: 'Coffee + pulla', venue: 'Kahvila Kanelitaivas, Kallio', walk: 6,
               price: '<b>€4.00</b> set <s>menu €5.00</s>', min: 3, max: 5 },
  play:      { icon: '🎲', title: 'Board game table', venue: 'Noppakolo Game Café, Sörnäinen', walk: 10,
               price: '<b>€6.00</b> a person', min: 3, max: 6 },
  see:       { icon: '🖼', title: 'Art museum, student ticket', venue: 'Valohalli Art Museum, Töölö', walk: 10,
               price: '<b>€8.00</b>', min: 3, max: 5 },
  move:      { icon: '🧘', title: 'Drop-in yoga or spin, student price', venue: 'Studio Sykevirta, Hakaniemi', walk: 12,
               price: '<b>€8.00</b> <s>normally €12.00</s>', min: 3, max: 6 },
  go_to:     { icon: '🎵', title: 'Live music tonight', venue: 'Bar Vinyylikettu, Punavuori', walk: 8,
               price: '<b>€5.00</b> entry', min: 3, max: 8 },
};
const DEFAULT_OFFER = 'eat_drink';
const offerFor = (kinds) => kinds.find((k) => k in OFFERS) ?? DEFAULT_OFFER;

/* One people block under the price, from a random one of their
   page 6 "who with" picks. The roll is drawn once per visit, so
   going back and forth doesn't reshuffle it. Keys must match
   people_shown in the Worker.

   The respondent is never listed: they haven't joined yet. Everyone
   already in is one row [initial, name, detail]. A friend is only
   already in on a friends-only offer; on the new-people offers the
   friend is theirs to bring, so the last row is a "+" (the +1).
   Each new person gets one tag, drawn per person and per visit. The
   names (Mia, Leo, Sara) and "9:41" are the same on every offer. */
const TAGS = ['an interest in common', 'a similar background', 'at the same stage of life'];
const rand = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const MIA  = ['M', 'Mia', 'your friend'];
const LEO  = ['L', 'Leo', TAGS[rand(TAGS.length)]];
const SARA = ['S', 'Sara', TAGS[rand(TAGS.length)]];
const FILL = '⏱ 9:41 left to fill';
const MONEY_BACK = (n) => `goes ahead at ${n} · money back if not`;
/* Everyone can bring at most one friend (+1), so pairs never take
   over a group. Friends-only groups are the exception: from 2 up to
   the activity's max, and anyone can invite friends. */
const PLUS_ONE = ['Bring a friend', '+1, after you join'];
const PEOPLE = {
  alone:      () => ({ size: '👤 Just you', who: [], timer: ['Go now, no wait', null] }),
  friends:    (o) => ({ size: `👥 2–${o.max} people`, who: [MIA], add: ['Invite friends', 'after you join'],
                        timer: [FILL, MONEY_BACK(2)], lock: true }),
  mixed:      (o) => ({ size: `👥 ${o.min}–${o.max} people`, who: [LEO], add: PLUS_ONE,
                        timer: [FILL, MONEY_BACK(o.min)] }),
  new_people: (o) => ({ size: `👥 ${o.min}–${o.max} people`, who: [LEO, SARA], add: PLUS_ONE,
                        timer: [FILL, MONEY_BACK(o.min)] }),
};
const PEOPLE_ROLL = rand(2 ** 32);
const peopleFor = (withWho) => withWho.length ? withWho[PEOPLE_ROLL % withWho.length] : null;

function personRow(mark, name, detail, extra = '') {
  const li = document.createElement('li');
  li.className = `offer__person ${extra}`.trim();
  const avatar = document.createElement('span');
  avatar.className = 'offer__avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = mark;
  const nameEl = document.createElement('span');
  nameEl.className = 'offer__name';
  nameEl.textContent = name;
  const d = document.createElement('span');
  d.className = 'offer__detail';
  d.textContent = detail;
  li.append(avatar, nameEl, d);
  return li;
}

function showOffer(key, people) {
  const o = OFFERS[key];
  const g = (PEOPLE[people] ?? PEOPLE.new_people)(o);
  const el = (id) => document.getElementById(id);
  const set = (id, value) => { el(id).textContent = value ?? ''; };
  set('offer-icon', o.icon);
  set('offer-title', o.title);
  set('offer-venue', o.venue);
  set('offer-meta', `${o.walk} min walk`);
  el('offer-price').innerHTML = o.price;   // fixed strings above, never user input

  set('offer-size', g.who.length ? `${g.size} · ${g.who.length} joined` : g.size);
  const rows = g.who.map(([mark, name, detail]) => personRow(mark, name, detail));
  if (g.add) rows.push(personRow('+', g.add[0], g.add[1], 'offer__person--add'));
  el('offer-who').replaceChildren(...rows);
  el('offer-who').hidden = !rows.length;
  el('offer-lock').hidden = !g.lock;
  set('offer-timer-main', g.timer[0]);
  set('offer-timer-sub', g.timer[1]);
  el('offer-timer-sub').hidden = !g.timer[1];
}

/* Where the link was shared. Must match source in the Worker. */
const PARAMS = new URLSearchParams(location.search);
const SOURCE = PARAMS.get('src')?.toLowerCase() || null;
/* Which survey poster, when its QR code sent them. The Worker
   checks both against its own lists and keeps them only with
   src=poster. */
const POSTER_LOCATION = PARAMS.get('l') || null;
const POSTER = PARAMS.get('p') || null;

const STARTED_AT = new Date().toISOString();

/* ---------- 1. reveals -------------------------------------- */

function reveals() {
  if (!('IntersectionObserver' in window)) {
    document.documentElement.classList.remove('reveal-armed');
    return;
  }
  // Cards on a hidden page don't intersect, so they wait here until
  // their page shows.
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
  $$('[data-reveal]').forEach((el) => io.observe(el));
}

/* ---------- 2. controls ------------------------------------- */

/* A − / value / + stepper. Empty until the first tap. `max` can
   move (page 3's counters top out at page 2's number); a value
   above a new max is pulled down to it. */
function counter(name, onChange = () => {}, start = null) {
  const host = $(`[data-counter="${name}"]`);
  let value = start;
  let max = COUNT_MAX;

  host.innerHTML = `
    <button type="button" class="counter__btn" data-d="-1" aria-label="One fewer">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
    <output class="counter__value" aria-live="polite"></output>
    <button type="button" class="counter__btn" data-d="1" aria-label="One more">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9h10M9 4v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>`;
  const out = $('output', host);
  const [minus, plus] = $$('button', host);

  const sync = () => {
    out.textContent = value === null ? 'Tap − or +' : value >= COUNT_MAX ? `${COUNT_MAX}+` : String(value);
    host.classList.toggle('is-empty', value === null);
    minus.disabled = value === 0;
    plus.disabled = value !== null && value >= max;
  };

  for (const btn of [minus, plus]) {
    btn.addEventListener('click', () => {
      const d = Number(btn.dataset.d);
      value = value === null ? (d > 0 ? Math.min(1, max) : 0) : Math.min(max, Math.max(0, value + d));
      sync();
      onChange(value);
    });
  }
  sync();

  return {
    get: () => value,
    setMax(n) {
      max = n;
      if (value !== null && value > max) value = max;
      sync();
    },
  };
}

/* "Something else" (or "self-describe") opens its text box. */
function otherField(key, show) {
  const field = $(`[data-other-for="${key}"]`);
  if (!field || field.hidden !== show) return;
  field.hidden = !show;
  const input = $('input', field);
  if (show) input.focus();
  else input.value = '';
}

/* A tick list. At `max` the rest grey out rather than silently
   swapping a tick. Returns the ticked keys. */
function checks(key, onChange = () => {}) {
  const { max, alone, shuffle, fixed } = CHECKS[key];
  const host = $(`[data-checks="${key}"]`);
  const rows = shuffle.slice();
  for (let i = rows.length - 1; i > 0; i--) {         // Fisher–Yates
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  const boxes = new Map();
  for (const [slug, label] of [...rows, ...fixed]) {
    const wrap = document.createElement('label');
    wrap.className = 'option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = `${key}_${slug}`;
    input.value = slug;
    const text = document.createElement('span');
    text.textContent = label;
    wrap.append(input, text);
    host.appendChild(wrap);
    boxes.set(slug, input);
  }

  const picked = () => [...boxes].filter(([, b]) => b.checked).map(([k]) => k);

  const sync = () => {
    const n = picked().length;
    for (const box of boxes.values()) {
      box.disabled = !box.checked && n >= max;
      box.closest('label').classList.toggle('is-disabled', box.disabled);
    }
    otherField(key, boxes.get('other')?.checked ?? false);
    onChange(picked());
  };

  for (const [slug, input] of boxes) {
    input.addEventListener('change', () => {
      if (input.checked && alone) {
        if (slug === alone) {
          for (const [k, other] of boxes) if (k !== alone) other.checked = false;
        } else {
          boxes.get(alone).checked = false;
        }
      }
      sync();
    });
  }

  return picked;
}

const radioValue = (name) => $(`input[name="${name}"]:checked`)?.value ?? null;
const text = (id) => document.getElementById(id)?.value.trim() || null;

/* Radios with a text box behind one answer. */
function radioOther(name, trigger) {
  $$(`input[name="${name}"]`).forEach((input) => {
    input.addEventListener('change', () => otherField(name, radioValue(name) === trigger));
  });
}

/* ---------- 3. pages ---------------------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function survey() {
  const el = document.getElementById('survey-form');
  const pages = $$('.sv-page', el);
  const back = document.getElementById('back');
  const next = document.getElementById('next');
  const nextLabel = $('.btn__label', next);
  const status = document.getElementById('form-status');
  let at = 0;

  /* Page 2 → page 3. */
  const split = {};
  const SPLIT = ['past_alone', 'past_friends', 'past_mixed', 'past_new'];
  const total = document.getElementById('split-total');
  const syncSplit = () => {
    const n = past.get();
    const parts = SPLIT.map((k) => split[k].get());
    const sum = parts.reduce((a, v) => a + (v ?? 0), 0);
    $$('[data-past-n]').forEach((s) => { s.textContent = n === null ? '' : n >= COUNT_MAX ? `${COUNT_MAX}+` : String(n); });
    $$('[data-past-sum]').forEach((s) => { s.textContent = n === null ? '' : String(n); });
    total.textContent = n === null ? '' : `${sum} of ${n}${n >= COUNT_MAX ? '+' : ''} so far`;
    total.classList.toggle('is-done', parts.every((v) => v !== null) && sum === n);
  };
  const past = counter('acts_past', (n) => {
    for (const c of Object.values(split)) c.setMax(n);
    syncSplit();
  }, 0);
  const want = counter('acts_want', undefined, 0);
  for (const k of [...SPLIT, 'past_same_day']) {
    // Page 3's counters start at 0, not empty: the total line and the
    // add-up check already make people look at each one.
    split[k] = counter(k, syncSplit, 0);
  }

  /* Page 5: "can't think of a time" skips the story. */
  const storyCard = document.getElementById('story-card');
  const missed = checks('missed_reasons', (keys) => {
    const skip = keys.includes('cant_think');
    storyCard.hidden = skip;
    if (skip) document.getElementById('missed_story').value = '';
  });
  const kinds = checks('more_kinds');
  const withWho = checks('more_with');
  radioOther('last_free', 'other');
  radioOther('gender', 'self_describe');
  document.getElementById('offer-fee').textContent = FEES[FEE];

  /* Page 3 only when page 2 had any. */
  const shown = (page) => page.dataset.page !== 'those' || past.get() > 0;
  const live = () => pages.filter(shown);

  /* What's missing on a page, or null when it's done. */
  const missing = (page) => {
    const required = $$('[data-required]', page).some((f) => !radioValue(f.dataset.required));
    switch (page.dataset.page) {
      case 'those': {
        const parts = SPLIT.map((k) => split[k].get());
        if (parts.includes(null) || split.past_same_day.get() === null) return 'Tap − or + on each, 0 is fine.';
        const n = past.get();
        if (parts.reduce((a, v) => a + v, 0) !== n) {
          return `The four need to add up to ${n}.`;
        }
        return null;
      }
      case 'missed':
        return missed().length ? null : 'Pick at least one.';
      case 'more':
        if (!kinds().length) return 'Pick at least one activity.';
        return withWho().length ? null : 'Pick who you would like to go with.';
      case 'patch': {
        const email = text('email');
        const ticked = $('#draw').checked || $('#waitlist').checked;
        if (!email && !ticked) return null;
        if (!email || !EMAIL_RE.test(email)) {
          $('#email-error').textContent = email ? 'That email looks off.' : 'Add your email, or untick the boxes.';
          return 'Almost, the email needs a look.';
        }
        return ticked ? null : 'Tick the draw, the waitlist, or both.';
      }
      case 'min':
        if (!radioValue('would_book')) return "Pick yes or no.";
        return required ? 'Answer each question to go on.' : null;
      default:
        return required ? 'Answer each question to go on.' : null;
    }
  };

  const show = (i, { scroll = true } = {}) => {
    at = i;
    const list = live();
    if (list[at].dataset.page === 'min') showOffer(offerFor(kinds()), peopleFor(withWho()));
    pages.forEach((p) => { p.hidden = p !== list[at]; });
    // "Step n of m" over the question pages still showing.
    list.slice(1).forEach((p, j) => {
      const step = $('[data-step]', p);
      if (step) step.textContent = `${j + 1} of ${list.length - 1}`;
    });
    back.hidden = at === 0;
    nextLabel.textContent = at === 0 ? 'Start' : at === list.length - 1 ? 'Send my answers' : 'Next';
    status.textContent = '';
    status.className = 'status';
    if (scroll) {
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      const heading = $('h2', list[at]);
      heading?.setAttribute('tabindex', '-1');
      heading?.focus({ preventScroll: true });
    }
  };

  back.addEventListener('click', () => show(Math.max(0, at - 1)));

  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#email-error').textContent = '';
    const list = live();
    const problem = missing(list[at]);
    if (problem) {
      status.textContent = problem;
      status.className = 'status error';
      return;
    }
    if (at < list.length - 1) return show(at + 1);

    const n = past.get();
    const tickedBox = $('#draw').checked || $('#waitlist').checked;
    const gender = radioValue('gender');
    const lastFree = radioValue('last_free');
    const missedKeys = missed();
    const kindKeys = kinds();
    const payload = {
      acts_past:      n,
      acts_want:      want.get(),
      past_alone:     n > 0 ? split.past_alone.get() : null,
      past_friends:   n > 0 ? split.past_friends.get() : null,
      past_mixed:     n > 0 ? split.past_mixed.get() : null,
      past_new:       n > 0 ? split.past_new.get() : null,
      past_same_day:  n > 0 ? split.past_same_day.get() : null,
      last_free:      lastFree,
      last_free_other: lastFree === 'other' ? text('last_free_other') : null,
      last_free_when: radioValue('last_free_when'),
      missed_reasons: missedKeys,
      missed_other:   missedKeys.includes('other') ? text('missed_other') : null,
      missed_story:   missedKeys.includes('cant_think') ? null : text('missed_story'),
      more_kinds:     kindKeys,
      more_kinds_other: kindKeys.includes('other') ? text('more_kinds_other') : null,
      more_with:      withWho(),
      people_shown:   peopleFor(withWho()),
      fee_variant:    FEE,
      offer_shown:    offerFor(kindKeys),
      would_book:     radioValue('would_book'),
      use_freq:       radioValue('use_freq'),
      status:         radioValue('status'),
      moved_recently: radioValue('moved_recently'),
      age:            radioValue('age'),
      gender,
      gender_self_describe: gender === 'self_describe' ? text('gender_self_describe') : null,
      anything_else:  text('anything_else'),
      // Split off by the Worker, never stored with the answers.
      email:    tickedBox ? text('email') : null,
      draw:     $('#draw').checked,
      waitlist: $('#waitlist').checked,
      source:   SOURCE,
      poster_location: POSTER_LOCATION,
      poster:   POSTER,
      started_at:  STARTED_AT,
      finished_at: new Date().toISOString(),
      website: document.getElementById('website')?.value ?? '' // honeypot
    };

    await send(el, next, nextLabel, status, payload);
  });

  show(0, { scroll: false });
}

/* ---------- 4. send -----------------------------------------
   Local static server → local `wrangler dev`, so previewing never
   writes into the live database. Override with window.KIN_API_BASE. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const DEFAULT_API = LOCAL_HOSTS.has(location.hostname)
  ? 'http://localhost:8787'
  : 'https://api.hellomin.app';

const API_BASE = (window.KIN_API_BASE || DEFAULT_API).replace(/\/$/, '');
const SUBMIT_URL = API_BASE + '/survey/v2';

async function send(el, button, label, status, payload) {
  const original = label.textContent;
  button.disabled = true;
  label.textContent = 'Sending…';

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
    button.disabled = false;
    label.textContent = original;
    status.textContent = err.message || 'Network error. Please try again.';
    status.className = 'status error';
  }
}

/* ---------- boot -------------------------------------------- */

reveals();
survey();
buttons();
