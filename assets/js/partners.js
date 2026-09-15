/* ============================================================
   Min for venues — /partners/
   ------------------------------------------------------------
   The page behaves like the landing page, minus the scrubbed
   sequence: same Min, same submerge press, same material-emergence
   reveals, same atmosphere. The only motion that is this page's own
   is the daybreak, and it is not decoration — .resin is a pale,
   very translucent material, so a card only reads as a lit object
   once there is light behind it. Held at cave, the whole argument
   silts up into low-contrast murk.

   1. reveals()    — IntersectionObserver adds .in; CSS runs the
                     emergence recipe (shared with the landing page).
   2. minBodies()  — Min in the wordmark's i-dot, and on the closer.
   3. buttons()    — the submerge press on .btn.
   4. daybreak()   — the colour ramp + the people-in-fog field.

   The ramp helpers below mirror business.js. They're small, and
   copying them keeps this page from importing the landing page's
   scroll machinery, which is built around sections (#problem,
   #dawn, #closer) that this page doesn't have.
   ============================================================ */

import { buttons } from '/assets/js/press.js';
import { minBodies } from '/assets/js/min.js';

/* Marks that this module parsed and is running, so the stylesheet can
   keep static fallbacks for the two things only JS can deliver: the
   light behind the cards, and Min in the wordmark's i-dot. If the
   module never loads, neither class arrives and CSS covers for it. */
document.documentElement.classList.add('js-ready');

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- 1. reveals -------------------------------------- */

function reveals() {
  // No observer (very old browser) — show everything rather than leave a
  // page nobody can read. The same guarantee as the CSS fail-safe.
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

/* ---------- 2. daybreak + the atmosphere -------------------- */

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

/* Keyframed off the real offset of the first argument section, not a
   guessed fraction, so editing copy can't drift the sunrise into the
   middle of a card. Rebuilt on resize. */
function buildRamps() {
  const max = Math.max(1, document.body.scrollHeight - innerHeight);
  const pp = (px) => clamp(px / max, 0, 0.995);
  const bodyTop = document.querySelector('.pt-body')?.offsetTop ?? innerHeight;

  const breaks = pp(bodyTop - innerHeight * 0.75);  // light starts arriving
  const risen = pp(bodyTop - innerHeight * 0.15);   // full daylight, card one

  return {
    bg: [
      [0, [42, 35, 32]],                             // #2A2320 — cave, under the hero
      [breaks, [70, 58, 49]],                        // #463A31 — the cave floor lifting
      [lerp(breaks, risen, 0.55), [214, 197, 172]],  // first light
      [risen, [240, 235, 226]],                      // #F0EBE2 — daylight
      [Math.min(0.995, risen + 0.18), [246, 238, 230]],
      [1, [244, 235, 228]],                          // settled daylight for the rest
    ],
    /* the field diffuses away as the light comes up — at full strength
       over daylight it would just muddy the page behind the cards */
    alpha: [[0, 1], [breaks, 0.92], [risen, 0.14], [1, 0.1]],
    /* people drawing together as you read down the argument, which is
       the argument */
    gather: [[0, 0.18], [risen, 0.5], [1, 0.88]],
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
  // Opening a <details> changes the document height, which moves every
  // breakpoint in the ramp. Without this the light drifts a little each
  // time somebody reads an answer.
  document.querySelectorAll('.pt-q').forEach((d) => d.addEventListener('toggle', rebuild));

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

/* ---------- boot -------------------------------------------- */

reveals();
minBodies();
buttons();

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
