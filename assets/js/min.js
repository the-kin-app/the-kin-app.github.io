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
      <g transform="translate(${SHELL_DX} ${SHELL_DY})">
        <path class="min__foot" data-side="-1" d="M63.6248 262.8C55.6248 282.8 61.6248 306.8 87.6248 313.8C117.625 321.8 151.625 306.8 163.625 282.8C169.625 268.8 167.625 260.8 157.625 256.8L63.6248 262.8Z" fill="#fff"/>
        <path class="min__foot" data-side="1" d="M288.376 262.8C296.376 282.8 290.376 306.8 264.376 313.8C234.376 321.8 200.376 306.8 188.376 282.8C182.376 268.8 184.376 260.8 194.376 256.8L288.376 262.8Z" fill="#fff"/>
        <g class="min__limb-pivot" data-side="-1"><path d="M70.4817 99.8C54.4817 103.8 34.4817 125.8 24.4817 155.8C17.4817 177.8 14.4817 195.8 19.4817 203.8C26.4817 210.8 41.4817 203.8 51.4817 186.8C62.4817 166.8 71.4817 133.8 70.4817 99.8Z" fill="#fff"/></g>
        <g class="min__limb-pivot" data-side="1"><path d="M281.518 99.8C297.518 103.8 317.518 125.8 327.518 155.8C334.518 177.8 337.518 195.8 332.518 203.8C325.518 210.8 310.518 203.8 300.518 186.8C289.518 166.8 280.518 133.8 281.518 99.8Z" fill="#fff"/></g>
        <path d="M36 196.8C36 91.8 86 25.8 176 25.8C266 25.8 316 91.8 316 196.8C316 241.8 302 279.8 274 297.8C250 312.8 102 312.8 78 297.8C50 279.8 36 241.8 36 196.8Z" fill="#fff"/>
      </g>
    </mask>
    <linearGradient id="gmat${n}" x1="166" y1="0" x2="166" y2="306" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F7F1E8"/><stop offset=".24" stop-color="#F3E6D4"/><stop offset=".52" stop-color="#EBD6B8"/>
      <stop offset=".78" stop-color="#DDC29F"/><stop offset=".93" stop-color="#D2B48F"/><stop offset="1" stop-color="#CDAD88"/>
    </linearGradient>
    <radialGradient id="gsub${n}" gradientUnits="userSpaceOnUse" gradientTransform="translate(166 172) scale(134 106)" cx="0" cy="0" r="1">
      <stop stop-color="#FFE7C0" stop-opacity=".72"/><stop offset=".36" stop-color="#FFD196" stop-opacity=".36"/>
      <stop offset=".72" stop-color="#FFC078" stop-opacity=".12"/><stop offset="1" stop-color="#FFC078" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gcrown${n}" gradientUnits="userSpaceOnUse" gradientTransform="translate(166 40) scale(113 66)" cx="0" cy="0" r="1">
      <stop stop-color="#fff" stop-opacity=".58"/><stop offset=".48" stop-color="#FFF9EE" stop-opacity=".16"/><stop offset="1" stop-color="#FFF9EE" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ghalo${n}" gradientUnits="userSpaceOnUse" gradientTransform="translate(66 66) scale(66)" cx="0" cy="0" r="1">
      <stop stop-color="#FFD9A0" stop-opacity=".95"/><stop offset=".3" stop-color="#FFCE8C" stop-opacity=".55"/>
      <stop offset=".62" stop-color="#FFCE8C" stop-opacity=".2"/><stop offset="1" stop-color="#FFCE8C" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gbloom${n}" gradientUnits="userSpaceOnUse" gradientTransform="translate(52 52) scale(52)" cx="0" cy="0" r="1">
      <stop stop-color="#FFC97A" stop-opacity=".9"/><stop offset=".34" stop-color="#FFC97A" stop-opacity=".42"/><stop offset="1" stop-color="#FFC97A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gspec${n}" gradientUnits="userSpaceOnUse" gradientTransform="translate(66 36) scale(66 36)" cx="0" cy="0" r="1">
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
    <!-- the border pass: ONE continuous stroked path, the boolean union of all
         five shapes, exported from Figma (see assets/img/min-character/outline.svg).
         Was a feMorphology filter; that is what made Min look rasterised. -->
    <path class="min__outline" transform="translate(7 7.8)" d="M 159.00 0.00 C 222.05 0.00 265.46 32.39 285.81 87.88 C 295.59 97.95 304.73 112.63 310.52 130.00 C 317.52 152.00 320.52 170.00 315.52 178.00 C 311.67 181.84 305.42 181.46 298.90 177.53 C 297.93 209.12 289.83 236.82 274.61 255.93 C 273.81 270.12 265.40 283.15 247.38 288.00 C 230.53 292.49 212.41 289.73 197.65 282.19 C 173.07 283.60 144.93 283.60 120.36 282.19 C 105.59 289.73 87.48 292.49 70.63 288.00 C 52.60 283.15 44.19 270.12 43.39 255.93 C 28.17 236.82 20.07 209.12 19.10 177.53 C 12.58 181.46 6.33 181.84 2.48 178.00 C -2.52 170.00 0.48 152.00 7.48 130.00 C 13.27 112.63 22.41 97.95 32.19 87.88 C 52.54 32.39 95.96 0.00 159.00 0.00 Z"
          fill="none" stroke="#fff" stroke-width="2.6" stroke-opacity=".9" stroke-linejoin="round"/>
    <rect class="min__flash" x="-20" y="-20" width="${VB_W + 40}" height="${VB_H + 40}" mask="url(#mshell${n})" fill="#fff"/>
    <g class="min__material" mask="url(#mshell${n})">
      <rect x="-20" y="-20" width="${VB_W + 40}" height="${VB_H + 40}" fill="url(#gmat${n})"/>
      <ellipse cx="166" cy="172" rx="134" ry="106" fill="url(#gsub${n})"/>
      <ellipse cx="166" cy="40" rx="113" ry="66" fill="url(#gcrown${n})"/>
    </g>

    <!-- the specular catchlight on the crown of the dome -->
    <ellipse class="min__spec" cx="134" cy="75" rx="66" ry="28" fill="url(#gspec${n})" transform="rotate(-10 134 75)"/>

    <g class="min__face">
      <g class="min__eye" data-side="-1">
        <circle class="min__halo" cx="111" cy="161.8" r="66" fill="url(#ghalo${n})"/>
        <circle class="min__bloom" cx="111" cy="161.8" r="52" fill="url(#gbloom${n})" style="mix-blend-mode:screen"/>
        <g class="min__lid-clip" clip-path="url(#ceyeL${n})">
          <circle class="min__core" cx="111" cy="161.8" r="26.5" fill="url(#gcore${n})"/>
          <rect class="min__lid min__lid--up" x="68.5" y="71.3" width="85" height="64" fill="#fbe7d2"/>
          <rect class="min__lid min__lid--low" x="68.5" y="188.3" width="85" height="64" fill="#fbe7d2"/>
        </g>
      </g>
      <g class="min__eye" data-side="1">
        <circle class="min__halo" cx="221" cy="161.8" r="66" fill="url(#ghalo${n})"/>
        <circle class="min__bloom" cx="221" cy="161.8" r="52" fill="url(#gbloom${n})" style="mix-blend-mode:screen"/>
        <g class="min__lid-clip" clip-path="url(#ceyeR${n})">
          <circle class="min__core" cx="221" cy="161.8" r="26.5" fill="url(#gcore${n})"/>
          <rect class="min__lid min__lid--up" x="178.5" y="71.3" width="85" height="64" fill="#fbe7d2"/>
          <rect class="min__lid min__lid--low" x="178.5" y="188.3" width="85" height="64" fill="#fbe7d2"/>
        </g>
      </g>
    </g>
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
