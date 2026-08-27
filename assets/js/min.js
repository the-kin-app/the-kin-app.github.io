/* ============================================================
   Min — the creature
   ------------------------------------------------------------
   Min is a small creature cast in warm opal resin, lit from the inside:
   a tall dome body, a short flappy ear at each shoulder, two foot nubs and
   two hot little eyes. He breathes on an exact 5s loop and his
   gaze follows the cursor with inertia. He does not blink.

   HE IS NOT DRAWN, HE IS GENERATED. The silhouette below is a fixed set of
   anchor points in unit space (x and y both −1…1 around his centre), and
   every frame each point is pushed along its own outward direction by a sum
   of harmonics. That is what lets him breathe continuously instead of
   playing a canned animation — and every harmonic is a whole multiple of
   the loop frequency, which is what makes the 5s cycle seamless rather than
   nearly-seamless.

   WHY ANCHORS AND NOT A RADIUS FUNCTION. The old Min was a pure radial
   blob, so his shape *was* the maths. This one has feet, and feet are not
   a harmonic — they have to be authored. Keeping the points explicit means
   the character is editable by moving numbers, and the morph stays a
   modifier on top rather than the thing that defines him.

   STIFFNESS. Each anchor carries a weight. The dome breathes at full
   amplitude, the feet barely move — a creature whose feet wobbled as much
   as his head would read as a jelly, not as something standing there.

   Shared by every page that shows him (landing, deck, business, waitlist),
   so there is one Min, not four that drift apart. Any element with
   [data-min] becomes a Min:

     <div class="min" data-min data-phase="1.9"></div>
   ============================================================ */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const round1 = (v) => Math.round(v * 10) / 10;

const LOOP = 5;        // seconds — the idle loop, exactly

/* Min's silhouette, clockwise from the top of the dome. Unit space: x and y
   run −1…1 from his centre, so one description scales to every size he is
   used at. The third number is STIFFNESS — 1 breathes fully, 0 holds still.

   Read down the list and you can see him: a dome that widens to full width
   just below the middle, shoulders that fall away, then two foot pads with
   a shallow tuck between them. */
const BODY = [
  [ 0.00, -1.00, 1.00],
  [ 0.26, -0.96, 1.00],
  [ 0.51, -0.84, 0.95],
  [ 0.71, -0.63, 0.88],
  [ 0.84, -0.34, 0.78],
  [ 0.90, -0.02, 0.66],
  [ 0.89,  0.30, 0.55],
  [ 0.81,  0.57, 0.40],
  [ 0.67,  0.76, 0.26],
  [ 0.50,  0.86, 0.14],
  [ 0.36,  0.90, 0.09],
  [ 0.24,  0.92, 0.07],
  [ 0.15,  0.95, 0.06],   // right foot
  [ 0.07,  0.91, 0.06],
  [ 0.00,  0.90, 0.07],   // the tuck between the feet
  [-0.07,  0.91, 0.06],
  [-0.15,  0.95, 0.06],   // left foot
  [-0.24,  0.92, 0.07],
  [-0.36,  0.90, 0.09],
  [-0.50,  0.86, 0.14],
  [-0.67,  0.76, 0.26],
  [-0.81,  0.57, 0.40],
  [-0.89,  0.30, 0.55],
  [-0.90, -0.02, 0.66],
  [-0.84, -0.34, 0.78],
  [-0.71, -0.63, 0.88],
  [-0.51, -0.84, 0.95],
  [-0.26, -0.96, 1.00],
];

/* One ear, as a closed outline in the same unit space — the RIGHT one; the
   left is this mirrored.

   IT IS AN EAR, NOT AN ARM. A short flap at his shoulder, angled down and
   out, tip stopping about level with his eyes — the sort of thing that can
   become a wave, a point or a wing when he needs one, and the rest of the
   time just sits there. Long enough to reach past his side and no longer:
   run it down toward his feet and it stops being an ear.

   Drawn BEHIND the body, so only the part that reaches past his side is
   ever visible — which is why the root points can sit well inside his
   silhouette, and why it reads as a flap lying against him rather than as
   a limb bolted on. */
const EAR = [
  [0.66, -0.50],   // root, top — buried in the body
  [0.95, -0.42],
  [1.10, -0.20],
  [1.09,  0.01],
  [0.96,  0.09],   // tip, stopping about level with his eyes
  [0.86, -0.06],
  [0.70, -0.24],   // root, bottom — also buried
];
/* Where the ear hinges — its root, not its centre. */
const EAR_PIVOT = [0.66, -0.40];

/* Eyes, in the same unit space — and the ONE source for where they are.
   The turnaround sheet puts them high, a little above his middle. Drawn low,
   in the belly, he reads as bottom-heavy and sad; up here the dome above them
   becomes forehead and the light pooling below becomes a body. */
const EYE = { x: 0.28, y: -0.225, r: 0.135 };

/* The transform the figure below is drawn at. `minBodies` lets a host
   override cx/cy/rx/ry for the outline, but the eyes are baked into the
   template markup, so they are placed from these — keep them in step. */
const CANON = { cx: 256, cy: 272, rx: 172, ry: 178 };
const EYE_L = round1(CANON.cx - CANON.rx * EYE.x);
const EYE_R = round1(CANON.cx + CANON.rx * EYE.x);
const EYE_Y = round1(CANON.cy + CANON.ry * EYE.y);
const EYE_R_CORE = round1(CANON.rx * EYE.r);
const EYE_R_BLOOM = round1(CANON.rx * 0.30);

/* ---- geometry ----------------------------------------------------- */

/* Closed Catmull-Rom through a point list, emitted as cubic béziers. */
function through(pts) {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return `${d}Z`;
}

/* Min's body at a moment in the loop. Each anchor is pushed along its own
   direction from centre by the harmonic sum, scaled by its stiffness. */
export function bodyPath(phase, cx, cy, rx, ry) {
  const pts = BODY.map(([ux, uy, stiff], i) => {
    const a = (i / BODY.length) * Math.PI * 2;
    const m =
      0.030 * Math.sin(2 * a + phase) +
      0.020 * Math.sin(3 * a - 2 * phase + 1.7) +
      0.011 * Math.sin(5 * a + 3 * phase);
    const k = 1 + m * stiff;
    return [cx + ux * rx * k, cy + uy * ry * k];
  });
  return through(pts);
}

/* An ear. `side` is +1 (right) or −1 (left).

   IT BENDS, IT DOES NOT SWING. Every point rotates by the sway angle scaled
   by how far it sits from the root, so the tip travels furthest and the flap
   curves along its length. One angle for the whole outline is a paddle on a
   hinge — right for a door, wrong for something soft. It costs one hypot per
   point, which is what "flappy" is worth.

   The sway moves the OUTLINE rather than the node, because a transform would
   carry the hinge along with it. */
export function earPath(phase, cx, cy, rx, ry, side) {
  const [px, py] = [EAR_PIVOT[0] * side, EAR_PIVOT[1]];
  /* trails the body by a beat: a flap follows the thing it hangs off */
  const sway = (0.20 * Math.sin(phase - 0.9) + 0.07 * Math.sin(2 * phase + 0.4)) * side;
  const reach = Math.max(...EAR.map(([ux, uy]) => Math.hypot(ux * side - px, uy - py)));

  const pts = EAR.map(([ux, uy]) => {
    const dx = ux * side - px, dy = uy - py;
    const ang = sway * (Math.hypot(dx, dy) / reach);   // the tip bends most
    const cos = Math.cos(ang), sin = Math.sin(ang);
    return [cx + (px + dx * cos - dy * sin) * rx,
            cy + (py + dx * sin + dy * cos) * ry];
  });
  return through(pts);
}

/* ---- the figure ----------------------------------------------------- */

/* Min is authored here rather than in the markup, and stamped into each host
   as real DOM. An <svg><use> would clone him into a shadow tree, where
   per-instance CSS (the hero's one-time "awareness") and per-instance gaze
   can't reach — and every copy would share one morph phase. `n` keeps the
   gradient and filter ids unique per instance.

   THE MATERIAL, bottom to top: an ambient warm bloom he casts on the world,
   the ears behind him, his body, the light trapped inside it low and
   centred, a rim that brightens toward the edge because that is where the
   light has furthest to travel through him, two speculars, then the eyes.
   No blur passes except the eye bloom — the rim gradient is what reads as
   translucency, and it is free. */
export const minFigure = (n) => `
<svg viewBox="0 0 512 512" aria-hidden="true">
  <defs>
    <linearGradient id="mb${n}" x1="256" y1="80" x2="256" y2="470" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFDF8" stop-opacity=".97"/>
      <stop offset=".46" stop-color="#FFF3E0" stop-opacity=".95"/>
      <stop offset="1" stop-color="#EBD3B0" stop-opacity=".96"/>
    </linearGradient>
    <radialGradient id="mi${n}" gradientUnits="userSpaceOnUse"
      gradientTransform="translate(256 332) scale(214 168)" cx="0" cy="0" r="1">
      <stop stop-color="#FFC97F" stop-opacity=".44"/>
      <stop offset=".50" stop-color="#FFD79A" stop-opacity=".26"/>
      <stop offset="1" stop-color="#FFD79A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="mr${n}" gradientUnits="userSpaceOnUse"
      gradientTransform="translate(256 272) scale(196 192)" cx="0" cy="0" r="1">
      <stop offset=".62" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset=".92" stop-color="#FFFBF2" stop-opacity=".34"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity=".72"/>
    </radialGradient>
    <radialGradient id="ma${n}" gradientUnits="userSpaceOnUse"
      gradientTransform="translate(256 292) scale(280 268)" cx="0" cy="0" r="1">
      <stop stop-color="#FFDDA6" stop-opacity=".34"/>
      <stop offset=".58" stop-color="#FFE7C0" stop-opacity=".13"/>
      <stop offset="1" stop-color="#FFE7C0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="me${n}" x1="256" y1="180" x2="256" y2="420" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFCF5" stop-opacity=".92"/>
      <stop offset="1" stop-color="#F3DEBE" stop-opacity=".88"/>
    </linearGradient>
    <filter id="mf${n}" x="-90%" y="-90%" width="280%" height="280%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
    <filter id="mg${n}" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
  </defs>

  <!-- the light he puts into the room -->
  <ellipse cx="256" cy="292" rx="280" ry="268" fill="url(#ma${n})" filter="url(#mg${n})"/>

  <g class="min__rig">
    <path class="min__ear" data-side="-1" fill="url(#me${n})"/>
    <path class="min__ear" data-side="1"  fill="url(#me${n})"/>

    <path class="min__body" fill="url(#mb${n})"/>
    <path class="min__body" fill="url(#mi${n})"/>
    <path class="min__body" fill="url(#mr${n})"/>

    <!-- two speculars on the dome: where the light source is, in one glance -->
    <ellipse class="min__spec" cx="203" cy="148" rx="20" ry="14" fill="#fff" opacity=".62" transform="rotate(-26 203 148)"/>
    <ellipse class="min__spec" cx="300" cy="140" rx="12" ry="8"  fill="#fff" opacity=".44" transform="rotate(-18 300 140)"/>

    <g class="min__eyes">
      <g class="min__eye">
        <ellipse class="min__glow" cx="${EYE_L}" cy="${EYE_Y}" rx="${EYE_R_BLOOM}" ry="${EYE_R_BLOOM}" fill="#FFE6B4" filter="url(#mf${n})"/>
        <circle cx="${EYE_L}" cy="${EYE_Y}" r="${EYE_R_CORE}" fill="#fff"/>
      </g>
      <g class="min__eye">
        <ellipse class="min__glow" cx="${EYE_R}" cy="${EYE_Y}" rx="${EYE_R_BLOOM}" ry="${EYE_R_BLOOM}" fill="#FFE6B4" filter="url(#mf${n})"/>
        <circle cx="${EYE_R}" cy="${EYE_Y}" r="${EYE_R_CORE}" fill="#fff"/>
      </g>
    </g>
  </g>
</svg>`;

export function minBodies(root = document) {
  const hosts = [...root.querySelectorAll('[data-min]')];
  if (!hosts.length) return;

  hosts.forEach((host, i) => { host.innerHTML = minFigure(i); });

  const rigs = hosts.map((host) => ({
    host,
    rig: host.querySelector('.min__rig'),
    bodies: [...host.querySelectorAll('.min__body')],
    ears: [...host.querySelectorAll('.min__ear')],
    eyes: [...host.querySelectorAll('.min__eye')],
    cx: +host.dataset.cx || 256,
    cy: +host.dataset.cy || 272,
    rx: +host.dataset.rx || 172,
    ry: +host.dataset.ry || 178,
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

  function draw(r, phase) {
    const d = bodyPath(phase, r.cx, r.cy, r.rx, r.ry);
    for (const b of r.bodies) b.setAttribute('d', d);
    for (const e of r.ears) {
      e.setAttribute('d', earPath(phase, r.cx, r.cy, r.rx, r.ry, +e.dataset.side));
    }
  }

  /* Squash and stretch, conserving volume: he is widest when he is shortest.
     Scaling one axis alone would read as the whole figure growing. The rig
     is scaled about his feet (y 450), not his centre — a creature standing
     on the ground settles downward, it does not shrink toward its middle. */
  function settle(r, phase) {
    const s = Math.sin(phase * 2);
    const sy = 1 + s * 0.017;
    const sx = 1 - s * 0.013;
    r.rig.setAttribute('transform',
      `translate(${r.cx} 450) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-r.cx} -450)`);
  }

  if (reduced) {
    // hold a single settled shape
    for (const r of rigs) draw(r, r.offset);
    return;
  }

  const start = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const phase = (((now - start) / 1000) % LOOP) / LOOP * Math.PI * 2;

    for (const r of rigs) {
      draw(r, phase + r.offset);
      settle(r, phase + r.offset);

      // inertia, not tracking: the gaze carries weight and settles
      r.gaze.x = lerp(r.gaze.x, r.gaze.tx, 0.045);
      r.gaze.y = lerp(r.gaze.y, r.gaze.ty, 0.045);
      const gx = (r.gaze.x * r.rx * 0.075).toFixed(2);
      const gy = (r.gaze.y * r.ry * 0.055).toFixed(2);
      for (const e of r.eyes) e.setAttribute('transform', `translate(${gx} ${gy})`);
    }
  }

  requestAnimationFrame(frame);
}
