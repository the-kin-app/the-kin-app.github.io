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
