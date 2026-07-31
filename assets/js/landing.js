/* ============================================================
   Kin — landing page behaviour
   ------------------------------------------------------------
   1. daybreak()     — lerps --bg / --ink along a colour ramp as you scroll
                       and hands alpha/gather/warmth to the atmosphere.
   2. reveals()      — IntersectionObserver adds .in; CSS runs the material
                       emergence recipe from the Figma splash handoff.
   3. minBodies()    — Min's body morphs on an exact 5s loop; his gaze
                       follows you with inertia. He does not blink.
   4. buttons()      — the submerge press: the object sinks, goes clear,
                       ripples, then surfaces with the accent taking over.
   5. conversation() — types Min's lines into the phone mock.
   ============================================================ */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- 1. daybreak ------------------------------------- */

const CREAM = [248, 242, 234];
const GRAPHITE = [33, 33, 45];

function sampleRamp(ramp, p) {
  for (let i = 0; i < ramp.length - 1; i++) {
    const [pa, ca] = ramp[i];
    const [pb, cb] = ramp[i + 1];
    if (p <= pb) {
      const t = clamp((p - pa) / (pb - pa || 1));
      const s = t * t * (3 - 2 * t);   // smoothstep — no visible seams
      return [
        Math.round(lerp(ca[0], cb[0], s)),
        Math.round(lerp(ca[1], cb[1], s)),
        Math.round(lerp(ca[2], cb[2], s)),
      ];
    }
  }
  return ramp[ramp.length - 1][1];
}

/* piecewise-linear helper for the atmosphere's scalar channels */
function track(stops, p) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [pa, va] = stops[i];
    const [pb, vb] = stops[i + 1];
    if (p <= pb) return lerp(va, vb, clamp((p - pa) / (pb - pa || 1)));
  }
  return stops[stops.length - 1][1];
}

/* WCAG relative luminance, so the ink can pick itself */
function luminance([r, g, b]) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const L_CREAM = luminance(CREAM);
const L_GRAPHITE = luminance(GRAPHITE);

/* The background lerps continuously; the ink does not. It picks whichever of
   the two inks currently has more contrast against the background and is
   written only when that choice flips — the registered `transition: --ink`
   then crossfades it, and everything derived from it by color-mix follows.

   This is why the transition sections can be short. Lerping the ink meant
   passing slowly through a mid-grey that had poor contrast against a
   mid-toned background, which had to be hidden in a full empty viewport.
   Choosing by contrast means the ink is always the better of the two, and
   the one unavoidable moment where they trade places lasts 240ms. */
function inkFor(bg) {
  const l = luminance(bg);
  return contrast(l, L_CREAM) >= contrast(l, L_GRAPHITE) ? CREAM : GRAPHITE;
}

/* The environments are the Figma onboarding BG gradients: dusk
   #1e1b2e → #3a2e44, warm #f8e4d2 → #e9ae9e. Dark here is a warm plum
   dusk, never a black void — same material language, different light.

   Keyframes are derived from real section offsets, not hardcoded fractions,
   so editing copy can't drift the sunrise into the middle of a paragraph. */
function buildRamps() {
  const vh = innerHeight;
  const max = Math.max(1, document.body.scrollHeight - vh);
  const pp = (px) => clamp(px / max, 0, 0.995);
  const top = (sel) => document.querySelector(sel)?.offsetTop ?? 0;

  const problem = pp(top('#problem'));
  const dawnPx = top('#dawn');
  const closerPx = top('#closer');

  return {
    bg: [
      [0, [30, 27, 46]],                           // #1e1b2e — dusk
      [problem, [38, 32, 56]],
      [pp(dawnPx - vh * 0.35), [58, 46, 68]],      // #3a2e44 — the plum floor
      [pp(dawnPx + vh * 0.30), [214, 176, 168]],   // first light
      [pp(dawnPx + vh * 0.60), [248, 228, 210]],   // #f8e4d2 — apricot light
      [pp(closerPx - vh * 0.10), [246, 236, 226]],
      [pp(closerPx + vh * 0.30), [58, 46, 68]],    // dusk again
      [1, [30, 27, 46]],
    ],
    /* the field diffuses away in the daylight and returns at dusk */
    alpha: [
      [0, 1], [problem + 0.04, 0.95],
      [pp(dawnPx + vh * 0.62), 0], [pp(closerPx + vh * 0.05), 0],
      [pp(closerPx + vh * 0.45), 1], [1, 1],
    ],
    /* how strongly people pull toward the people near them */
    gather: [
      [0, 0.12], [problem, 0.05],
      [pp(dawnPx - vh * 0.3), 0.3], [pp(dawnPx + vh * 0.4), 0.6],
      [pp(closerPx), 0.85], [1, 1],
    ],
    warmth: [
      [0, 0], [problem, 0.05],
      [pp(dawnPx + vh * 0.10), 0.7], [pp(dawnPx + vh * 0.45), 1], [1, 1],
    ],
  };
}

function daybreak(scene) {
  const root = document.documentElement;
  const rail = document.querySelector('.rail');
  let ramps = buildRamps();
  let last = -1;
  let lastInk = null;

  const rebuild = () => { ramps = buildRamps(); last = -1; };
  addEventListener('resize', rebuild);
  addEventListener('load', rebuild);

  function frame() {
    requestAnimationFrame(frame);
    const max = document.body.scrollHeight - innerHeight;
    const p = clamp(max > 0 ? scrollY / max : 0);
    if (Math.abs(p - last) < 0.0004) return;
    last = p;

    const bg = sampleRamp(ramps.bg, p);
    root.style.setProperty('--bg', `rgb(${bg.join(' ')})`);

    const ink = inkFor(bg);
    if (ink !== lastInk) {
      lastInk = ink;
      root.style.setProperty('--ink', `rgb(${ink.join(' ')})`);
    }
    root.style.setProperty('--p', p.toFixed(4));
    if (rail) rail.style.transform = `scaleX(${p})`;

    scene?.set({
      alpha: track(ramps.alpha, p),
      gather: track(ramps.gather, p),
      warmth: track(ramps.warmth, p),
    });
  }
  frame();
}

/* ---------- 2. reveals ------------------------------------- */

function reveals() {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '-12% 0px -12% 0px' }
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
}

/* ---------- 3. Min ----------------------------------------- */

const LOOP = 5;        // seconds — the idle loop, exactly
const RINGS = 18;      // control points around the silhouette

/* Min is authored here rather than in the markup, and stamped into each host
   as real DOM. An <svg><use> would clone him into a shadow tree, where
   per-instance CSS (the hero's one-time "awareness") and per-instance gaze
   can't reach — and every copy would share one morph phase. `n` keeps the
   gradient and filter ids unique per instance. */
const minFigure = (n) => `
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
function pebblePath(phase, cx, cy, rx, ry) {
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

function minBodies() {
  const hosts = [...document.querySelectorAll('[data-min]')];
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

/* ---------- 4. the submerge press --------------------------
   Press: the object sinks and goes clear — glass under water, only text
   and a thin edge left. A ripple spreads from the contact point. Release:
   it surfaces, and the accent takes over to say it's active. */

function buttons() {
  for (const btn of document.querySelectorAll('.btn')) {
    // the interactive sunlight↔magenta fill tracks the cursor
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      btn.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });

    btn.addEventListener('pointerdown', (e) => {
      const r = btn.getBoundingClientRect();
      btn.classList.add('is-submerged');
      btn.classList.remove('is-active');

      if (reduced) return;
      const ripple = document.createElement('span');
      ripple.className = 'btn__ripple';
      ripple.style.left = `${e.clientX - r.left}px`;
      ripple.style.top = `${e.clientY - r.top}px`;
      // reach the far corner of the button
      ripple.style.setProperty('--reach', `${Math.hypot(r.width, r.height) * 1.1}px`);
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });

    const surface = () => {
      if (!btn.classList.contains('is-submerged')) return;
      btn.classList.remove('is-submerged');
      // emerging: the accent floods in and settles
      btn.classList.add('is-active');
    };
    btn.addEventListener('pointerup', surface);
    btn.addEventListener('pointerleave', () => {
      btn.classList.remove('is-submerged', 'is-active');
    });
    btn.addEventListener('blur', () => btn.classList.remove('is-active'));
  }
}

/* ---------- 5. the conversation ---------------------------- */

const SCRIPT = [
  { me: 'kind of a dead evening' },
  { min: "There's a photo walk leaving Kallio in 20 minutes. Four people, one of them shoots film too." },
  { me: 'who else is going?' },
  { min: 'Someone you almost met at the climbing gym in May. Second degree — you share two friends.' },
  { min: 'Want me to introduce you? I only need a yes.' },
];

function conversation() {
  const screen = document.querySelector('.phone__screen');
  if (!screen) return;
  const pill = screen.querySelector('.phone__pill');

  function bubble(kind) {
    const el = document.createElement('div');
    el.className = `bubble bubble--${kind === 'me' ? 'me' : 'min'}`;
    screen.insertBefore(el, pill);
    // keep the transcript short so it never overflows the screen
    const bubbles = screen.querySelectorAll('.bubble');
    if (bubbles.length > 4) bubbles[0].remove();
    return el;
  }

  function type(el, text) {
    return new Promise((resolve) => {
      if (reduced) { el.textContent = text; return resolve(); }
      let i = 0;
      el.innerHTML = '<span class="caret"></span>';
      const caret = el.firstChild;
      const step = () => {
        i += 1;
        caret.before(document.createTextNode(text[i - 1]));
        if (i < text.length) setTimeout(step, 16 + Math.random() * 34);
        else { caret.remove(); resolve(); }
      };
      setTimeout(step, 120);
    });
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  (async function run() {
    for (;;) {
      for (const line of SCRIPT) {
        const kind = line.me ? 'me' : 'min';
        const text = line.me || line.min;
        if (kind === 'min') await wait(500);
        await type(bubble(kind), text);
        await wait(kind === 'me' ? 700 : 2100);
      }
      await wait(1600);
      screen.querySelectorAll('.bubble').forEach((b) => b.remove());
      await wait(600);
    }
  })();
}

/* ---------- boot ------------------------------------------- */

reveals();
minBodies();
buttons();
conversation();

// The atmosphere is a bonus, never a dependency: if three.js can't be
// fetched, the colour ramp still runs and the page reads fine.
(async () => {
  let scene = null;
  const canvas = document.getElementById('scene');
  if (canvas && !reduced) {
    try {
      const mod = await import('/assets/js/landing-scene.js');
      scene = await mod.createScene(canvas);
    } catch (err) {
      console.warn('[kin] atmosphere unavailable', err);
      canvas.remove();
    }
  } else if (canvas) {
    canvas.remove();
  }
  daybreak(scene);
})();
