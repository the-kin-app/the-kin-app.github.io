/* ============================================================
   Min — the scan-and-join page (/waitlist)
   ------------------------------------------------------------
   Two small machines on one screen:

     1. the banner — three slides that advance on their own, and
        can be swiped or tapped through
     2. the form   — one address, posted to the same Worker
        endpoint as every other signup (waitlist-form.js)

   Both are progressive: the markup renders a finished first slide
   and a working <form> with no script at all. This file only adds
   motion and a fetch.
   ============================================================ */
(function () {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* The page opens in the cave; the camera only moves when the content
     does. The old timed lighten is gone — it brightened on a stopwatch
     rather than because anything happened. */
  document.body.dataset.scene = 'dusk';

  /* ==========================================================
     0. the intro
     ----------------------------------------------------------
     The mark forms alone for --intro-hold, then the world comes
     up and the content sits down into it. All of that is CSS
     (see THE INTRO in waitlist-hero.css) and deliberately does
     NOT depend on this file — an earlier version gated page
     visibility on a class removed from here, and when a stale
     copy of this script got served the page shipped with a
     frozen background and dead swiping.

     The only thing left for JS is holding the carousel back, so
     the first slide gets its full read instead of starting to
     count while the page is still arriving. If this fails, the
     banner simply starts early — nothing disappears.
     ========================================================== */

  const INTRO_HOLD = introHold();

  function introHold() {
    if (reduced) return 0;
    const raw = getComputedStyle(document.body).getPropertyValue('--intro-hold').trim();
    const ms = raw.endsWith('ms') ? parseFloat(raw)
             : raw.endsWith('s')  ? parseFloat(raw) * 1000
             : parseFloat(raw);
    return Number.isFinite(ms) ? ms : 3200;
  }

  /* ==========================================================
     1. the banner
     ========================================================== */

  const banner = document.querySelector('[data-hslides]');
  if (banner) initBanner(banner);

  function initBanner(root) {
    const track = root.querySelector('.hslides__track');
    const slides = [...root.querySelectorAll('.hslide')];
    const dots = [...document.querySelectorAll('.hdot')];
    if (slides.length < 2) return;

    // Long enough to read a headline and its line underneath, short
    // enough that somebody standing in a bar sees all three.
    const DWELL = reduced ? 8000 : 13000;

    let i = 0;
    let timer = null;

    function paint() {
      track.style.setProperty('--i', i);
      slides.forEach((s, n) => {
        const live = n === i;
        s.classList.toggle('is-live', live);
        s.setAttribute('aria-hidden', live ? 'false' : 'true');
      });
      dots.forEach((d, n) => {
        d.setAttribute('aria-selected', n === i ? 'true' : 'false');
      });
      /* THE CAMERA. Each slide declares the place it happens in; the body
         carries it so the ground, the dust and the ink can all respond to
         one attribute. Falls back to dusk if a slide forgets to say. */
      const shown = slides[i];
      document.body.dataset.scene = (shown && shown.dataset.scene) || 'dusk';
    }

    function go(n) {
      i = (n + slides.length) % slides.length;
      paint();
    }

    /* The timer is always restarted rather than resumed: after a
       swipe or a tap the new slide deserves a full read, not the
       remainder of the one it interrupted. */
    function play() {
      stop();
      timer = setInterval(() => go(i + 1), DWELL);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    dots.forEach((d, n) => d.addEventListener('click', () => { go(n); play(); }));

    /* A cursor resting on the banner means somebody is reading it. Gated
       on a real hover device: on a phone, `pointerenter` fires on touch
       and the matching `pointerleave` often never does, which would park
       the banner on whichever slide got tapped. */
    if (matchMedia('(hover: hover)').matches) {
      root.addEventListener('pointerenter', stop);
      root.addEventListener('pointerleave', play);
    }

    // Nothing should keep ticking in a tab nobody is looking at.
    document.addEventListener('visibilitychange', () => {
      document.hidden ? stop() : play();
    });

    /* ---- swipe --------------------------------------------
       The track follows the finger through --drag while the
       transition is off, then snaps to whichever slide the
       gesture committed to. Past either end the drag is damped to
       a third, which is what makes a carousel feel like it has
       edges instead of feeling broken. */

    let startX = 0, startY = 0, dx = 0, dragging = false, axis = null;

    root.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      stop();
      dragging = true;
      axis = null;
      dx = 0;
      startX = e.clientX;
      startY = e.clientY;
      track.classList.add('is-dragging');
    });

    root.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const mx = e.clientX - startX;
      const my = e.clientY - startY;

      // decide once, at ~8px of travel, and hold that decision
      if (!axis) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
        if (axis === 'y') { release(false); return; }
        root.setPointerCapture(e.pointerId);
      }

      const atEdge = (mx > 0 && i === 0) || (mx < 0 && i === slides.length - 1);
      dx = atEdge ? mx / 3 : mx;
      track.style.setProperty('--drag', dx + 'px');
    });

    const end = () => { if (dragging) release(true); };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);

    function release(commit) {
      dragging = false;
      track.classList.remove('is-dragging');
      track.style.removeProperty('--drag');

      // a fifth of the track, or 44px, whichever is shorter
      const threshold = Math.min(44, root.clientWidth / 5);
      if (commit && Math.abs(dx) > threshold) go(i + (dx < 0 ? 1 : -1));
      dx = 0;
      play();
    }

    // keyboard, for the dots' sake
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { go(i + 1); play(); }
      if (e.key === 'ArrowLeft')  { go(i - 1); play(); }
    });

    paint();
    // Wait out the intro so slide one gets a full read rather than starting
    // to count while the page is still arriving. Worst case this fires early.
    setTimeout(play, INTRO_HOLD + 900);
  }

  /* The form lives in waitlist-form.js — /waitlist and the homepage both
     post through it, so the Worker contract has exactly one implementation.
     It is wired up from the module block at the foot of the page. */
})();
