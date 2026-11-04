/* The /c/ "old way vs min" section. Everything plays from CSS on reveal;
   this only lets the reader press the tap to watch min's one step again.
   Replay = drop the animations for a frame, then re-add them with no
   start delay. */
export function oldWay() {
  const card = document.querySelector('[data-ow-card]');
  const tap = card?.querySelector('[data-ow-tap]');
  if (!tap) return;
  tap.addEventListener('click', () => {
    card.classList.add('is-replay');
    void card.offsetWidth;            // flush, so the restart takes
    card.classList.remove('is-replay');
    card.classList.add('is-replay-go');
  });
}
