/* ============================================================
   Kin — the public pitch deck
   ------------------------------------------------------------
   1. deck()      — paging: swipe is native (scroll-snap), this adds the
                    keyboard, the wheel, the toolbar and the URL hash.
   2. palette()   — lerps --bg / --ink between the slides' own colours as
                    you swipe, so the deck moves through one continuous
                    cave → daylight → cave the way the landing page does.
   3. ring()      — slide 4's constellation, played on entry instead of
                    scrubbed by a scroll. Same CSS, different driver.
   4. minBodies() — Min himself (min.js), shared with the landing page.
   5. buttons()   — the submerge press (press.js), shared with everything.

   The deck degrades in one step: without this file the track is still a
   horizontal scroll-snap container you can drag through, every slide is
   still laid out, and the ring sits assembled instead of assembling.
   ============================================================ */

import { buttons } from '/assets/js/press.js';
import { minBodies } from '/assets/js/min.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (v) => v * v * (3 - 2 * v);
const seg = (t, a, b) => smoothstep(clamp((t - a) / (b - a || 1)));

const deckEl = document.querySelector('.deck');
const slides = [...document.querySelectorAll('.slide')];

/* The deck pages sideways on a desktop and downwards on a phone, because
   that is the gesture each one already has. Which way is a CSS decision —
   this query is the same one pitchdeck.css switches the track on, so the
   breakpoint lives in both files and has to stay the same number. */
const portrait = matchMedia('(max-width: 760px)');
const vertical = () => portrait.matches;
/* how far along the track we are, in slides, whichever way it runs */
const offset = () => (vertical()
  ? deckEl.scrollTop / (deckEl.clientHeight || 1)
  : deckEl.scrollLeft / (deckEl.clientWidth || 1));

/* ---------- 2. the palette ----------------------------------
   Same two inks as the landing page, chosen by contrast rather than
   lerped: the background moves continuously, the ink flips once, and the
   registered `transition: --ink` crossfades everything derived from it. */

const CREAM = [250, 247, 242];
const GRAPHITE = [35, 33, 30];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

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

function inkFor(bg) {
  const l = luminance(bg);
  return contrast(l, L_CREAM) >= contrast(l, L_GRAPHITE) ? CREAM : GRAPHITE;
}

/* Each slide carries its own colour in data-bg; the page is whatever the
   two slides either side of the current scroll position mix to. Because
   the mix follows the scroll rather than the settled index, the light
   changes *while* your thumb is still moving. */
function palette() {
  const root = document.documentElement;
  const rail = document.querySelector('.rail');
  const stops = slides.map((s) => hex(s.dataset.bg || '#2A2320'));
  let lastInk = null;
  let last = -1;

  return function paint(pos) {
    if (Math.abs(pos - last) < 0.001) return;
    last = pos;

    const i = clamp(Math.floor(pos), 0, stops.length - 1);
    const j = clamp(i + 1, 0, stops.length - 1);
    const t = smoothstep(clamp(pos - i));
    const bg = [0, 1, 2].map((k) => Math.round(lerp(stops[i][k], stops[j][k], t)));

    root.style.setProperty('--bg', `rgb(${bg.join(' ')})`);
    const ink = inkFor(bg);
    if (ink !== lastInk) {
      lastInk = ink;
      root.style.setProperty('--ink', `rgb(${ink.join(' ')})`);
    }
    if (rail) {
      rail.style.setProperty('--p', (pos / Math.max(1, slides.length - 1)).toFixed(4));
    }
  };
}

/* ---------- 3. the constellation ---------------------------
   The landing page scrubs this figure off the scroll; a slide has no
   scroll to scrub, so it plays once on entry and holds. Every value
   still lands in --in / --cold / --warm, which is why the CSS for it is
   the landing page's, untouched. */

const BLOB_AT = (i) => 0.03 + i * 0.045;
const BLOB_FADE = 0.12;
const LINK_AT = (i) => 0.5 + i * 0.05;
const LINK_DRAW = 0.1;
const DASH = 24;
const RING_MS = 4200;

function ring() {
  const scene = document.querySelector('.scene');
  if (!scene || reduced) return { play() {}, reset() {} };

  const blobs = [...scene.querySelectorAll('.blob')];
  const links = [...scene.querySelectorAll('.ring__links line')];
  const min = scene.querySelector('.min--dawn');

  scene.classList.add('is-armed');

  function paint(t) {
    blobs.forEach((b, i) => {
      const here = seg(t, BLOB_AT(i), BLOB_AT(i) + BLOB_FADE);
      const linked = seg(t, LINK_AT(i), LINK_AT(i) + LINK_DRAW);
      b.style.setProperty('--in', here.toFixed(3));
      b.style.setProperty('--cold', (1 - linked).toFixed(3));
      b.style.setProperty('--warm', linked.toFixed(3));
    });
    links.forEach((l, i) => {
      const drawn = seg(t, LINK_AT(i), LINK_AT(i) + LINK_DRAW);
      l.style.setProperty('--in', drawn.toFixed(3));
      l.style.setProperty('--dash', (DASH * (1 - drawn)).toFixed(2));
    });
    // Min arrives in the hole in the middle before any link is drawn —
    // the connections are his, so he has to be there first
    min?.style.setProperty('--in', seg(t, 0.34, 0.5).toFixed(3));
  }

  let raf = 0;
  paint(0);

  return {
    play() {
      cancelAnimationFrame(raf);
      const start = performance.now();
      raf = requestAnimationFrame(function frame(now) {
        const t = clamp((now - start) / RING_MS);
        paint(t);
        if (t < 1) raf = requestAnimationFrame(frame);
      });
    },
    /* rewound on the way out, so coming back to the slide plays it again */
    reset() { cancelAnimationFrame(raf); paint(0); },
  };
}

/* ---------- 1. the deck ------------------------------------- */

function deck() {
  const paint = palette();
  const figure = ring();

  const bar = document.querySelector('.bar');
  const prev = document.querySelector('[data-nav="prev"]');
  const next = document.querySelector('[data-nav="next"]');
  const count = document.querySelector('.bar__count');
  const dots = [];

  /* the dots are built from the slides, so adding a slide to the markup is
     the only thing anyone has to do to add a slide to the deck */
  const dotBox = document.querySelector('.bar__dots');
  slides.forEach((slide, i) => {
    const label = slide.dataset.title || `Slide ${i + 1}`;
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'bar__dot';
    dot.title = label;
    dot.setAttribute('aria-label', `${i + 1}. ${label}`);
    dot.addEventListener('click', () => go(i));
    dotBox?.appendChild(dot);
    dots.push(dot);
  });

  let current = -1;

  /* Both axes are always written, and the unused one is written to zero:
     turning a phone from portrait to landscape switches the track's
     direction, and the old axis would otherwise keep its offset and park
     the deck between two slides. */
  function go(i, behavior = 'smooth') {
    const n = clamp(i, 0, slides.length - 1);
    deckEl.scrollTo({
      left: vertical() ? 0 : n * deckEl.clientWidth,
      top: vertical() ? n * deckEl.clientHeight : 0,
      behavior: reduced ? 'auto' : behavior,
    });
  }

  /* Everything that happens when a slide becomes the one you're looking at.
     .in runs the material emergence recipe from landing.css; .is-active
     gates the looping figures, so nothing animates off screen. */
  function activate(i) {
    if (i === current) return;
    const before = slides[current];
    if (before) {
      before.classList.remove('in', 'is-active');
      before.inert = true;
    }
    current = i;

    const slide = slides[i];
    slide.classList.add('in', 'is-active');
    slide.inert = false;

    dots.forEach((d, n) => d.setAttribute('aria-current', String(n === i)));
    if (count) count.textContent = `${i + 1}/${slides.length}`;
    if (prev) prev.disabled = i === 0;
    if (next) next.disabled = i === slides.length - 1;
    if (bar) bar.setAttribute('aria-label', `Slide ${i + 1} of ${slides.length}: ${slide.dataset.title || ''}`);

    if (slide.contains(document.querySelector('.scene'))) figure.play();
    else figure.reset();

    // shareable, and reload-safe: /pitchdeck/#3
    const hash = `#${i + 1}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  /* ---- the scroll position drives everything ---- */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const pos = offset();
      paint(pos);
      activate(clamp(Math.round(pos), 0, slides.length - 1));
    });
  };
  deckEl.addEventListener('scroll', onScroll, { passive: true });

  /* ---- the keyboard ---- */
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Enter' && e.target === document.body) {
      // Enter/space on a real control belongs to that control
      const on = e.target instanceof Element ? e.target.closest('a, button') : null;
      if ((k === ' ' || k === 'Enter') && on) return;
      e.preventDefault();
      go(current + 1);
    } else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') {
      e.preventDefault();
      go(current - 1);
    } else if (k === 'Home') { e.preventDefault(); go(0); }
    else if (k === 'End') { e.preventDefault(); go(slides.length - 1); }
  });

  /* ---- the wheel ----
     Only for the sideways track: a trackpad's horizontal deltas already
     scroll it natively, so this just translates a vertical wheel into
     paging, one page per gesture rather than one per notch. It also gets
     out of the way when the slide itself has something to scroll. On the
     vertical track a wheel is already the right gesture — the browser's
     own snap handles it, and this never runs. */
  let cooling = false;
  deckEl.addEventListener('wheel', (e) => {
    if (vertical()) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const slide = slides[current];
    if (slide && slide.scrollHeight > slide.clientHeight + 4) return;
    e.preventDefault();
    if (cooling || Math.abs(e.deltaY) < 6) return;
    cooling = true;
    setTimeout(() => { cooling = false; }, 620);
    go(current + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });

  prev?.addEventListener('click', () => go(current - 1));
  next?.addEventListener('click', () => go(current + 1));

  /* the swipe cue on the cover retires the moment you've understood it */
  const moved = () => document.documentElement.classList.add('has-moved');
  deckEl.addEventListener('scroll', moved, { once: true, passive: true });
  addEventListener('keydown', moved, { once: true });

  /* ---- landing straight on a slide, and staying there ----
     Snap points are laid out in px, so a resize has to re-land on the
     current slide or the deck ends up parked between two of them. This
     covers the axis flip too: rotating a phone into landscape is a resize,
     and go() rewrites both axes. */
  const start = Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1);
  addEventListener('resize', () => go(current, 'auto'));

  // Only the slide you're on is reachable by tab or by a screen reader —
  // eight slides' worth of links in the tab order would scroll the track
  // out from under you. activate() hands this back one slide at a time.
  slides.forEach((s) => { s.inert = true; });

  go(start, 'auto');
  activate(clamp(start, 0, slides.length - 1));
  paint(start);
  onScroll();
}

/* ---------- boot ------------------------------------------- */

minBodies();
buttons();
if (deckEl && slides.length) deck();

// The atmosphere is a bonus, never a dependency — same contract as the
// landing page: if three.js can't be fetched, the deck reads fine without it.
(async () => {
  const canvas = document.getElementById('scene');
  if (!canvas) return;
  if (reduced) { canvas.remove(); return; }
  try {
    const mod = await import('/assets/js/landing-scene.js');
    const scene = await mod.createScene(canvas);
    // A deck is not a scroll: the field simply sits there, gathered and
    // half-lit, being weather behind the slides.
    scene.set({ alpha: 0.75, gather: 0.5, warmth: 0.45 });
  } catch (err) {
    console.warn('[kin] atmosphere unavailable', err);
    canvas.remove();
  }
})();
