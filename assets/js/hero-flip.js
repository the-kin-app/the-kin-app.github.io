/* ============================================================
   Min — the hero's flipping word  (homepage variant B)
   ------------------------------------------------------------
   One sentence whose last word keeps changing:

       spontaneous IRL meetings right around the corner.
       say hello to  ▸ your neighbour ▸ a campus crush ▸ …

   The point of the variant is that the reader recognises
   themselves in one of the words. So the words are relationships
   a person already half-has — not personas.

   Motion is the page's own material emergence, not a carousel
   slide: the old word lifts, blurs and goes; the new one rises
   into focus on --ease-emergence, exactly like `.rise`. The
   container's width travels with it so the sentence breathes
   instead of snapping.

   Accessibility: the animated word is aria-hidden and the full
   list sits next to it in a .visually-hidden span, so a screen
   reader gets the whole idea once, in order, and never a live
   region rewriting itself every two seconds.
   ============================================================ */

const WORDS = [
  'your neighbour',
  'a campus crush',
  'that familiar face',
  'your barista',
  'a future flatmate',
  'a running partner',
  'a friend of a friend'
];

/* Beats. OUT and IN are the transition durations authored in
   home-hero-flip.css — kept here as numbers because JS drives the
   handoff between them; change one, change both. HOLD is how long a
   settled word is left alone to actually be read. */
const OUT = 240;
const IN = 550;
const HOLD = 1900;

/* The hero holds its whole cascade until the wordmark has formed
   (--rise-hold: 2200ms in landing.css) and this line is slot 3, so it
   finishes arriving around 3.3s. Flipping before that would animate a word
   nobody can see yet — and the first thing the reader ever sees would be
   the second word, not the first. */
const FIRST = 3300 + 1500;

export function heroFlip(root = document) {
  const el = root.querySelector('[data-flipwords]');
  if (!el) return;

  const word = el.querySelector('.flipwords__word');
  const ruler = el.querySelector('.flipwords__ruler');
  if (!word || !ruler) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Widths are measured once per layout, not per tick: measuring inside
     the animation frame would read a box mid-transition. The ruler is a
     clone of the word's own type, so what it reports is what will render. */
  let widths = [];
  const measure = () => {
    widths = WORDS.map((w) => {
      ruler.textContent = w;
      return ruler.getBoundingClientRect().width;
    });
    ruler.textContent = '';
    applyWidth(i);
  };
  const applyWidth = (n) => {
    if (widths[n]) el.style.width = widths[n].toFixed(2) + 'px';
  };

  let i = 0;
  word.textContent = WORDS[0];

  measure();
  // Nunito arrives after first paint; a width measured in the fallback face
  // is wrong by a few percent and the first flip would visibly correct it.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 150);
  });

  /* ---- the loop ------------------------------------------------
     Paused whenever it isn't being watched: off-screen, or the tab in
     the background. A word flipping into an empty room is only battery. */
  let timer = 0;
  let running = false;
  let primed = false;

  const step = () => {
    word.classList.add('is-out');

    timer = setTimeout(() => {
      i = (i + 1) % WORDS.length;
      word.textContent = WORDS[i];
      applyWidth(i);

      // Park the incoming word at its start pose, flush it, then release:
      // without the reflow the browser coalesces both class changes and
      // the word simply appears at rest.
      word.classList.remove('is-out');
      word.classList.add('is-in');
      void word.offsetWidth;
      word.classList.remove('is-in');

      timer = setTimeout(step, IN + HOLD);
    }, reduced.matches ? 0 : OUT);
  };

  const start = () => {
    if (running) return;
    running = true;
    const wait = primed ? HOLD : FIRST;
    primed = true;
    timer = setTimeout(step, reduced.matches ? wait + 1200 : wait);
  };
  const stop = () => {
    running = false;
    clearTimeout(timer);
    // Stopping mid-flip would otherwise leave the word parked faded-out.
    word.classList.remove('is-out', 'is-in');
  };

  const io = new IntersectionObserver(
    ([entry]) => { entry.isIntersecting && !document.hidden ? start() : stop(); },
    { threshold: 0 }
  );
  io.observe(el);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (el.getBoundingClientRect().bottom > 0) start();
  });
}
