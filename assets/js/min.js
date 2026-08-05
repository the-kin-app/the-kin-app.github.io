/* ============================================================
   Kin — Min
   ------------------------------------------------------------
   Min's body morphs on an exact 5s loop and his gaze follows the cursor
   with inertia. He does not blink.

   Shared by every page that shows him (the landing page and the pitch
   deck both call minBodies()), so there is one Min, not two that drift
   apart. Any element with [data-min] becomes a Min:

     <div class="min" data-min data-phase="1.9"></div>
   ============================================================ */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const LOOP = 5;        // seconds — the idle loop, exactly
const RINGS = 18;      // control points around the silhouette

/* Min is authored here rather than in the markup, and stamped into each host
   as real DOM. An <svg><use> would clone him into a shadow tree, where
   per-instance CSS (the hero's one-time "awareness") and per-instance gaze
   can't reach — and every copy would share one morph phase. `n` keeps the
   gradient and filter ids unique per instance. */
export const minFigure = (n) => `
<svg viewBox="0 0 512 512" aria-hidden="true">
  <defs>
    <linearGradient id="mr${n}" x1="256" y1="100" x2="256" y2="416" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFDFE" stop-opacity=".97"/>
      <stop offset=".45" stop-color="#EDE3EF" stop-opacity=".93"/>
      <stop offset="1" stop-color="#C4B6CE" stop-opacity=".95"/>
    </linearGradient>
    <radialGradient id="md${n}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
      gradientTransform="translate(256 300) scale(170 130)">
      <stop stop-color="#5C4165" stop-opacity="0"/>
      <stop offset=".62" stop-color="#5C4165" stop-opacity=".07"/>
      <stop offset="1" stop-color="#5C4165" stop-opacity=".26"/>
    </radialGradient>
    <radialGradient id="ms${n}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
      gradientTransform="translate(196 176) scale(150 128)">
      <stop stop-color="#fff" stop-opacity=".85"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <filter id="mf${n}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="9"/>
    </filter>
  </defs>
  <path class="min__body" fill="url(#mr${n})"/>
  <path class="min__body" fill="url(#md${n})"/>
  <path class="min__body" fill="url(#ms${n})" opacity=".5"/>
  <g class="min__eyes">
    <g class="min__eye">
      <ellipse class="min__glow" cx="202.8" cy="271.4" rx="30" ry="33" fill="#fff" filter="url(#mf${n})"/>
      <ellipse cx="202.8" cy="271.4" rx="20" ry="23" fill="#fff"/>
    </g>
    <g class="min__eye">
      <ellipse class="min__glow" cx="309.2" cy="271.4" rx="30" ry="33" fill="#fff" filter="url(#mf${n})"/>
      <ellipse cx="309.2" cy="271.4" rx="20" ry="23" fill="#fff"/>
    </g>
  </g>
</svg>`;

/* The pebble is generated rather than drawn, so it can morph continuously.
   Every harmonic uses a whole multiple of the loop frequency, which is what
   makes the 5s cycle seamless instead of nearly-seamless. */
export function pebblePath(phase, cx, cy, rx, ry) {
  const pts = [];
  for (let i = 0; i < RINGS; i++) {
    const a = (i / RINGS) * Math.PI * 2;
    const sin = Math.sin(a);
    const cos = Math.cos(a);

    // base silhouette: a wide dome, tucked slightly at the bottom
    const taper = 1 - 0.085 * sin;

    // slow surface tension — two harmonics drifting against each other
    const m =
      1 +
      0.022 * Math.sin(2 * a + phase) +
      0.016 * Math.sin(3 * a - 2 * phase + 1.7) +
      0.009 * Math.sin(5 * a + 3 * phase);

    pts.push([cx + cos * rx * taper * m, cy + sin * ry * m]);
  }

  // closed Catmull-Rom through the points, emitted as cubic béziers
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < RINGS; i++) {
    const p0 = pts[(i - 1 + RINGS) % RINGS];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % RINGS];
    const p3 = pts[(i + 2) % RINGS];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return `${d}Z`;
}

export function minBodies(root = document) {
  const hosts = [...root.querySelectorAll('[data-min]')];
  if (!hosts.length) return;

  hosts.forEach((host, i) => { host.innerHTML = minFigure(i); });

  const rigs = hosts.map((host) => ({
    host,
    bodies: [...host.querySelectorAll('.min__body')],
    eyes: [...host.querySelectorAll('.min__eye')],
    cx: +host.dataset.cx || 256,
    cy: +host.dataset.cy || 258,
    rx: +host.dataset.rx || 164,
    ry: +host.dataset.ry || 154,
    // a different starting phase per Min, so two on screen aren't in lockstep
    offset: +host.dataset.phase || 0,
    gaze: { tx: 0, ty: 0, x: 0, y: 0 },
  }));

  addEventListener('pointermove', (e) => {
    for (const r of rigs) {
      const b = r.host.getBoundingClientRect();
      if (!b.width) continue;
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      // clamp the gaze so the eyes never leave the face
      r.gaze.tx = clamp((e.clientX - cx) / (innerWidth / 2), -1, 1);
      r.gaze.ty = clamp((e.clientY - cy) / (innerHeight / 2), -1, 1);
    }
  }, { passive: true });

  const start = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const phase = (((now - start) / 1000) % LOOP) / LOOP * Math.PI * 2;

    for (const r of rigs) {
      const d = pebblePath(phase + r.offset, r.cx, r.cy, r.rx, r.ry);
      for (const b of r.bodies) b.setAttribute('d', d);

      // inertia, not tracking: the gaze carries weight and settles
      r.gaze.x = lerp(r.gaze.x, r.gaze.tx, 0.045);
      r.gaze.y = lerp(r.gaze.y, r.gaze.ty, 0.045);
      const gx = (r.gaze.x * r.rx * 0.075).toFixed(2);
      const gy = (r.gaze.y * r.ry * 0.055).toFixed(2);
      for (const e of r.eyes) e.setAttribute('transform', `translate(${gx} ${gy})`);
    }
  }

  if (reduced) {
    // hold a single settled shape
    for (const r of rigs) {
      const d = pebblePath(r.offset, r.cx, r.cy, r.rx, r.ry);
      for (const b of r.bodies) b.setAttribute('d', d);
    }
    return;
  }
  requestAnimationFrame(frame);
}
