/* ============================================================
   Min — homepage behaviour
   ------------------------------------------------------------
   1. reveals()      — IntersectionObserver adds .in; CSS runs the material
                       emergence recipe from the Figma splash handoff.
   2. minBodies()    — Min's body morphs on an exact 5s loop; his gaze
                       follows you with inertia. He does not blink.
                       Lives in min.js — the pitch deck shows him too.
   3. buttons()      — the submerge press: the object sinks, goes clear,
                       ripples, then surfaces with the accent taking over.
                       Lives in press.js — the waitlist uses it too.
   4. rail()         — the hairline scroll-progress bar.
   5. dock()         — surfaces the floating CTA once the hero is behind you.
   6. dwellScrollCTA() — nudges a reader who lands and doesn't scroll.

   The page has TWO authored environments and a hard cut between them —
   the hero's sunlit room, and the one dusk room every section below it
   shares (see home-sections.css). It no longer lerps a colour ramp from
   a cave out to a shore, so daybreak(), the atmosphere canvas it fed
   (landing-scene.js) and the constellation that needed a dark floor to
   read against are all gone. The three steps live in home-steps.js.
   ============================================================ */

import { buttons } from '/assets/js/press.js';
import { minBodies } from '/assets/js/min.js';

/* ---------- 1. reveals ------------------------------------- */

function reveals() {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '-12% 0px -12% 0px' }
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
}

/* ---------- 5. the dock -------------------------------------
   The waitlist CTA surfaces once the hero is behind you and sinks again when
   you come back up to it. The two thresholds are deliberately apart — one
   shared threshold would let a scroll that settles right on it flutter the
   CTA in and out. */

function dock() {
  const cta = document.querySelector('.dock-cta');
  if (!cta) return;
  const root = document.documentElement;
  const hero = document.querySelector('.hero');

  // Only from here is the CTA allowed to be hidden, so anything that throws
  // earlier leaves a visible, working CTA instead of none at all.
  root.classList.add('dock-armed');

  // The last stretch of the hero is empty space below its CTA, so the dock is
  // allowed to arrive slightly before the section technically ends.
  let surface = 56;
  let sink = 12;
  const measure = () => {
    const h = hero?.offsetHeight ?? 0;
    surface = Math.max(56, h * 0.82);
    sink = Math.max(12, surface - Math.min(160, h * 0.14));
  };

  let up = false;
  const sync = () => {
    if (!up && scrollY > surface) {
      up = true;
      root.classList.add('is-docked');
    } else if (up && scrollY < sink) {
      up = false;
      root.classList.remove('is-docked');
    }
  };

  const remeasure = () => { measure(); sync(); };
  measure();
  addEventListener('resize', remeasure);
  addEventListener('load', remeasure);
  addEventListener('scroll', sync, { passive: true });
  sync();   // reloading mid-page should not require a scroll to get the CTA back

  /* Tapping it goes back UP to the hero's own field rather than off to
     /waitlist. The href is a real fragment, so with JS off the browser
     does the jump on its own; this only adds the smooth travel and the
     "here it is" beat once you arrive — landing on a page at a form with
     no indication of which box to type in is the thing being avoided.

     The focus is deliberately late: focusing a field mid-scroll makes the
     browser jump to it instantly and the smooth scroll is thrown away. */
  const field = document.querySelector('#hero-email');
  if (!field) return;
  let ring;
  cta.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;  // let a new tab be a new tab
    e.preventDefault();
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
    const land = () => {
      // preventScroll: the page is already where it should be, and Safari
      // would otherwise re-scroll to its own idea of the field's position.
      field.focus({ preventScroll: true });
      clearTimeout(ring);
      field.classList.remove('is-called');
      void field.offsetWidth;          // restart the highlight on a repeat tap
      field.classList.add('is-called');
      // Under reduced motion the highlight is a held ring with no animation,
      // so `animationend` never comes to clear it. This is what does.
      ring = setTimeout(() => field.classList.remove('is-called'), 1400);
    };
    if (!smooth) return land();
    // No scrollend in every engine yet, so: whichever comes first.
    let done = false;
    const once = () => { if (done) return; done = true; clearTimeout(t); land(); };
    const t = setTimeout(once, 700);
    addEventListener('scrollend', once, { once: true });
  });
  const clearRing = () => { clearTimeout(ring); field.classList.remove('is-called'); };
  field.addEventListener('animationend', clearRing);
  // Typing or clicking away is the cue landing; it has nothing left to say.
  field.addEventListener('input', clearRing);
  field.addEventListener('blur', clearRing);
}

/* ---------- 6. the dwell scroll cue -------------------------
   A quiet nudge for anyone who lands on the hero and just... sits there. If
   they haven't scrolled a few seconds in, a small "scroll" cue fades in below
   the fold. It steps aside the moment they actually scroll, so it never
   competes with the dock surfacing underneath it. */

function dwellScrollCTA() {
  const cta = document.querySelector('.scroll-cta');
  if (!cta) return;
  const root = document.documentElement;

  root.classList.add('dwell-armed');

  const timer = setTimeout(() => root.classList.add('dwell-in'), 3200);
  addEventListener('scroll', () => clearTimeout(timer), { passive: true, once: true });
}
/* ---------- 4. the rail -------------------------------------
   The hairline at the top of the page, scaled to how far down you are.
   It used to be a side-effect of daybreak's ramp loop; with the ramp gone
   it gets its own listener, which is also the only per-scroll work this
   module now does. */

function rail() {
  const bar = document.querySelector('.rail');
  if (!bar) return;
  let queued = false;
  const draw = () => {
    queued = false;
    const max = document.body.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
  };
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(draw);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  draw();
}

/* ---------- boot ------------------------------------------- */

dock();
dwellScrollCTA();
reveals();
minBodies();
buttons();
rail();
