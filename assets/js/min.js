/* ============================================================
   Min — the creature
   ------------------------------------------------------------
   Replaces the old procedurally-morphed Min with the exact geometry and
   material from Figma's "MIN · idle breathe" (node 598:356, file
   PmauZKhA4iyowYabC3XOJE) — a dome body with two ear flaps, two foot pads,
   and two hot eyes. Unlike the old Min, THIS one blinks (Figma's own spec
   for this variant), and the body no longer morphs point-by-point — it
   breathes via transform only (translate/scale on the whole rig, the ears
   and feet), which is what Figma's own motion track does too.

   Colours/opacity are kept close to the Figma export (a warm cream-to-tan
   gradient); geometry is copied verbatim from the exported shell path.

   Shared by every page that shows him (landing, deck, business, waitlist),
   so there is one Min, not four that drift apart. Any element with
   [data-min] becomes a Min:

     <div class="min" data-min data-phase="1.9"></div>

   data-phase now offsets into the 4s idle-breathe loop (seconds, wraps).
   ============================================================ */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const LOOP = 4; // seconds — matches the Figma "idle breathe" track exactly

/* The visible content of the exported shell sits inside x:10-342, y:18-324
   of its own 352×632 canvas (the "Mat · base" rect in shell.svg) — the rest
   of that canvas is empty headroom. This viewBox crops to just that, so Min
   fills his box the way the old radial version did. */
const VB_W = 332;
const VB_H = 306;
const SHELL_DX = -10;
const SHELL_DY = -18;

/* Min is authored here rather than in the markup, and stamped into each
   host as real DOM, same reasoning as before: an <svg><use> clone can't be
   reached by per-instance CSS or per-instance gaze, and every copy would
   share one animation phase. `n` keeps gradient/mask/filter ids unique. */
export const minFigure = (n) => `
<svg class="min__rig" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  <defs>
    <!-- mask, not clipPath: clipPath geometry that carries CSS animations
         on its content (the feet/ear pivots need to) rendered as an EMPTY
         clip in testing here, despite valid, measurable path geometry —
         hiding the whole material fill behind it. Confirmed by diffing
         with clip-path removed: the fill painted correctly on its own.
         mask handles the exact same animated content correctly, so this
         reverts that swap. The small-size edge quality complaint this was
         meant to fix turned out to be the old per-shape stroked outline's
         seams (fixed separately below via minOutline), not the mask. -->
    <mask id="mshell${n}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="380" height="620">
      <!-- stroke-width 14 centred = 7px of outward growth, the same amount the
           Figma rig v5 silhouette carries as an OUTSIDE stroke. Round joins are
           what actually soften the limb tips and the foot notches; without them
           the shape reads sharp and cut-out at small sizes. -->
      <g transform="translate(${SHELL_DX} ${SHELL_DY})"
         stroke="#fff" stroke-width="14" stroke-linejoin="round" stroke-linecap="round">
        <g class="min__foot" data-side="-1"><path transform="translate(126.6 281.3) scale(0.86) translate(-112.6 -289.3)" d="M63.6248 262.8C55.6248 282.8 61.6248 306.8 87.6248 313.8C117.625 321.8 151.625 306.8 163.625 282.8C169.625 268.8 167.625 260.8 157.625 256.8L63.6248 262.8Z" fill="#fff"/></g>
        <g class="min__foot" data-side="1"><path transform="translate(225.4 281.3) scale(0.86) translate(-239.4 -289.3)" d="M288.376 262.8C296.376 282.8 290.376 306.8 264.376 313.8C234.376 321.8 200.376 306.8 188.376 282.8C182.376 268.8 184.376 260.8 194.376 256.8L288.376 262.8Z" fill="#fff"/></g>
        <g class="min__limb-pivot" data-side="-1"><path transform="translate(63.8 161.1) scale(0.82) translate(-43.8 -153.1)" d="M70.4817 99.8C54.4817 103.8 34.4817 125.8 24.4817 155.8C17.4817 177.8 14.4817 195.8 19.4817 203.8C26.4817 210.8 41.4817 203.8 51.4817 186.8C62.4817 166.8 71.4817 133.8 70.4817 99.8Z" fill="#fff"/></g>
        <g class="min__limb-pivot" data-side="1"><path transform="translate(288.2 161.1) scale(0.82) translate(-308.2 -153.1)" d="M281.518 99.8C297.518 103.8 317.518 125.8 327.518 155.8C334.518 177.8 337.518 195.8 332.518 203.8C325.518 210.8 310.518 203.8 300.518 186.8C289.518 166.8 280.518 133.8 281.518 99.8Z" fill="#fff"/></g>
        <path class="min__torso" d="M36 196.8C36 91.8 86 25.8 176 25.8C266 25.8 316 91.8 316 196.8C316 241.8 302 279.8 274 297.8C250 312.8 102 312.8 78 297.8C50 279.8 36 241.8 36 196.8Z" fill="#fff"/>
      </g>
      <!-- THE ORB. Sits OUTSIDE the translated/stroked group so it keeps its
           true circle: inside it, the 14px round stroke would swell it and the
           translate would shift it off the eyes. It is a mask contributor, so
           the silhouette during the orb stage is orb ∪ shrunken-torso — one
           continuous alpha shape with no seam, which is the whole reason the
           Figma rig uses a masked union rather than crossfading two shapes. -->
      <circle class="min__orb" cx="166" cy="161.8" r="135" fill="#fff"/>
    </mask>
    <linearGradient id="gmat${n}" x1="166" y1="0" x2="166" y2="306" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F7F1E8"/><stop offset=".24" stop-color="#F3E6D4"/><stop offset=".52" stop-color="#EBD6B8"/>
      <stop offset=".78" stop-color="#DDC29F"/><stop offset=".93" stop-color="#D2B48F"/><stop offset="1" stop-color="#CDAD88"/>
    </linearGradient>
    <!-- CORE DENSITY. Min is translucent, so light bends to the EDGES and the
         CENTRE of the body is the densest, darkest part. This used to be a bright
         warm pool (#FFE7C0) - inverted optics, and the direct cause of the eyes
         vanishing: it lit the exact region the eyes have to read against. -->
    <radialGradient id="gdens${n}" gradientUnits="userSpaceOnUse" gradientTransform="translate(166 168) scale(178 152)" cx="0" cy="0" r="1">
      <stop stop-color="#6B4D2E" stop-opacity=".44"/><stop offset=".34" stop-color="#725434" stop-opacity=".37"/>
      <stop offset=".64" stop-color="#7F613D" stop-opacity=".20"/><stop offset=".85" stop-color="#8A6B4A" stop-opacity=".07"/>
      <stop offset="1" stop-color="#8A6B4A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gcrown${n}" gradientUnits="userSpaceOnUse" gradientTransform="translate(166 40) scale(113 66)" cx="0" cy="0" r="1">
      <stop stop-color="#fff" stop-opacity=".58"/><stop offset=".48" stop-color="#FFF9EE" stop-opacity=".16"/><stop offset="1" stop-color="#FFF9EE" stop-opacity="0"/>
    </radialGradient>
    <!-- ⚠️ THERE IS NO PER-EYE SOCKET, deliberately.
         An earlier version put a dense r62 pool behind each eye. It gave the
         contrast but read as a drop shadow painted in the eye area — a local
         patch, not a property of the material. The darkening now comes ENTIRELY
         from gdens, the body-wide core density above: Min is translucent, light
         bends to his edges, and the middle of his body is simply thick. The eyes
         are bright inclusions sitting in that thickness. If the eyes ever need
         more contrast, deepen gdens — do not reintroduce a local pool. -->
    <radialGradient id="gbloom${n}" gradientUnits="objectBoundingBox" cx=".5" cy=".5" r=".5">
      <stop stop-color="#FFC97A" stop-opacity=".52"/><stop offset=".34" stop-color="#FFC97A" stop-opacity=".20"/><stop offset="1" stop-color="#FFC97A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gspec${n}" gradientUnits="userSpaceOnUse" gradientTransform="translate(134 75) scale(66 28)" cx="0" cy="0" r="1">
      <stop stop-color="#fff" stop-opacity=".74"/><stop offset=".30" stop-color="#fff" stop-opacity=".40"/>
      <stop offset=".62" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <!-- NO SVG FILTERS ANYWHERE. feGaussianBlur / feMorphology / feComposite are
         raster ops: the browser rasterises the filter region at the element's
         RENDERED size, and Min renders at 35px in the hero. That produced hard
         aliased stair-steps on every silhouette edge. Every effect below is a
         gradient or a stroked path instead, so it stays vector at any size. -->
    <radialGradient id="gcore${n}" gradientUnits="objectBoundingBox" cx=".5" cy=".5" r=".5">
      <stop offset=".52" stop-color="#fff"/><stop offset=".74" stop-color="#fff" stop-opacity=".55"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <!-- the orb's rim: brightest where the resin is thinnest, at the edge -->
    <linearGradient id="gborder${n}" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#FFFDF7" stop-opacity=".98"/>
      <stop offset=".34" stop-color="#FFF6E6" stop-opacity=".62"/>
      <stop offset="1" stop-color="#FFE9C8" stop-opacity=".9"/>
    </linearGradient>
    <clipPath id="ceyeL${n}"><circle cx="111" cy="161.8" r="26.5"/></clipPath>
    <clipPath id="ceyeR${n}"><circle cx="221" cy="161.8" r="26.5"/></clipPath>
  </defs>

  <g class="min__body">
    <!-- entrance: border (just the OUTER edge of the whole silhouette,
         not each part's own boundary — see the filter below) → flash →
         real material. The 5 shapes below are painted as one SOLID fill
         (not individually stroked), so their overlaps at the shoulders/
         feet vanish into one continuous alpha shape with no seams — then
         minOutline dilates that shape and subtracts the original,
         leaving only a ring around the true outer boundary. -->
    <!-- THE ORB BORDER — the empty shell Min forms inside, and the exact
         counterpart of the wordmark's outline-only stage. Deliberately NOT
         masked by mshell: a ring clipped by the silhouette renders as a
         crescent, which is the bug this replaced. Same centre and radius as
         .min__orb so the two can never drift apart. -->
    <circle class="min__border" cx="166" cy="161.8" r="135"
            fill="none" stroke="url(#gborder${n})" stroke-width="16"/>
    <g class="min__material" mask="url(#mshell${n})">
      <rect x="-20" y="-20" width="${VB_W + 40}" height="${VB_H + 40}" fill="url(#gmat${n})"/>
      <ellipse cx="166" cy="168" rx="178" ry="152" fill="url(#gdens${n})"/>
      <ellipse cx="166" cy="40" rx="113" ry="66" fill="url(#gcrown${n})"/>
    </g>

    <!-- the specular catchlight on the crown of the dome -->
    <ellipse class="min__spec" cx="134" cy="75" rx="66" ry="28" fill="url(#gspec${n})" transform="rotate(-10 134 75)"/>

    <g class="min__face">
      <g class="min__eye" data-side="-1">
        <circle class="min__bloom" cx="111" cy="161.8" r="52" fill="url(#gbloom${n})" style="mix-blend-mode:screen"/>
        <g class="min__lid-clip" clip-path="url(#ceyeL${n})">
          <circle class="min__core" cx="111" cy="161.8" r="26.5" fill="url(#gcore${n})"/>
          <rect class="min__lid min__lid--up" x="68.5" y="71.3" width="85" height="64" fill="#fbe7d2"/>
          <rect class="min__lid min__lid--low" x="68.5" y="188.3" width="85" height="64" fill="#fbe7d2"/>
        </g>
      </g>
      <g class="min__eye" data-side="1">
        <circle class="min__bloom" cx="221" cy="161.8" r="52" fill="url(#gbloom${n})" style="mix-blend-mode:screen"/>
        <g class="min__lid-clip" clip-path="url(#ceyeR${n})">
          <circle class="min__core" cx="221" cy="161.8" r="26.5" fill="url(#gcore${n})"/>
          <rect class="min__lid min__lid--up" x="178.5" y="71.3" width="85" height="64" fill="#fbe7d2"/>
          <rect class="min__lid min__lid--low" x="178.5" y="188.3" width="85" height="64" fill="#fbe7d2"/>
        </g>
      </g>
    </g>

    <!-- THE FLASH IS THE TOP LAYER. The whole of Min gets flashed - body,
         material AND eyes. It used to sit below .min__material and below
         .min__face, so the body washed out while the eyes stayed unlit and
         the material painted straight over the light. Masked to the shell so
         it never spills outside the silhouette. -->
    <rect class="min__flash" x="-20" y="-20" width="${VB_W + 40}" height="${VB_H + 40}" mask="url(#mshell${n})" fill="#fff"/>
  </g>
</svg>`;

export function minBodies(root = document) {
  const hosts = [...root.querySelectorAll('[data-min]')];
  if (!hosts.length) return;

  hosts.forEach((host, i) => {
    host.innerHTML = minFigure(i);
    const phase = +host.dataset.phase || 0;
    // negative delay scrubs a paused-looking loop straight to "already
    // running" — every animated part shares one phase via inheritance.
    host.style.setProperty('--min-phase', `-${(phase % LOOP).toFixed(2)}s`);
  });

  if (reduced) return; // CSS already holds a still frame under reduced motion

  /* Gaze: the eye cores nudge toward the pointer, with inertia. Cheaper
     than before (no body morph to drive), so a shared rAF loop is fine. */
  const rigs = hosts.map((host) => ({
    host,
    cores: [...host.querySelectorAll('.min__lid-clip')],
    gaze: { tx: 0, ty: 0, x: 0, y: 0 },
  }));

  addEventListener('pointermove', (e) => {
    for (const r of rigs) {
      const b = r.host.getBoundingClientRect();
      if (!b.width) continue;
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      r.gaze.tx = clamp((e.clientX - cx) / (innerWidth / 2), -1, 1);
      r.gaze.ty = clamp((e.clientY - cy) / (innerHeight / 2), -1, 1);
    }
  }, { passive: true });

  function frame() {
    requestAnimationFrame(frame);
    for (const r of rigs) {
      r.gaze.x = lerp(r.gaze.x, r.gaze.tx, 0.045);
      r.gaze.y = lerp(r.gaze.y, r.gaze.ty, 0.045);
      const gx = (r.gaze.x * 5).toFixed(2);
      const gy = (r.gaze.y * 4).toFixed(2);
      for (const c of r.cores) c.setAttribute('transform', `translate(${gx} ${gy})`);
    }
  }
  requestAnimationFrame(frame);
}
