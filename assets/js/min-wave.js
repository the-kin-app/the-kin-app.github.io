/* ============================================================
   min waving, with live eyes
   ------------------------------------------------------------
   Built from Figma min-app (file PmauZKhA4iyowYabC3XOJE):
     2762:2478  "Min · original-material rig · body + vector eyes"
                -> the eyeless body render (min-wave-body.png, 400×360,
                   transparent) and two vector eyes laid over it
     2773:48    "Min · reflection only"
                -> the same body, mirrored at the feet, blurred 4→22,
                   faded out before it reaches the eyes' height

   The body and eyes are separate layers so the eyes can move: they
   blink every 3–7 s, and they look at things. With a mouse they follow
   the cursor; on touch they look around on their own and turn toward
   whatever you press. Keyboard focus draws their attention too.

   Three layers, back to front:
     svg.min-wave__still   the reflection (static, drawn once)
     img.min-wave__body    the eyeless body
     svg.min-wave__eyes    the eyes (the only thing that repaints)
   The reflection's blur is an SVG filter, and it sits in its own SVG so
   animating the eyes never makes the browser re-run that filter.

   Usage:  <span class="min-wave" data-min-wave data-reflect></span>
   Size the host by width; its aspect ratio comes from min-wave.css.
   ============================================================ */

const BODY = '/assets/img/min-character/min-wave-body.png';

/* The body render's own canvas is 400×360; the figure sits inside
   x 41–360, y 30–315. The view crops to that plus a few px of air, so
   the host box is min himself, not the empty canvas around him. Keep in
   sync with aspect-ratio in min-wave.css. */
const VB = { x: 36, y: 24, w: 330, h: 296 };
const VIEWBOX = `${VB.x} ${VB.y} ${VB.w} ${VB.h}`;
const FEET = 314;            // the floor line the reflection mirrors at

/* Eyes, from the Figma vectors: 48×50 ellipses, the right one 4px lower. */
const EYES = [
  { cx: 162, cy: 151 },
  { cx: 247, cy: 155 },
];
const RX = 24, RY = 25;

/* Motion, in body-art pixels (400 wide), so it scales with min. */
const LOOK_X = 7;            // furthest the eyes travel sideways
const LOOK_Y = 5;            // ...and up/down
const REACH = 220;           // screen px; a target this far away gets ~70% of the travel
const BLINK_MIN = 3000, BLINK_MAX = 7000;
const DOUBLE_BLINK = 0.18;   // chance a blink comes as a pair
const PRESS_HOLD = 1600;     // how long a pressed thing holds his attention
const MOUSE_IDLE = 6000;     // mouse still this long -> he starts looking around

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeIn = (t) => t * t;
const easeOut = (t) => 1 - (1 - t) * (1 - t);

const markup = (n, reflect) => `
${reflect ? `<svg class="min-wave__still" viewBox="${VIEWBOX}" overflow="visible" aria-hidden="true">
  <defs>
    <!-- Figma's progressive blur runs 4 → 22 (Figma blur ≈ 2× SVG
         stdDeviation). Two bands: a sharp copy at the feet that fades
         into a soft copy below. The colour matrix greys it slightly,
         the way the Figma export reads. -->
    <filter id="mwSharp${n}" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="2"/><feColorMatrix type="saturate" values=".75"/>
    </filter>
    <filter id="mwSoft${n}" x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur stdDeviation="8"/><feColorMatrix type="saturate" values=".75"/>
    </filter>
    <!-- in the mirrored group's own space: 314 is the feet, smaller y is
         further below them -->
    <linearGradient id="mwBandG${n}" gradientUnits="userSpaceOnUse" x1="0" y1="${FEET}" x2="0" y2="${FEET - 40}">
      <stop offset=".12" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="mwBand${n}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="${FEET}">
      <rect width="400" height="${FEET}" fill="url(#mwBandG${n})"/>
    </mask>
    <!-- the fade, measured off the Figma export: strength by distance
         below the feet (0, 14, 24, 34, 44, 54, 69, 84, 100 px) -->
    <linearGradient id="mwFadeG${n}" gradientUnits="userSpaceOnUse" x1="0" y1="${FEET}" x2="0" y2="${FEET + 100}">
      <stop offset="0" stop-color="#fff"/>
      <stop offset=".14" stop-color="#fff" stop-opacity=".83"/>
      <stop offset=".24" stop-color="#fff" stop-opacity=".65"/>
      <stop offset=".34" stop-color="#fff" stop-opacity=".48"/>
      <stop offset=".44" stop-color="#fff" stop-opacity=".35"/>
      <stop offset=".54" stop-color="#fff" stop-opacity=".26"/>
      <stop offset=".69" stop-color="#fff" stop-opacity=".09"/>
      <stop offset=".84" stop-color="#fff" stop-opacity=".03"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="mwFade${n}" maskUnits="userSpaceOnUse" x="0" y="${FEET}" width="400" height="120">
      <rect y="${FEET}" width="400" height="120" fill="url(#mwFadeG${n})"/>
    </mask>
  </defs>
  <g class="min-wave__reflection" mask="url(#mwFade${n})">
    <g transform="translate(0 ${FEET * 2}) scale(1 -1)">
      <image href="${BODY}" width="400" height="360" filter="url(#mwSoft${n})"/>
      <image href="${BODY}" width="400" height="360" filter="url(#mwSharp${n})" mask="url(#mwBand${n})"/>
    </g>
  </g>
</svg>` : ''}
<img class="min-wave__body" src="${BODY}" alt="" width="400" height="360" decoding="async" draggable="false">
<svg class="min-wave__eyes" viewBox="${VIEWBOX}" overflow="visible" aria-hidden="true">
  <defs>
    <!-- Figma's glow is two white drop shadows (spread 2 / blur 7 at 95%,
         spread 3 / blur 15 at 55%). Drawn as a gradient instead of a
         filter so it stays crisp at any size and costs nothing to move. -->
    <radialGradient id="mwGlow${n}" cx=".5" cy=".5" r=".5">
      <stop offset=".40" stop-color="#fff" stop-opacity=".9"/>
      <stop offset=".48" stop-color="#fff" stop-opacity=".7"/>
      <stop offset=".58" stop-color="#fff" stop-opacity=".4"/>
      <stop offset=".72" stop-color="#fff" stop-opacity=".16"/>
      <stop offset=".86" stop-color="#fff" stop-opacity=".04"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${EYES.map(({ cx, cy }) => `<g class="min-wave__eye">
    <ellipse class="min-wave__glow" cx="${cx}" cy="${cy}" rx="${RX * 2.4}" ry="${RY * 2.4}" fill="url(#mwGlow${n})"/>
    <ellipse class="min-wave__core" cx="${cx}" cy="${cy}" rx="${RX}" ry="${RY}" fill="#fff"/>
  </g>`).join('')}
</svg>`;

let count = 0;

export function minWave(root = document) {
  const hosts = [...root.querySelectorAll('[data-min-wave]')].filter((h) => !h.dataset.minWaveReady);
  if (!hosts.length) return;

  const rigs = hosts.map((host) => {
    host.dataset.minWaveReady = '1';
    host.innerHTML = markup(count++, host.hasAttribute('data-reflect'));
    const eyes = [...host.querySelectorAll('.min-wave__eye')].map((g, i) => ({
      ...EYES[i],
      core: g.querySelector('.min-wave__core'),
      glow: g.querySelector('.min-wave__glow'),
    }));
    return {
      host, eyes, visible: false,
      gaze: { x: 0, y: 0 },        // where the eyes are, -1..1
      target: { x: 0, y: 0 },      // where they're heading
      wide: 0, wideTarget: 0,      // a little widening when something catches his eye
      blinkAt: performance.now() + rand(1200, BLINK_MAX),
      blinkStart: -1, blinkQueued: false,
      nextGlance: 0,
    };
  });

  const reducedQ = matchMedia('(prefers-reduced-motion: reduce)');

  /* ── what he's looking at ─────────────────────────────────── */
  // mode: 'mouse' follows the pointer; 'idle' looks around on its own.
  let mode = matchMedia('(hover: hover) and (pointer: fine)').matches ? 'mouse' : 'idle';
  let pointer = null;                 // last mouse position
  let lastMouse = 0;
  let focus = null;                   // {x, y, until}: a press or focus that holds his attention

  // Unit-ish vector from an eye's centre on screen toward a screen point.
  const aim = (rig, px, py) => {
    const b = rig.host.getBoundingClientRect();
    const cx = b.left + b.width * ((EYES[0].cx + EYES[1].cx) / 2 - VB.x) / VB.w;
    const cy = b.top + b.height * ((EYES[0].cy + EYES[1].cy) / 2 - VB.y) / VB.h;
    const dx = px - cx, dy = py - cy;
    const d = Math.hypot(dx, dy) || 1;
    const m = d / Math.sqrt(d * d + REACH * REACH);
    return { x: (dx / d) * m, y: (dy / d) * m };
  };

  const interactive = 'a, button, input, select, textarea, label, summary, [role="button"], [tabindex]:not([tabindex="-1"])';
  const centreOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

  const attend = (x, y) => {
    focus = { x, y, until: performance.now() + PRESS_HOLD };
    for (const r of rigs) r.wideTarget = 1;
    wake();
  };

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer = { x: e.clientX, y: e.clientY };
    lastMouse = performance.now();
    mode = 'mouse';
  }, { passive: true });

  document.addEventListener('pointerleave', () => { pointer = null; }, { passive: true });

  addEventListener('pointerdown', (e) => {
    const el = e.target instanceof Element ? e.target.closest(interactive) : null;
    const p = el ? centreOf(el) : { x: e.clientX, y: e.clientY };
    if (e.pointerType !== 'mouse') mode = 'idle';
    attend(p.x, p.y);
  }, { passive: true, capture: true });

  // Keyboard users get the same curiosity: he looks at what took focus.
  addEventListener('focusin', (e) => {
    if (!(e.target instanceof Element) || !e.target.matches(':focus-visible')) return;
    const p = centreOf(e.target);
    attend(p.x, p.y);
  });

  // Looking around on his own: mostly small drifts and returns to the
  // middle, sometimes a curious glance at something on the page you
  // could press.
  const glance = (rig, now) => {
    rig.nextGlance = now + rand(1400, 3800);
    const roll = Math.random();
    if (roll < 0.25) { rig.target = { x: 0, y: 0 }; return; }
    if (roll < 0.45) {
      const els = [...document.querySelectorAll(interactive)].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      });
      if (els.length) {
        const p = centreOf(els[(Math.random() * els.length) | 0]);
        rig.target = aim(rig, p.x, p.y);
        return;
      }
    }
    const a = rand(0, Math.PI * 2), m = rand(0.2, 0.6);
    rig.target = { x: Math.cos(a) * m, y: Math.sin(a) * m * 0.7 };
  };

  /* ── blink ───────────────────────────────────────────────── */
  // Down in 80 ms, up in 130: quick to shut, a little slower to open.
  const CLOSE = 80, HOLD = 30, OPEN = 130;
  const lid = (rig, now) => {
    if (rig.blinkStart < 0 && now >= rig.blinkAt) rig.blinkStart = now;
    if (rig.blinkStart < 0) return 1;
    const t = now - rig.blinkStart;
    if (t < CLOSE) return 1 - easeIn(t / CLOSE);
    if (t < CLOSE + HOLD) return 0;
    if (t < CLOSE + HOLD + OPEN) return easeOut((t - CLOSE - HOLD) / OPEN);
    // done: maybe a second one straight after, else the next one 3–7 s
    // after this one began
    const began = rig.blinkStart;
    rig.blinkStart = -1;
    if (!rig.blinkQueued && Math.random() < DOUBLE_BLINK) {
      rig.blinkQueued = true;
      rig.blinkAt = now + 90;
    } else {
      rig.blinkQueued = false;
      rig.blinkAt = began + rand(BLINK_MIN, BLINK_MAX);
    }
    return 1;
  };

  /* ── draw ────────────────────────────────────────────────── */
  const draw = (rig, open) => {
    const gx = rig.gaze.x * LOOK_X, gy = rig.gaze.y * LOOK_Y;
    const wide = 1 + 0.06 * rig.wide;
    const lidY = 0.08 + 0.92 * open;          // never fully flat: a closed eye is a thin line
    rig.eyes.forEach((e, i) => {
      // The eye on the side he's looking toward turns away from us a
      // little on the curved body, so it narrows a touch.
      const side = i === 0 ? -1 : 1;
      const turn = 1 - 0.05 * Math.max(0, side * rig.gaze.x);
      const t = (sx, sy) => `translate(${(e.cx + gx).toFixed(2)} ${(e.cy + gy).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-e.cx} ${-e.cy})`;
      e.core.setAttribute('transform', t(wide * turn, wide * lidY));
      e.glow.setAttribute('transform', t(wide * turn, wide * (0.5 + 0.5 * lidY)));
      e.glow.setAttribute('opacity', (0.25 + 0.75 * open).toFixed(3));
    });
  };

  let running = false, last = 0;
  const frame = (now) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (focus && now > focus.until) { focus = null; for (const r of rigs) r.wideTarget = 0; }
    if (mode === 'mouse' && now - lastMouse > MOUSE_IDLE) mode = 'idle';

    let any = false;
    for (const rig of rigs) {
      if (!rig.visible) continue;
      any = true;
      if (focus) rig.target = aim(rig, focus.x, focus.y);
      else if (mode === 'mouse' && pointer) rig.target = aim(rig, pointer.x, pointer.y);
      else if (now >= rig.nextGlance) glance(rig, now);

      // Eyes jump to a new target rather than drifting: a quick ease
      // that settles, faster for a glance than for following the mouse.
      const k = mode === 'mouse' && !focus ? 9 : 13;
      const f = 1 - Math.exp(-dt * k);
      rig.gaze.x += (clamp(rig.target.x, -1, 1) - rig.gaze.x) * f;
      rig.gaze.y += (clamp(rig.target.y, -1, 1) - rig.gaze.y) * f;
      rig.wide += (rig.wideTarget - rig.wide) * (1 - Math.exp(-dt * 7));
      draw(rig, lid(rig, now));
    }
    if (!any) { running = false; return; }
    requestAnimationFrame(frame);
  };

  function wake() {
    if (running || reducedQ.matches || document.hidden) return;
    if (!rigs.some((r) => r.visible)) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const rig = rigs.find((r) => r.host === en.target);
      if (rig) rig.visible = en.isIntersecting;
    }
    wake();
  });
  rigs.forEach((r) => io.observe(r.host));

  document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; else wake(); });
  reducedQ.addEventListener('change', () => {
    if (reducedQ.matches) { running = false; rigs.forEach((r) => { r.gaze = { x: 0, y: 0 }; r.wide = 0; draw(r, 1); }); }
    else wake();
  });
}
