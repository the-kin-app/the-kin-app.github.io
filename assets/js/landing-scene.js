/* ============================================================
   Min — landing atmosphere
   ------------------------------------------------------------
   A field of people in fog, seen through a lens, with thin threads of
   light running between the ones who are close: the map, and the
   connection, without a map or a graph being drawn.

   Built to the creative direction:
     · translucency · fog · light · tiny objects · focal blur · vague
     · natural, physical, bathed in light — not tech, not digital
     · optics over effects: real depth of field, normal blending,
       no additive neon bloom, no grid, no HUD
     · surface tension: people drift, gather, settle. Never snap.

   Exposes a tiny surface so landing.js owns all scroll math:

     const scene = await createScene(canvas)
     scene.set({ alpha, gather, warmth })
   ============================================================ */

import * as THREE from 'three';

/* ---- tunables ---------------------------------------------- */

const COUNT_DESKTOP = 160;
const COUNT_MOBILE = 80;
const FIELD = { x: 48, y: 27, z: 46 };
const REACH = 12;          // world units within which two people notice each other
const MAX_THREADS = 420;
const FOCUS_Z = 8;         // the focal plane
const FOG_NEAR = 30;
const FOG_FAR = 108;

/* Lit resin under two lighting conditions. Nothing saturated, nothing neon. */
const COLD = new THREE.Color('#A39EA3');   // screen light — the one cool note, and a lonely one
const WARM = new THREE.Color('#F5E7CF');   // warm light through fog
const PEARL = new THREE.Color('#FEFCF9');
const ACCENT = new THREE.Color('#C9A8E0'); // sparingly, and only on a meeting

/* ---- scene -------------------------------------------------- */

export async function createScene(canvas) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = innerWidth < 760;
  const count = mobile ? COUNT_MOBILE : COUNT_DESKTOP;
  const maxThreads = mobile ? 160 : MAX_THREADS;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !mobile,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
  camera.position.set(0, 2, 62);

  /* shared fog uniforms — one atmosphere for dots and threads alike */
  const fog = {
    uFogNear: { value: FOG_NEAR },
    uFogFar: { value: FOG_FAR },
    uFogColor: { value: new THREE.Color('#463A31') },
  };

  const FOG_CHUNK = /* glsl */ `
    uniform float uFogNear;
    uniform float uFogFar;
    uniform vec3  uFogColor;
    // 1 = right here, 0 = lost in the fog
    float fogAmount(float viewZ) {
      return smoothstep(uFogFar, uFogNear, -viewZ);
    }
  `;

  /* ---- people ---------------------------------------------- */

  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const soft = new Float32Array(count);
  const alph = new Float32Array(count);
  const core = new Float32Array(count);

  const home = new Float32Array(count * 3);
  const seed = new Float32Array(count * 3);
  const pull = new Float32Array(count * 3);
  const pullTo = new Float32Array(count * 3);
  const tone = new Float32Array(count);
  const near = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    home[i3 + 0] = (Math.random() * 2 - 1) * FIELD.x;
    home[i3 + 1] = (Math.random() * 2 - 1) * FIELD.y;
    home[i3 + 2] = (Math.random() * 2 - 1) * FIELD.z;
    seed[i3 + 0] = Math.random() * Math.PI * 2;
    seed[i3 + 1] = Math.random() * Math.PI * 2;
    seed[i3 + 2] = 0.35 + Math.random() * 0.7;
    tone[i] = Math.random();
  }
  pos.set(home);

  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dotGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  dotGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  dotGeo.setAttribute('aSoft', new THREE.BufferAttribute(soft, 1));
  dotGeo.setAttribute('aAlpha', new THREE.BufferAttribute(alph, 1));
  dotGeo.setAttribute('aCore', new THREE.BufferAttribute(core, 1));

  /* Bokeh, the way a lens does it: a point on the focal plane is a small tight
     disc with a bright core; the further it sits from focus the larger and
     softer its circle of confusion becomes. Normal blending — a real
     out-of-focus highlight spreads light, it doesn't add it. */
  const dotMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
    uniforms: { uScale: { value: 1 }, ...fog },
    vertexShader: /* glsl */ `
      attribute vec3  aColor;
      attribute float aSize;
      attribute float aSoft;
      attribute float aAlpha;
      attribute float aCore;
      uniform   float uScale;
      varying   vec3  vColor;
      varying   float vSoft;
      varying   float vAlpha;
      varying   float vCore;
      ${FOG_CHUNK}

      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float f = fogAmount(mv.z);

        vColor = mix(uFogColor, aColor, 0.25 + f * 0.75);
        vSoft  = aSoft;
        vCore  = aCore * f;
        vAlpha = aAlpha * mix(0.12, 1.0, f);

        gl_PointSize = aSize * uScale * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3  vColor;
      varying float vSoft;
      varying float vAlpha;
      varying float vCore;

      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;

        // A defocused highlight is a *disc*, not a smudge: even at full
        // defocus the circle of confusion keeps a readable edge, so the
        // falloff is capped well short of a full-radius gaussian.
        float edge = mix(0.08, 0.42, vSoft);
        float a = 1.0 - smoothstep(1.0 - edge, 1.0, d);

        // and a real one carries a slightly brighter rim at any focus
        a *= 1.0 + (0.22 - vSoft * 0.10) * smoothstep(0.45, 0.94, d);

        // energy: a tiny hot centre on the ones close to the focal plane
        vec3 c = mix(vColor, vec3(1.0), vCore * (1.0 - smoothstep(0.0, 0.42, d)) * 0.5);

        if (a <= 0.001) discard;
        gl_FragColor = vec4(c, a * vAlpha);
      }
    `,
  });

  const dots = new THREE.Points(dotGeo, dotMat);
  dots.frustumCulled = false;
  scene.add(dots);

  /* ---- threads ---------------------------------------------
     Thin strings between people who are close, with a soft pulse of light
     travelling along each one. 1px wide by definition in WebGL, which is
     exactly the delicacy we want. */

  const tPos = new Float32Array(maxThreads * 6);
  const tCol = new Float32Array(maxThreads * 6);
  const tAlpha = new Float32Array(maxThreads * 2);
  const tEnd = new Float32Array(maxThreads * 2);    // 0 at one end, 1 at the other
  const tSeed = new Float32Array(maxThreads * 2);

  const thGeo = new THREE.BufferGeometry();
  thGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  thGeo.setAttribute('aColor', new THREE.BufferAttribute(tCol, 3));
  thGeo.setAttribute('aAlpha', new THREE.BufferAttribute(tAlpha, 1));
  thGeo.setAttribute('aEnd', new THREE.BufferAttribute(tEnd, 1));
  thGeo.setAttribute('aSeed', new THREE.BufferAttribute(tSeed, 1));
  thGeo.setDrawRange(0, 0);

  const thMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
    uniforms: { uTime: { value: 0 }, ...fog },
    vertexShader: /* glsl */ `
      attribute vec3  aColor;
      attribute float aAlpha;
      attribute float aEnd;
      attribute float aSeed;
      varying   vec3  vColor;
      varying   float vAlpha;
      varying   float vEnd;
      varying   float vSeed;
      ${FOG_CHUNK}

      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float f = fogAmount(mv.z);
        vColor = mix(uFogColor, aColor, 0.2 + f * 0.8);
        vAlpha = aAlpha * mix(0.0, 1.0, f);   // threads vanish entirely in fog
        vEnd   = aEnd;
        vSeed  = aSeed;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3  vColor;
      varying float vAlpha;
      varying float vEnd;
      varying float vSeed;
      uniform float uTime;

      void main() {
        // a soft pulse of light running from one person to the other
        float head = fract(uTime * 0.11 + vSeed);
        float d = abs(vEnd - head);
        d = min(d, 1.0 - d);                       // wrap
        float pulse = exp(-(d * d) / 0.010);

        // the string is faint; the pulse is what you actually notice
        float a = vAlpha * (0.30 + pulse * 0.85);
        vec3  c = mix(vColor, vec3(1.0), pulse * 0.35);

        if (a <= 0.002) discard;
        gl_FragColor = vec4(c, a);
      }
    `,
  });

  scene.add(new THREE.LineSegments(thGeo, thMat));

  /* ---- state ---------------------------------------------- */

  const state = { alpha: 1, gather: 0, warmth: 0 };
  const target = { ...state };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let visible = true;

  addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  // Measured from the canvas's own box rather than innerHeight: CSS sizes it
  // to the large viewport so a retracting iOS toolbar can't reveal an edge
  // below it, and a buffer sized to the small viewport would stretch the
  // field vertically by exactly the toolbar's height.
  function resize() {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 760 ? 66 : 52;
    camera.updateProjectionMatrix();
    dotMat.uniforms.uScale.value = Math.min(devicePixelRatio, 2);
  }
  addEventListener('resize', resize);
  resize();

  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

  const c = new THREE.Color();
  const c2 = new THREE.Color();
  const fogDusk = new THREE.Color('#463A31');
  const fogWarm = new THREE.Color('#D6C5AC');
  const clock = new THREE.Clock();
  let prevT = 0;
  let frame = 0;

  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;

    // getElapsedTime() consumes the clock's delta, so derive dt from elapsed
    // time rather than calling getDelta() after it (which returns ~0).
    const t = clock.getElapsedTime();
    const dt = Math.min(t - prevT, 0.05);
    prevT = t;

    for (const k of ['alpha', 'gather', 'warmth']) {
      state[k] += (target[k] - state[k]) * Math.min(1, dt * 2.6);
    }
    if (state.alpha < 0.004) { renderer.clear(); return; }

    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 1.6);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 1.6);

    // the fog itself warms with the hour
    fog.uFogColor.value.copy(fogDusk).lerp(fogWarm, state.warmth);
    thMat.uniforms.uTime.value = t;

    /* -- who has drifted close to whom, and the threads between them ---- */
    if (frame % 3 === 0) {
      pullTo.fill(0);
      near.fill(0);
      let n = 0;

      if (state.gather > 0.01) {
        for (let i = 0; i < count; i++) {
          const a = i * 3;
          for (let j = i + 1; j < count; j++) {
            const b = j * 3;
            const dx = pos[b] - pos[a];
            const dy = pos[b + 1] - pos[a + 1];
            const dz = pos[b + 2] - pos[a + 2];
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > REACH * REACH) continue;

            const d = Math.sqrt(d2) || 0.0001;
            const closeness = 1 - d / REACH;

            // Pull fades out at very short range so pairs settle *touching*
            // rather than collapsing through each other — surface tension,
            // not gravity.
            const w = state.gather * closeness * Math.min(1, d / (REACH * 0.34)) * 0.5;
            pullTo[a] += dx * w; pullTo[a + 1] += dy * w; pullTo[a + 2] += dz * w;
            pullTo[b] -= dx * w; pullTo[b + 1] -= dy * w; pullTo[b + 2] -= dz * w;

            const nn = closeness * state.gather;
            if (nn > near[i]) near[i] = nn;
            if (nn > near[j]) near[j] = nn;

            if (n < maxThreads) {
              const o = n * 6;
              tPos[o] = pos[a]; tPos[o + 1] = pos[a + 1]; tPos[o + 2] = pos[a + 2];
              tPos[o + 3] = pos[b]; tPos[o + 4] = pos[b + 1]; tPos[o + 5] = pos[b + 2];

              c2.copy(PEARL).lerp(WARM, state.warmth);
              const strength = closeness * state.gather * state.alpha * 0.5;
              const o2 = n * 2;
              tCol[o] = tCol[o + 3] = c2.r;
              tCol[o + 1] = tCol[o + 4] = c2.g;
              tCol[o + 2] = tCol[o + 5] = c2.b;
              tAlpha[o2] = tAlpha[o2 + 1] = strength;
              tEnd[o2] = 0; tEnd[o2 + 1] = 1;
              // stable per-pair phase so pulses don't all march in step
              const ph = ((i * 73 + j * 149) % 1000) / 1000;
              tSeed[o2] = tSeed[o2 + 1] = ph;
              n++;
            }
          }
        }
      }

      thGeo.setDrawRange(0, n * 2);
      thGeo.attributes.position.needsUpdate = true;
      thGeo.attributes.aColor.needsUpdate = true;
      thGeo.attributes.aAlpha.needsUpdate = true;
      thGeo.attributes.aEnd.needsUpdate = true;
      thGeo.attributes.aSeed.needsUpdate = true;
    }

    /* -- drift, gather, light --------------------------------- */
    const drift = reduced ? 0.12 : 1;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const sp = seed[i3 + 2];

      const fx = Math.sin(t * 0.12 * sp + seed[i3]) * 3.0 * drift;
      const fy = Math.cos(t * 0.10 * sp + seed[i3 + 1]) * 1.9 * drift;
      const fz = Math.sin(t * 0.08 * sp + seed[i3 + 1]) * 2.6 * drift;

      for (let k = 0; k < 3; k++) {
        pull[i3 + k] += (pullTo[i3 + k] - pull[i3 + k]) * Math.min(1, dt * 1.2);
      }

      pos[i3 + 0] = home[i3 + 0] + fx + pull[i3 + 0];
      pos[i3 + 1] = home[i3 + 1] + fy + pull[i3 + 1];
      pos[i3 + 2] = home[i3 + 2] + fz + pull[i3 + 2];

      /* depth of field: the circle of confusion grows away from focus */
      const defocus = Math.min(1, Math.abs(pos[i3 + 2] - FOCUS_Z) / 28);
      size[i] = 0.85 + defocus * 4.8;
      soft[i] = 0.22 + defocus * 0.78;
      core[i] = (1 - defocus) ** 2;

      const w = THREE.MathUtils.clamp(state.warmth * 1.4 - tone[i] * 0.4, 0, 1);
      c.copy(COLD).lerp(WARM, w);
      c.lerp(PEARL, (1 - defocus) * 0.4);
      // the accent marks a moment, never decoration: only a pair that has
      // actually found each other picks up any violet at all
      if (near[i] > 0.6) c.lerp(ACCENT, (near[i] - 0.6) * 0.32);

      col[i3 + 0] = c.r;
      col[i3 + 1] = c.g;
      col[i3 + 2] = c.b;

      alph[i] = state.alpha * (0.52 - defocus * 0.36) * (0.8 + tone[i] * 0.2);
    }

    dotGeo.attributes.position.needsUpdate = true;
    dotGeo.attributes.aColor.needsUpdate = true;
    dotGeo.attributes.aSize.needsUpdate = true;
    dotGeo.attributes.aSoft.needsUpdate = true;
    dotGeo.attributes.aAlpha.needsUpdate = true;
    dotGeo.attributes.aCore.needsUpdate = true;
    frame++;

    /* the lens breathes, it doesn't chase */
    camera.position.x = pointer.x * 5;
    camera.position.y = 2 - pointer.y * 3 + Math.sin(t * 0.16) * 0.7;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  tick();

  return {
    set(next) { Object.assign(target, next); },
  };
}
