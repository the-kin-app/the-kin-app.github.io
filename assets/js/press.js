/* ============================================================
   Kin — the submerge press
   ------------------------------------------------------------
   Press: the object sinks and goes clear — glass under water, only text
   and a thin edge left. A ripple spreads from the contact point. Release:
   it surfaces, and the accent takes over to say it's active.

   Shared by every page that uses .btn (the landing page imports it;
   the waitlist loads it directly), so the buttons feel like the same
   physical object wherever they appear.
   ============================================================ */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function buttons(root = document) {
  for (const btn of root.querySelectorAll('.btn')) {
    // the interactive orchid↔magenta fill tracks the cursor
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
