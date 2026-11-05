/* The offer cards' live timer: "starts in mm:ss", counting down.

   Each card carries its own start, in seconds, on [data-countdown]; the
   markup already shows that value, so with JS off the card still reads
   right, just frozen. One shared 1s tick updates them all. When a timer
   reaches zero it starts over, so the demo never runs out on a page
   someone leaves open. Every timer counts from the same moment, so two
   copies of one card stay in step. */
export function offerCountdowns() {
  const timers = [...document.querySelectorAll('[data-countdown]')].map((el) => ({
    clock: el.querySelector('.acard__clock'),
    total: Math.max(1, parseInt(el.dataset.countdown, 10) || 0),
  })).filter((t) => t.clock);
  if (!timers.length) return;

  const t0 = Date.now();
  const pad = (n) => String(n).padStart(2, '0');
  function tick() {
    const gone = Math.floor((Date.now() - t0) / 1000);
    for (const t of timers) {
      const left = t.total - (gone % t.total);
      t.clock.textContent = `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
    }
  }
  tick();
  setInterval(tick, 1000);
}
