/* ============================================================
   min — the coverflow of offer cards  (/c/ hero)
   ------------------------------------------------------------
   Places each card in the row (offer-flow.css reads --o/--d/--t
   and data-pos), steps the front card along on its own, and lets
   the reader take over: swipe or drag, the arrow keys, a tap on a
   side card, or a dot.

   It steps on its own only while someone can see it: on screen,
   tab in front, no pointer or focus resting on it, and never with
   reduced motion on. Once the reader has moved it themselves, it
   waits a while before carrying on, so it doesn't pull a card out
   from under them.

   Accessibility: only the front card is exposed; the others are
   aria-hidden. The region is labelled, the dots are real buttons,
   and the arrow keys work once it has focus.
   ============================================================ */

const HOLD = 3200;        // how long a front card stays, auto
const RESUME = 7000;      // the wait after the reader moved it
const SWIPE = 36;         // px of drag that counts as a swipe

export function offerFlow(root = document) {
  const flow = root.querySelector('[data-offer-flow]');
  if (!flow) return;
  const track = flow.querySelector('.oflow__track');
  const cards = [...flow.querySelectorAll('.oflow__card')];
  const n = cards.length;
  if (!track || n < 2) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let i = 0;

  /* ---- the dots ---- */
  const dots = document.createElement('ol');
  dots.className = 'oflow__dots';
  const dotBtns = cards.map((_, k) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'oflow__dot';
    b.setAttribute('aria-label', `Show offer ${k + 1} of ${n}`);
    b.addEventListener('click', () => { go(k); userMoved(); });
    li.append(b);
    dots.append(li);
    return b;
  });
  flow.append(dots);

  /* ---- placing ---- */
  const place = () => {
    cards.forEach((card, k) => {
      let o = (((k - i) % n) + n) % n;
      if (o > n / 2) o -= n;                       // shortest way round
      const d = Math.min(Math.abs(o), 2);
      card.style.setProperty('--o', String(Math.max(-2, Math.min(2, o))));
      card.style.setProperty('--d', String(d));
      card.style.setProperty('--t', String(Math.sign(o)));
      card.dataset.pos = o === 0 ? 'center' : d === 1 ? 'side' : 'off';
      card.setAttribute('aria-hidden', o === 0 ? 'false' : 'true');
    });
    dotBtns.forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
  };
  const go = (k) => { i = ((k % n) + n) % n; place(); };

  /* ---- sizing: the row is as tall as its tallest card ---- */
  const measure = () => {
    const h = Math.max(...cards.map((c) => c.offsetHeight));
    if (h) flow.style.setProperty('--card-h', h + 'px');
  };

  flow.classList.add('is-live');
  place();
  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 150);
  });

  /* ---- stepping on its own ---- */
  let timer = 0;
  let visible = false;
  let resting = false;      // pointer or focus on it
  let heldUntil = 0;        // the reader moved it; leave it until then

  const canRun = () => visible && !resting && !document.hidden && !reduced.matches;
  const schedule = () => {
    clearTimeout(timer);
    if (!canRun()) return;
    const wait = Math.max(HOLD, heldUntil - Date.now());
    timer = setTimeout(() => { go(i + 1); schedule(); }, wait);
  };
  const userMoved = () => { heldUntil = Date.now() + RESUME; schedule(); };

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; schedule(); },
      { threshold: 0.35 }).observe(flow);
  } else {
    visible = true;
  }
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener?.('change', schedule);

  flow.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { resting = true; schedule(); } });
  flow.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { resting = false; schedule(); } });
  flow.addEventListener('focusin', () => { resting = true; schedule(); });
  flow.addEventListener('focusout', () => { resting = false; schedule(); });

  /* ---- the reader's turn: swipe, tap, keys ---- */
  let startX = null;
  let dragged = false;
  flow.addEventListener('pointerdown', (e) => { startX = e.clientX; dragged = false; });
  flow.addEventListener('pointermove', (e) => {
    if (startX !== null && Math.abs(e.clientX - startX) > 8) dragged = true;
  });
  flow.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) >= SWIPE) { go(i + (dx < 0 ? 1 : -1)); userMoved(); }
  });
  flow.addEventListener('pointercancel', () => { startX = null; });

  cards.forEach((card, k) => {
    card.addEventListener('click', () => {
      if (dragged || k === i) return;
      go(k);
      userMoved();
    });
  });

  flow.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { go(i + 1); userMoved(); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { go(i - 1); userMoved(); e.preventDefault(); }
  });

  schedule();
}
