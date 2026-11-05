/* The /c/ "effort" questions: the line draws as you scroll and each
   question surfaces when the line reaches it. Scroll back, it undraws.

   One number drives it: how far the block has travelled through the
   viewport, from its top at 85% of the screen to its middle at 45%.
   That progress is split across the sequence q1, line1, q2, … q6 and
   each item gets its own 0 → 1: lines as a dash offset, questions as
   --p (opacity, lift and blur live in CSS).

   With reduced motion, or no JS, everything stays drawn. */
/* min floating in to "min is here to help". Scroll drives it: while the
   heading rises from the bottom of the screen to 40% down, he drifts
   from the top-left corner of the screen to his perch at the end of the
   line, along a gentle arc, turning upright and coming to full size.
   Scroll back and he drifts back out. The perch itself is CSS; this only
   writes the offset from it, so he always lands exactly there. */
export function floatMin() {
  const el = document.querySelector('[data-float-min]');
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const anchor = el.parentElement;               // the heading's text box
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const ease = (t) => t * t * (3 - 2 * t);       // eases out of the corner and into the perch
  let raf = 0;
  function paint() {
    raf = 0;
    const vw = innerWidth, vh = innerHeight;
    const a = anchor.getBoundingClientRect();
    // from the heading just below the fold to 40% down the screen
    const p = clamp((vh * 1.1 - a.top) / (vh * 0.7));
    const e = ease(p);
    // where he rests (his box, untransformed) and where he starts
    const rest = el.offsetWidth;
    const fx = a.right, fy = a.top + a.height / 2;
    const sx = vw * 0.06, sy = vh * 0.08;
    const k = 1 - e;
    // a soft arc: x eases straight in, y sags a little on the way
    const dx = (sx - fx) * k;
    const dy = (sy - fy) * k + Math.sin(e * Math.PI) * rest * 0.35;
    el.style.transform =
      `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${(-18 * k).toFixed(2)}deg) scale(${(0.7 + 0.3 * e).toFixed(3)})`;
    el.style.opacity = clamp(p * 5).toFixed(3);
  }
  const ask = () => { if (!raf) raf = requestAnimationFrame(paint); };
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', ask, { passive: true });
  paint();
}

export function effortPath() {
  const box = document.querySelector('[data-qpath]');
  if (!box || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const qs = [...box.querySelectorAll('[data-q]')];
  const segs = (n) => box.querySelectorAll(`[data-seg="${n}"]`);   // one per layout
  // q1, seg1, q2, seg2 … q6: questions get a shorter slice than lines
  const seq = [];
  qs.forEach((q, i) => {
    seq.push({ kind: 'q', el: q, w: 0.7 });
    if (i < qs.length - 1) seq.push({ kind: 's', els: segs(i + 1), w: 1 });
  });
  const total = seq.reduce((a, s) => a + s.w, 0);

  const clamp = (v) => Math.min(1, Math.max(0, v));
  let raf = 0;
  function paint() {
    raf = 0;
    const r = box.getBoundingClientRect();
    const vh = innerHeight;
    const p = clamp((vh * 0.85 - r.top) / (vh * 0.4 + r.height / 2));
    let at = 0;
    for (const s of seq) {
      const lp = clamp((p * total - at) / s.w);
      at += s.w;
      if (s.kind === 'q') s.el.style.setProperty('--p', lp.toFixed(3));
      else s.els.forEach((el) => { el.style.strokeDashoffset = (1 - lp).toFixed(3); });
    }
  }
  const ask = () => { if (!raf) raf = requestAnimationFrame(paint); };
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', ask, { passive: true });
  paint();
}
