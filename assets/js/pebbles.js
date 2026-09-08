/* ============================================================
   PEBBLE CASCADE — three resin lenses that rise into one cluster
   ------------------------------------------------------------
   Recreates Figma "WEB · pebble cascade" (QR landing page,
   706:374). Spec: "SPEC · Pebble section" (616:366).

   The lens artwork below is exported from Figma UNTOUCHED — it is
   Santeri's, hand-built, and must not be redrawn. The 5px INSIDE
   gradient stroke (transparent at the top, warm white at the base)
   is what reads as 3D; if a re-export loses it, the pebbles go flat.

   The outline and flash passes are the SAME path as the lens, cloned
   here rather than exported three times, so all three layers can
   never drift out of register.
   ============================================================ */

const ART = {
  p3: {
    vb: '0 0 739 665',
    lens: 'M370.895 252.192C410.084 252.192 489.077 265.44 562.114 280.85C598.58 288.544 633.469 296.757 661.033 304.085C674.817 307.75 686.747 311.188 696.117 314.223C705.565 317.284 712.193 319.869 715.532 321.796C722.059 325.564 727.171 332.446 730.663 341.423C734.148 350.381 735.932 361.216 735.941 372.521C735.96 395.234 728.83 419.104 714.969 432.965C711.708 436.226 705.636 439.842 696.955 443.646C688.35 447.417 677.448 451.263 664.774 455.084C639.432 462.725 607.196 470.214 572.49 476.802C503.053 489.984 424.014 499.513 370.895 499.513C317.791 499.513 242.415 489.632 176.813 476.275C144.026 469.599 113.749 462.069 89.9766 454.497C78.0874 450.71 67.8697 446.927 59.7969 443.253C51.6537 439.548 45.944 436.065 42.8447 432.965C16.0582 406.179 8.74002 355.468 42.8447 321.364C46.9151 317.293 53.7955 313.05 63.1357 308.763C72.4236 304.501 83.9337 300.289 97.0771 296.202C123.361 288.027 155.987 280.407 190.031 273.879C258.157 260.817 331.626 252.192 370.895 252.192Z',
    sw: 5.44,
    warm: 'M27.448 349.535C44.391 333.941 331.044 379.769 350.408 397.592C369.772 415.414 373.921 467.843 350.408 480.338C326.895 492.832 36.0926 423.37 27.448 415.414C18.8035 407.457 10.505 365.13 27.448 349.535Z',
    warmB: 8.806,
    sheen: 'M55.4891 323.771C99.5585 279.701 322.818 249.637 374.598 249.637C426.378 249.637 717.91 298.276 708.151 334.697C698.392 371.118 440.822 382.772 375.644 382.772C310.466 382.772 11.4197 367.84 55.4891 323.771Z',
    sheenB: 9.996,
    g0: [378.179, 209.045, 378.179, 537.197],
    g1: [377.934, 249.472, 377.934, 668.1]
  },
  p1: {
    vb: '0 0 674 607',
    lens: 'M338.168 229.94C373.9 229.94 445.923 242.019 512.516 256.069C545.764 263.085 577.574 270.573 602.706 277.255C615.274 280.596 626.152 283.731 634.695 286.498C643.309 289.288 649.352 291.645 652.396 293.402C658.347 296.838 663.008 303.113 666.192 311.298C669.369 319.465 670.996 329.344 671.005 339.651C671.022 360.361 664.522 382.124 651.884 394.763C648.911 397.736 643.373 401.032 635.458 404.501C627.612 407.939 617.673 411.446 606.117 414.93C583.011 421.896 553.619 428.724 521.976 434.731C458.665 446.75 386.6 455.438 338.168 455.438C289.75 455.438 221.025 446.43 161.212 434.251C131.317 428.164 103.712 421.298 82.0371 414.395C71.197 410.942 61.881 407.492 54.5205 404.143C47.0961 400.764 41.8903 397.588 39.0645 394.763C14.6415 370.34 7.96899 324.103 39.0645 293.008C42.7757 289.297 49.0487 285.428 57.5645 281.52C66.0329 277.633 76.5278 273.792 88.5117 270.065C112.476 262.612 142.223 255.665 173.263 249.714C235.377 237.804 302.364 229.94 338.168 229.94Z',
    sw: 4.96,
    warm: 'M25.0255 318.694C40.4735 304.476 301.834 346.26 319.489 362.51C337.144 378.76 340.927 426.563 319.489 437.955C298.05 449.347 32.9073 386.014 25.0255 378.76C17.1437 371.505 9.57747 332.913 25.0255 318.694Z',
    warmB: 8.029,
    sheen: 'M50.5934 295.203C90.7743 255.022 294.335 227.611 341.546 227.611C388.757 227.611 654.565 271.958 645.667 305.165C636.769 338.372 401.926 348.998 342.499 348.998C283.072 348.998 10.4125 335.384 50.5934 295.203Z',
    sheenB: 9.114,
    g0: [344.81, 190.6, 344.81, 489.797],
    g1: [344.587, 227.46, 344.587, 609.15]
  },
  p2: {
    vb: '0 0 598 538',
    lens: 'M299.988 203.979C331.686 203.979 395.577 214.693 454.651 227.157C484.146 233.381 512.365 240.024 534.659 245.951C545.808 248.915 555.458 251.696 563.037 254.151C570.679 256.626 576.04 258.716 578.74 260.276C584.019 263.323 588.153 268.891 590.978 276.152C593.796 283.396 595.239 292.16 595.247 301.303C595.262 319.674 589.496 338.98 578.284 350.192C575.647 352.829 570.735 355.754 563.714 358.831C556.754 361.882 547.936 364.992 537.686 368.082C517.188 374.262 491.115 380.319 463.044 385.648C406.882 396.31 342.953 404.018 299.988 404.018C257.037 404.018 196.071 396.026 143.011 385.222C116.491 379.822 92.0034 373.732 72.7754 367.608C63.1591 364.545 54.8947 361.485 48.3652 358.514C41.7788 355.517 37.161 352.698 34.6543 350.192C12.9889 328.526 7.06969 287.511 34.6543 259.926C37.9466 256.634 43.5118 253.202 51.0664 249.735C58.5788 246.287 67.8886 242.881 78.5195 239.574C99.7785 232.963 126.167 226.799 153.702 221.52C208.803 210.955 268.227 203.979 299.988 203.979Z',
    sw: 4.4,
    warm: 'M22.2005 282.713C35.9044 270.099 267.756 307.167 283.418 321.582C299.08 335.997 302.436 378.403 283.418 388.508C264.4 398.614 29.1924 342.432 22.2005 335.997C15.2086 329.561 8.4966 295.326 22.2005 282.713Z',
    warmB: 7.1225,
    sheen: 'M44.8818 261.873C80.5262 226.229 261.104 201.913 302.985 201.913C344.866 201.913 580.663 241.253 572.77 270.711C564.877 300.169 356.548 309.595 303.83 309.595C251.113 309.595 9.23747 297.518 44.8818 261.873Z',
    sheenB: 8.085,
    g0: [305.88, 169.08, 305.88, 434.497],
    g1: [305.683, 201.779, 305.683, 540.375]
  }
};

/* Layout is the END FORMATION from the Figma reference, as percentages of a
   1440x1240 frame — the Figma artboard is 1900 tall but its content only
   spans y 232-1371, and that dead space made the pinned cluster too narrow
   for its own copy. Vertical values are re-based on the crop; x and width
   are unchanged fractions of 1440. It is fixed — the cluster is composed, not stacked.
   t = when this pebble starts. Land is t + 1.85s; its copy follows 150ms
   after its OWN landing, never after all three. */
const DISCS = [
  { k: 'p3', t: 0.00, x: 30.56, y:  5.00, w: 50.07,
    cx: 32.60, cy: 15.43, cw: 46.00,
    h: 'Min, always with you',
    l: ['A companion that understands', 'and grows with you'] },
  { k: 'p1', t: 0.55, x: 17.15, y: 30.97, w: 45.69,
    cx: 17.00, cy: 39.59, cw: 46.00,
    h: 'Private by design',
    l: ['Your world stays yours.', 'Always encrypted.'] },
  { k: 'p2', t: 1.10, x: 36.46, y: 53.47, w: 40.56,
    cx: 33.74, cy: 60.01, cw: 46.00,
    h: 'Real connection',
    l: ['For the moments that', 'matter most.'] }
];

const NS = 'http://www.w3.org/2000/svg';

function art(d, uid) {
  return `<svg viewBox="${d.vb}" fill="none" xmlns="${NS}" aria-hidden="true">
  <defs>
    <filter id="pw${uid}" x="-30%" y="-30%" width="160%" height="160%" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="${d.warmB}"/>
    </filter>
    <filter id="ps${uid}" x="-30%" y="-30%" width="160%" height="160%" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="${d.sheenB}"/>
    </filter>
    <linearGradient id="pg0${uid}" x1="${d.g0[0]}" y1="${d.g0[1]}" x2="${d.g0[2]}" y2="${d.g0[3]}" gradientUnits="userSpaceOnUse">
      <stop stop-color="white" stop-opacity="0.97"/>
      <stop offset="0.3" stop-color="#FCF7F2" stop-opacity="0.94"/>
      <stop offset="0.64089" stop-color="#F2E9E1" stop-opacity="0.92"/>
      <stop offset="1" stop-color="#FFF2E0" stop-opacity="0.97"/>
    </linearGradient>
    <linearGradient id="pg1${uid}" x1="${d.g1[0]}" y1="${d.g1[1]}" x2="${d.g1[2]}" y2="${d.g1[3]}" gradientUnits="userSpaceOnUse">
      <stop offset="0.317024" stop-color="white" stop-opacity="0"/>
      <stop offset="0.9" stop-color="#FFF6EC"/>
    </linearGradient>
  </defs>
  <!-- the outline reads first, alone -->
  <path class="pcd__outline" d="${d.lens}"/>
  <!-- the true material, arriving while the pebble is still moving -->
  <g class="pcd__mat">
    <path d="${d.lens}" fill="url(#pg0${uid})" stroke="url(#pg1${uid})" stroke-width="${d.sw}"/>
    <g filter="url(#pw${uid})"><path d="${d.warm}" fill="#E0CCB5" fill-opacity="0.09"/></g>
    <g filter="url(#ps${uid})"><path d="${d.sheen}" fill="white" fill-opacity="0.26"/></g>
  </g>
  <!-- old camera flash: rolls up, rolls back slower -->
  <path class="pcd__flash" d="${d.lens}"/>
</svg>`;
}

export function pebbleCascade(root) {
  const host = root || document.querySelector('[data-pebbles]');
  if (!host || host.dataset.built) return;
  host.dataset.built = '1';
  host.classList.add('pcascade');

  let uid = 0;
  const html = DISCS.map((s) => {
    const id = 'p' + (++uid);
    const t = s.t + 's';
    // heading is line 0; each subcopy line continues the same 70ms cascade
    const lines = [`<h3><span class="pcd-line" style="--ct:calc(${t} + 2000ms)">${s.h}</span></h3>`]
      .concat(s.l.map((txt, i) =>
        `<p><span class="pcd-line" style="--ct:calc(${t} + ${2000 + (i + 1) * 70}ms)">${txt}</span></p>`));
    /* disc first, copy second: on desktop both are absolute, so this is
       paint order — the copy has to sit ON the lens, not under it. On a
       phone .pcd-item becomes a flex column and `order` puts the copy
       above its own pebble instead. */
    return `
  <div class="pcd-item">
    <div class="pcd" style="--x:${s.x}%;--y:${s.y}%;--w:${s.w}%;--t:${t}">
      <div class="pcd__rise" style="--t:${t}">${art(ART[s.k], id)}</div>
    </div>
    <div class="pcd-holo" style="--x:${s.cx}%;--y:${s.cy}%;--w:${s.cw}%">${lines.join('')}</div>
  </div>`;
  }).join('');

  host.insertAdjacentHTML('beforeend', html);

  /* ---- HOW IT PLAYS ------------------------------------------------
     Two mechanisms, because a phone and a desktop want different things.

     DESKTOP — scrubbed. The cluster is pinned (tall section, sticky stage)
     and scroll position drives the timeline directly, so the page cannot
     move past the section before the animation has run. That is the fix for
     "it feels natural to keep scrolling and the animation doesn't finish" —
     the animation IS the scroll. Every animation is paused and we set
     currentTime on it: exact, no delay arithmetic, and scrubbing backwards
     works for free.

     PHONE — plays on its own. A 300vh pin on a phone is a trap, so the
     section is un-pinned there and the pebbles simply play once when they
     come into view. ⚠️ The JS must NOT pause them in that case: `pause()`
     overrides the stylesheet, which is what left the phone frozen mid-
     animation with half-faded copy.

     Native `animation-timeline: view()` would be tidier than either but is
     Chromium/Safari-26 only, so this stays the mechanism.
     ------------------------------------------------------------------ */
  const TOTAL = 4200;                    // ms — the longest track's end
  const PHONE = matchMedia('(max-width: 760px)');
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

  if (REDUCED.matches) { host.classList.add('is-in'); return; }

  let teardown = null;

  function playOnce() {
    // let the stylesheet run them; do not touch currentTime
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { host.classList.add('is-in'); io.disconnect(); } });
    }, { threshold: 0.12 });
    io.observe(host);
    return () => io.disconnect();
  }

  function scrub() {
    const scroller = host.closest('.pcascade-scroll') || host.parentElement;
    /* Re-queried every frame rather than cached. The browser recreates an
       animation whenever its element's styles change, and a cached list
       silently stops covering the new ones — that is what left the copy
       blocks frozen at currentTime 0 while the pebbles scrubbed correctly.
       ~30 animations, only while scrolling; the cost is nothing next to
       being wrong. */
    let ticking = false;
    function paint() {
      ticking = false;
      const r = scroller.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      if (span <= 0) return;
      const p = Math.min(1, Math.max(0, -r.top / span));
      const t = p * TOTAL;
      const anims = host.getAnimations({ subtree: true });
      for (let i = 0; i < anims.length; i++) {
        try { anims[i].pause(); anims[i].currentTime = t; } catch (e) {}
      }
    }
    const collect = () => paint();
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } };
    const onResize = () => { collect(); paint(); };
    collect();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onResize, { passive: true });
    // animations are created asynchronously after the markup lands
    requestAnimationFrame(() => { collect(); paint(); });
    paint();
    return () => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onResize);
      anims.forEach((a) => { try { a.play(); } catch (e) {} });
    };
  }

  const mount = () => {
    if (teardown) teardown();
    teardown = PHONE.matches ? playOnce() : scrub();
  };
  mount();
  PHONE.addEventListener('change', mount);
}
