/* ============================================================
   Homepage · how it works
   ------------------------------------------------------------
   Three steps, one phone. Whichever step is nearest the reader's
   eyeline is the active one, and the phone shows that step's screen.

   The screens are placeholders for the real UI mockups, and this
   module is deliberately ignorant of what is inside them: it only
   toggles .is-on on the nth [data-screen]. Swapping a placeholder
   for a real mockup needs no change here.

   Driven off scroll position rather than an IntersectionObserver
   band. An observer gets ambiguous the moment two short steps are
   in the band at once, and the steps' heights change with the
   viewport and the font — measuring the distance to a target line
   gives exactly one winner at every scroll position, always.

   The section is fully readable before this runs and if it never
   runs: CSS dims the inactive steps but hides nothing, and the
   first screen is the one CSS shows on its own.
   ============================================================ */

export function howItWorks() {
  const grid = document.querySelector('[data-steps]');
  if (!grid) return;

  const items = [...grid.querySelectorAll('.steps__item')];
  const stage = grid.querySelector('.steps__stage');
  // The screens the active step drives, matched to the steps by position,
  // so a step with no screen simply doesn't get one rather than throwing
  // or knocking the others out of sync.
  const screens = [...grid.querySelectorAll('[data-screen]')];
  if (!items.length) return;

  // Reduced motion gets step 1 and no swapping; the CSS says the same thing,
  // and agreeing with it here keeps a mid-session preference change honest.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  let current = -1;

  const show = (index) => {
    if (index === current) return;
    current = index;
    items.forEach((el, i) => el.classList.toggle('is-on', i === index));
    screens.forEach((el, i) => el.classList.toggle('is-on', i === index));
  };

  /* The eyeline — where on the viewport we ask "which step is here?".
     The phone answers whichever step's TEXT has most recently come into
     view — the line sits low, near the foot of the viewport, and a step
     claims the phone the moment its heading crosses it from below. That
     is the change the reader is actually waiting for: new words arrive,
     the screen beside them is already the right one, and it then holds
     for the whole time those words are on screen.

     Measuring against the middle instead made the screens flick past
     mid-scroll: each step won the phone only as it reached the centre,
     so a screen swapped while the reader was still on the step before
     it. One low line works on both layouts — the narrow stage covers
     the TOP of the viewport, and nothing about "has the next heading
     appeared yet" depends on where the phone is sitting.

     0.72 rather than lower down: the steps snap to centre, so at rest a
     step's heading sits near 0.43vh and the NEXT one near 0.83vh. The
     line has to clear both by a margin, or a step could come to rest
     centred while the phone had already moved on to the one below it. */
  const eyeline = () => innerHeight * 0.72;

  /* Nothing swaps until the phone has PARKED. The stage is sticky, so
     while it is still riding up into place the whole section is still
     arriving — swapping screens then spends the change off to the side
     of the reader's attention, and by the time they're actually looking
     at the phone it has already moved on. Once the stage's top has
     reached its own sticky offset, the section is settled in view and
     the eyeline takes over.

     Read off the computed `top` rather than hard-coded, so the desktop
     (50vh - 310px) and mobile (0) offsets both come out right, and it
     stays true if the CSS changes. Past the section the stage unsticks
     upward, which keeps the test true — the last step stays chosen. */

  const parked = () => {
    if (!stage) return true;
    const offset = parseFloat(getComputedStyle(stage).top) || 0;
    return stage.getBoundingClientRect().top <= offset + 1;
  };

  const pick = () => {
    // The narrow-screen backdrop rides on the same answer: it only has
    // something to hide once the phone is holding still in front of it.
    const isParked = parked();
    if (stage) stage.classList.toggle('is-parked', isParked);
    if (!isParked) return show(0);

    // The LAST step to have crossed the line, so scrolling back up hands
    // the phone back in the same order it took it.
    const line = eyeline();
    let best = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].getBoundingClientRect().top < line) best = i;
    }
    show(best);
  };

  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      pick();
    });
  };

  const start = () => {
    if (reduced.matches) {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      show(0);
      return;
    }
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    pick();
  };

  reduced.addEventListener('change', start);
  start();
}
