/* ============================================================
   Kin — the scan-and-join page (/waitlist)
   ------------------------------------------------------------
   Two small machines on one screen:

     1. the banner — three slides that advance on their own, and
        can be swiped or tapped through
     2. the form   — one address, posted to the same Worker
        endpoint as every other signup

   Both are progressive: the markup renders a finished first slide
   and a working <form> with no script at all. This file only adds
   motion and a fetch.
   ============================================================ */
(function () {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    const DWELL = reduced ? 8000 : 5200;

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
    play();
  }

  /* ==========================================================
     2. the form
     ========================================================== */

  const form = document.getElementById('waitlist-form');
  if (!form) return;

  const emailInput = document.getElementById('email');
  const websiteInput = document.getElementById('website');
  const errorEl = document.getElementById('email-error');
  const statusEl = document.getElementById('form-status');
  const button = form.querySelector('button[type="submit"]');
  const label = button.querySelector('.btn__label') || button;

  // Cloudflare Worker endpoint. Override at deploy time by setting
  // window.KIN_API_BASE before this script runs.
  const API_BASE = (window.KIN_API_BASE || 'https://api.hellomin.app').replace(/\/$/, '');
  const SUBMIT_URL = API_BASE + '/waitlist';

  /* Poster attribution — the same contract as waitlist.js, because this
     page is where every printed QR actually lands. Codes on posters
     already hanging point at api.kinapp.social/<location>/<poster> —
     the OLD host, kept alive permanently because printed paper can't
     be reissued. New posters use api.hellomin.app. Either host counts
     the scan and redirects here with ?l=<location>&p=<poster>.

     Read once into memory and held for this page view only — no cookie,
     no localStorage, nothing on the device, so it needs no consent
     banner. The trade-off: navigate away and back without the query
     string and the signup lands unattributed. Every poster loses the
     same share of those, so the comparison still holds. Which is also
     why ?l= and ?p= stay in the address bar: with nothing persisted,
     the URL *is* the attribution.

     Only the shape is checked here. worker/src/index.js holds the
     authoritative allowlists and stores anything it doesn't recognise
     as NULL, so the vocabulary lives in one place rather than two. */
  const SLUG_RE = /^[a-z0-9-]{1,32}$/;
  const params = new URLSearchParams(window.location.search);

  function readSlug(key) {
    const value = params.get(key);
    return value && SLUG_RE.test(value) ? value : null;
  }

  const poster = readSlug('p');
  const posterLocation = readSlug('l');

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  /* The Worker requires a name and the signups table stores it NOT
     NULL, but this page deliberately asks for one thing only — a
     second field is the difference between joining and not, at a QR
     code in a bar. So the name is read off the address: the local
     part, minus any +tag, with separators opened out into spaces.
     `sam.okonkwo+kin@…` becomes "Sam Okonkwo". The address remains
     the identity; this is only what a greeting would use. */
  function nameFromEmail(email) {
    const local = email.split('@')[0].split('+')[0];
    const words = local.replace(/[._\-]+/g, ' ').replace(/\d+/g, ' ').trim();
    if (!words) return 'Friend';
    return words
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .slice(0, 100);
  }

  function fail(message) {
    errorEl.textContent = message;
    emailInput.setAttribute('aria-invalid', 'true');
  }

  function clear() {
    errorEl.textContent = '';
    emailInput.removeAttribute('aria-invalid');
    statusEl.textContent = '';
    statusEl.className = 'status';
  }

  emailInput.addEventListener('input', () => { if (errorEl.textContent) clear(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clear();

    const email = emailInput.value.trim();
    if (!email) { fail('Please enter your email.'); return; }
    if (!isValidEmail(email)) { fail('That address doesn’t look right.'); return; }

    const payload = {
      name: nameFromEmail(email),
      contact_method: 'email',
      email: email,
      phone: null,
      website: websiteInput ? websiteInput.value : '', // honeypot — always empty for real users
      poster: poster,
      poster_location: posterLocation
    };

    const original = label.textContent;
    button.disabled = true;
    label.textContent = 'Joining…';

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

      form.style.display = 'none';
      document.getElementById('done-view').style.display = 'block';
    } catch (err) {
      button.disabled = false;
      label.textContent = original;
      statusEl.textContent = err.message || 'Network error. Please try again.';
      statusEl.className = 'status error';
    }
  });
})();
