/* ============================================================
   Min for Business — questionnaire
   ------------------------------------------------------------
   The page behaves like the landing page, minus the scrubbed
   sequence: same Min, same submerge press, same material-emergence
   reveals, same atmosphere — the palette just stays at cave.

   1. reveals()    — IntersectionObserver adds .in; CSS runs the
                     emergence recipe (shared with the landing page).
   2. minBodies()  — Min in the wordmark's i-dot, and on the thank-you.
   3. buttons()    — the submerge press on .btn.
   4. atmosphere() — the people-in-fog field, gathering as you scroll.
   5. form()       — validation + submit to the Worker.

   Only business_name is required; everything else is optional
   signal for the merchant research. No contact fields live on this
   page — the follow-up conversation is arranged elsewhere. Endpoint
   is configurable via window.KIN_API_BASE (set before this module
   runs).
   ============================================================ */

import { buttons } from '/assets/js/press.js';
import { minBodies } from '/assets/js/min.js';

/* Marks that this module parsed and is running, so the stylesheet can
   keep static fallbacks for the two things only JS can deliver: the
   sunrise behind the cards, and Min in the wordmark's i-dot. If the
   module never loads, neither class arrives and CSS covers for it. */
document.documentElement.classList.add('js-ready');

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- 1. reveals -------------------------------------- */

function reveals() {
  // No observer (very old browser) — show everything rather than leave a
  // form the visitor can't read. The same guarantee as the CSS fail-safe.
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

/* ---------- 4. daylight + the atmosphere --------------------
   No sunrise here. The landing page opens at cave and lifts as you
   scroll, but that arc needs a hero to happen across — and this page
   has none, so the same ramp would fire inside the first few pixels
   of scroll and read as a lurch rather than a dawn.

   So the page simply opens at daylight and stays there. .resin is a
   pale, very translucent material and only reads as a lit object with
   light behind it, which is exactly what a questionnaire needs from
   the first question onward. What still moves with scroll is the
   atmosphere: people gathering in the field behind the cards.

   The helpers below mirror landing.js. They're small, and copying
   them keeps this page from having to import the landing page's
   scroll machinery, which is built around sections this page
   doesn't have (#problem, #dawn, #closer). */

const CREAM = [250, 247, 242];
const GRAPHITE = [35, 33, 30];

const smoothstep = (v) => v * v * (3 - 2 * v);

function sampleRamp(ramp, p) {
  for (let i = 0; i < ramp.length - 1; i++) {
    const [pa, ca] = ramp[i];
    const [pb, cb] = ramp[i + 1];
    if (p <= pb) {
      const s = smoothstep(clamp((p - pa) / (pb - pa || 1)));
      return [
        Math.round(lerp(ca[0], cb[0], s)),
        Math.round(lerp(ca[1], cb[1], s)),
        Math.round(lerp(ca[2], cb[2], s)),
      ];
    }
  }
  return ramp[ramp.length - 1][1];
}

function track(stops, p) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [pa, va] = stops[i];
    const [pb, vb] = stops[i + 1];
    if (p <= pb) return lerp(va, vb, clamp((p - pa) / (pb - pa || 1)));
  }
  return stops[stops.length - 1][1];
}

/* WCAG relative luminance, so the ink can pick itself rather than
   being lerped through an unreadable mid-grey. */
function luminance([r, g, b]) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const L_CREAM = luminance(CREAM);
const L_GRAPHITE = luminance(GRAPHITE);
const inkFor = (bg) => {
  const l = luminance(bg);
  return contrast(l, L_CREAM) >= contrast(l, L_GRAPHITE) ? CREAM : GRAPHITE;
};

function buildRamps() {
  return {
    /* Daylight from the first paint. The two stops are near-identical
       on purpose — just enough warm drift down the page to keep the
       ground from looking like flat paint, far too little to register
       as a colour change. */
    bg: [
      [0, [240, 235, 226]],   // #F0EBE2
      [1, [244, 235, 228]],   // #F4EBE4
    ],
    /* The field stays diffuse throughout: over daylight, any more than
       this muddies the page behind the cards. */
    alpha: [[0, 0.14], [1, 0.1]],
    /* people drawing together as you work down the questionnaire */
    gather: [[0, 0.35], [1, 0.85]],
    warmth: [[0, 0.85], [1, 1]],
  };
}

function daybreak(scene) {
  const root = document.documentElement;
  let ramps = buildRamps();
  let last = -1;
  let lastInk = null;

  const rebuild = () => { ramps = buildRamps(); last = -1; };
  addEventListener('resize', rebuild);
  addEventListener('load', rebuild);

  requestAnimationFrame(function frame() {
    requestAnimationFrame(frame);
    const max = document.body.scrollHeight - innerHeight;
    const p = clamp(max > 0 ? scrollY / max : 0);
    if (Math.abs(p - last) < 0.0005) return;
    last = p;

    const bg = sampleRamp(ramps.bg, p);
    root.style.setProperty('--bg', `rgb(${bg.join(' ')})`);

    const ink = inkFor(bg);
    if (ink !== lastInk) {
      lastInk = ink;
      root.style.setProperty('--ink', `rgb(${ink.join(' ')})`);
    }

    scene?.set({
      alpha: track(ramps.alpha, p),
      gather: track(ramps.gather, p),
      warmth: track(ramps.warmth, p),
    });
  });
}

/* ---------- 5. the form ------------------------------------- */

/* Served from a local static server, talk to a local `wrangler dev`
   instead of production — otherwise previewing the page writes test
   rows into the live database. Any other host is production, so this
   can't leak off localhost. Override either with window.KIN_API_BASE. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const DEFAULT_API = LOCAL_HOSTS.has(location.hostname)
  ? 'http://localhost:8787'
  : 'https://api.hellomin.app';

const API_BASE = (window.KIN_API_BASE || DEFAULT_API).replace(/\/$/, '');
const SUBMIT_URL = API_BASE + '/business';

function form() {
  const form = document.getElementById('business-form');
  if (!form) return;

  const businessNameInput = document.getElementById('business_name');
  const dealNotesField = document.getElementById('per_customer_deal_notes-field');
  const dealNotesInput = document.getElementById('per_customer_deal_notes');
  const deadHoursInput = document.getElementById('dead_hours');
  const walkinValueInput = document.getElementById('walkin_value');
  const commentsInput = document.getElementById('comments');
  const websiteInput = document.getElementById('website');
  const formStatus = document.getElementById('form-status');
  const submitButton = form.querySelector('button.submit');
  const submitLabel = submitButton.querySelector('.btn__label') || submitButton;

  // The name is the only field that can fail, so there is exactly one
  // error slot to clear.
  function clearErrors() {
    document.getElementById('business_name-error').textContent = '';
    formStatus.textContent = '';
    formStatus.className = 'status';
  }

  /* The ranking list. Tap order is the answer, so state lives in one
     array and the badges are redrawn from it; tapping a ranked item
     removes it and everything below closes up. The hidden input carries
     the order on submit, which keeps the whole thing working as a plain
     form field rather than something the submit handler has to know
     about. */
  const rankButtons = [...form.querySelectorAll('.rank-option')];
  const rankInput = document.getElementById('marketing_rank');
  const rankOrder = [];

  function paintRank() {
    for (const btn of rankButtons) {
      const i = rankOrder.indexOf(btn.dataset.value);
      const picked = i !== -1;
      btn.setAttribute('aria-pressed', String(picked));
      btn.querySelector('.rank-option__num').textContent = picked ? String(i + 1) : '';
      // The number is decoration; the label has to say the rank out loud
      // for anyone who can't see the badge.
      const label = btn.querySelector('.rank-option__label').textContent;
      btn.setAttribute('aria-label', picked ? `${label} — ranked ${i + 1}` : label);
    }
    rankInput.value = rankOrder.join(',');
  }

  for (const btn of rankButtons) {
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      const v = btn.dataset.value;
      const i = rankOrder.indexOf(v);
      if (i === -1) rankOrder.push(v);
      else rankOrder.splice(i, 1);
      paintRank();
    });
  }
  paintRank();

  // Selects start showing their disabled "Choose one" option, which is
  // greyed by .is-placeholder until a real choice replaces it.
  for (const select of form.querySelectorAll('select.select')) {
    select.addEventListener('change', () => {
      select.classList.toggle('is-placeholder', !select.value);
    });
  }

  // The write-in belongs to the two "yes" answers only. Clearing it on the
  // way out means answering yes, typing, then switching to "never" can't
  // leave a stale story attached to a deal that didn't happen.
  for (const radio of form.querySelectorAll('input[name="per_customer_deal"]')) {
    radio.addEventListener('change', () => {
      const isYes = radio.value.startsWith('yes');
      dealNotesField.style.display = isYes ? '' : 'none';
      if (isYes) dealNotesInput.focus();
      else dealNotesInput.value = '';
    });
  }

  const radioValue = (name) =>
    form.querySelector(`input[name="${name}"]:checked`)?.value ?? null;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    let valid = true;
    let firstBad = null;

    if (!businessNameInput.value.trim()) {
      document.getElementById('business_name-error').textContent = 'We need a name to go on.';
      firstBad = firstBad || businessNameInput;
      valid = false;
    }

    if (!valid) {
      formStatus.textContent = 'Almost — one thing needs fixing above.';
      formStatus.className = 'status error';
      // The name field is three cards up by the time you reach submit,
      // so an error there is off screen unless we go back to it.
      firstBad?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      firstBad?.focus({ preventScroll: true });
      return;
    }

    const payload = {
      business_name: businessNameInput.value.trim(),
      // Ranked best-first, so [0] is what works and [last] is what they
      // value least — the three old questions, in one answer.
      marketing_rank: [...rankOrder],
      marketing_none: document.getElementById('marketing_none').checked,
      monthly_marketing_spend: radioValue('monthly_marketing_spend'),
      per_customer_deal: radioValue('per_customer_deal'),
      per_customer_deal_notes: dealNotesInput.value.trim() || null,
      ads_satisfaction: radioValue('ads_satisfaction'),
      ai_concern: radioValue('ai_concern'),
      concept_interest: radioValue('concept_interest'),
      group_events: radioValue('group_events'),
      dead_hours: deadHoursInput.value.trim() || null,
      walkin_value: walkinValueInput.value.trim() || null,
      pricing_pref: radioValue('pricing_pref'),
      followup_interest: radioValue('followup_interest'),
      comments: commentsInput.value.trim() || null,
      website: websiteInput ? websiteInput.value : '' // honeypot — always empty for real users
    };

    const originalLabel = submitLabel.textContent;
    submitButton.disabled = true;
    submitLabel.textContent = 'Sending…';
    formStatus.textContent = '';
    formStatus.className = 'status';

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
      form.style.display = 'none';
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
minBodies();
buttons();
form();

// The atmosphere is a bonus, never a dependency: if three.js can't be
// fetched, the colour ramp still runs and the page reads fine.
(async () => {
  let scene = null;
  const canvas = document.getElementById('scene');
  if (canvas && !reduced) {
    try {
      const mod = await import('/assets/js/landing-scene.js');
      scene = await mod.createScene(canvas);
    } catch (err) {
      console.warn('[kin] atmosphere unavailable', err);
      canvas.remove();
    }
  } else if (canvas) {
    canvas.remove();
  }
  daybreak(scene);
})();
