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

   Only business_name and location are required; everything else is
   optional signal for the hyperlocal-ads research. Endpoint is
   configurable via window.KIN_API_BASE (set before this module runs).
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

/* ---------- 4. daybreak + the atmosphere --------------------
   The landing page's sunrise, compressed to this page's shape: the
   hero opens at cave, and the light comes up as you reach the first
   question. That arc isn't decoration here — .resin is a pale, very
   translucent material, so a card only reads as a lit object once
   there is light behind it. Held at cave, the whole questionnaire
   silts up into low-contrast murk.

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

/* Keyframed off the form's real offset, not a guessed fraction, so
   editing copy can't drift the sunrise into the middle of a card. */
function buildRamps() {
  const max = Math.max(1, document.body.scrollHeight - innerHeight);
  const pp = (px) => clamp(px / max, 0, 0.995);
  const formTop = document.querySelector('.biz-form-section')?.offsetTop ?? innerHeight;

  const breaks = pp(formTop - innerHeight * 0.75);  // light starts arriving
  const risen = pp(formTop - innerHeight * 0.15);   // full daylight, card one

  return {
    bg: [
      [0, [42, 35, 32]],            // #2A2320 — cave, under the hero
      [breaks, [70, 58, 49]],        // #463A31 — the cave floor lifting
      [lerp(breaks, risen, 0.55), [214, 197, 172]],  // first light
      [risen, [240, 235, 226]],      // #F0EBE2 — daylight
      [Math.min(0.995, risen + 0.18), [246, 238, 230]],
      [1, [244, 235, 228]],          // settled daylight for the rest of the form
    ],
    /* the field diffuses away as the light comes up — at full strength
       over daylight it would just muddy the page behind the cards */
    alpha: [[0, 1], [breaks, 0.92], [risen, 0.14], [1, 0.1]],
    /* people drawing together as you work down the questionnaire */
    gather: [[0, 0.18], [risen, 0.5], [1, 0.85]],
    warmth: [[0, 0.02], [breaks, 0.12], [risen, 0.85], [1, 1]],
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

  const tabEmail = document.getElementById('tab-email');
  const tabPhone = document.getElementById('tab-phone');
  const segmented = tabEmail.closest('.segmented');
  const segmentedPill = segmented.querySelector('.segmented__pill');
  const emailField = document.getElementById('email-field');
  const phoneField = document.getElementById('phone-field');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const businessNameInput = document.getElementById('business_name');
  const locationInput = document.getElementById('location');
  const businessTypeSelect = document.getElementById('business_type');
  const businessTypeOtherField = document.getElementById('business_type_other-field');
  const businessTypeOtherInput = document.getElementById('business_type_other');
  const contactNameInput = document.getElementById('contact_name');
  const slowTimesInput = document.getElementById('slow_times');
  const walkinValueInput = document.getElementById('walkin_value');
  const trustNotesInput = document.getElementById('trust_notes');
  const websiteInput = document.getElementById('website');
  const formStatus = document.getElementById('form-status');
  const submitButton = form.querySelector('button.submit');
  const submitLabel = submitButton.querySelector('.btn__label') || submitButton;

  let contactMode = 'email';

  function setMode(mode) {
    if (mode === contactMode) return;
    contactMode = mode;
    const isEmail = mode === 'email';
    tabEmail.classList.toggle('active', isEmail);
    tabPhone.classList.toggle('active', !isEmail);
    segmented.classList.toggle('is-phone', !isEmail);
    segmentedPill.classList.remove('is-launching');
    void segmentedPill.offsetWidth; // restart the launch keyframes on repeat clicks
    segmentedPill.classList.add('is-launching');
    emailField.style.display = isEmail ? '' : 'none';
    phoneField.style.display = isEmail ? 'none' : '';
    clearErrors();
  }

  function clearErrors() {
    for (const id of ['business_name-error', 'location-error', 'email-error', 'phone-error']) {
      document.getElementById(id).textContent = '';
    }
    formStatus.textContent = '';
    formStatus.className = 'status';
  }

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isValidPhone = (v) => v.replace(/[^\d]/g, '').length >= 7;

  businessTypeSelect.addEventListener('change', () => {
    businessTypeSelect.classList.toggle('is-placeholder', !businessTypeSelect.value);

    // The write-in belongs to "Something else" only. Clearing it on the way
    // out means picking "other", typing, then changing your mind can't leave
    // a stale answer attached to a category it doesn't describe.
    const isOther = businessTypeSelect.value === 'other';
    businessTypeOtherField.style.display = isOther ? '' : 'none';
    if (isOther) {
      businessTypeOtherInput.focus();
    } else {
      businessTypeOtherInput.value = '';
    }
  });

  tabEmail.addEventListener('click', () => setMode('email'));
  tabPhone.addEventListener('click', () => setMode('phone'));

  const checkedValues = (name) =>
    [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((el) => el.value);
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

    if (!locationInput.value.trim()) {
      document.getElementById('location-error').textContent = 'Whereabouts is it?';
      firstBad = firstBad || locationInput;
      valid = false;
    }

    // Contact is optional here — only validate the visible field's format
    // if the person actually typed something into it.
    const activeContactValue = (contactMode === 'email' ? emailInput.value : phoneInput.value).trim();
    if (activeContactValue) {
      if (contactMode === 'email' && !isValidEmail(activeContactValue)) {
        document.getElementById('email-error').textContent = 'That email doesn’t look right.';
        firstBad = firstBad || emailInput;
        valid = false;
      } else if (contactMode === 'phone' && !isValidPhone(activeContactValue)) {
        document.getElementById('phone-error').textContent = 'That number doesn’t look right.';
        firstBad = firstBad || phoneInput;
        valid = false;
      }
    }

    if (!valid) {
      formStatus.textContent = 'Almost — a couple of things need fixing above.';
      formStatus.className = 'status error';
      // The required fields are four cards up by the time you reach submit,
      // so an error there is off screen unless we go back to it.
      firstBad?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      firstBad?.focus({ preventScroll: true });
      return;
    }

    const payload = {
      business_name: businessNameInput.value.trim(),
      location: locationInput.value.trim(),
      business_type: businessTypeSelect.value || null,
      business_type_other:
        businessTypeSelect.value === 'other' ? (businessTypeOtherInput.value.trim() || null) : null,
      contact_name: contactNameInput.value.trim() || null,
      contact_method: activeContactValue ? contactMode : null,
      email: activeContactValue && contactMode === 'email' ? activeContactValue : null,
      phone: activeContactValue && contactMode === 'phone' ? activeContactValue : null,
      current_marketing: checkedValues('current_marketing'),
      slow_times: slowTimesInput.value.trim() || null,
      concept_interest: radioValue('concept_interest'),
      walkin_value: walkinValueInput.value.trim() || null,
      pricing_pref: radioValue('pricing_pref'),
      pilot_interest: radioValue('pilot_interest'),
      trust_notes: trustNotesInput.value.trim() || null,
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
