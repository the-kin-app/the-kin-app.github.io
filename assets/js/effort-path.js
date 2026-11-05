/* The /c/ "effort" questions: the line draws as you scroll and each
   question surfaces when the line reaches it. Scroll back, it undraws.

   One number drives it: how far the block has travelled through the
   viewport, from its top at 85% of the screen to its middle at 45%.
   That progress is split across the sequence q1, line1, q2, … q6 and
   each item gets its own 0 → 1: lines as a dash offset, questions as
   --p (opacity, lift and blur live in CSS).

   With reduced motion, or no JS, everything stays drawn. */
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
