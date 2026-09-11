/* ============================================================
   Min — the signup form
   ------------------------------------------------------------
   One address, posted to the Worker. Lifted out of
   waitlist-hero.js so /waitlist and the homepage post through
   exactly one implementation of this contract rather than two
   copies that drift.

   Everything is resolved inside the <form> that gets passed in,
   so a page can carry more than one (the homepage has two: the
   hero and the closer). The success panel is the sibling marked
   [data-signup-done], or whatever `data-done` names.

   Progressive as before: the markup is a working <form> on its
   own. This file only adds validation and the fetch.
   ============================================================ */

// Cloudflare Worker endpoint. Override at deploy time by setting
// window.KIN_API_BASE before this module runs.
const API_BASE = (window.KIN_API_BASE || 'https://api.hellomin.app').replace(/\/$/, '');
const SUBMIT_URL = API_BASE + '/waitlist';

/* Poster attribution — the same contract as waitlist.js. Codes on posters
   already hanging point at api.kinapp.social/<location>/<poster> — the OLD
   host, kept alive permanently because printed paper can't be reissued. New
   posters use api.hellomin.app. Either host counts the scan and redirects
   here with ?l=<location>&p=<poster>.

   Read once into memory and held for this page view only — no cookie, no
   localStorage, nothing on the device, so it needs no consent banner. The
   trade-off: navigate away and back without the query string and the signup
   lands unattributed. Every poster loses the same share of those, so the
   comparison still holds. Which is also why ?l= and ?p= stay in the address
   bar: with nothing persisted, the URL *is* the attribution.

   Only the shape is checked here. min-waitlist-worker src/index.js holds the
   authoritative allowlists and stores anything it doesn't recognise as NULL,
   so the vocabulary lives in one place rather than two. */
const SLUG_RE = /^[a-z0-9-]{1,32}$/;
const params = new URLSearchParams(window.location.search);
const readSlug = (key) => {
  const value = params.get(key);
  return value && SLUG_RE.test(value) ? value : null;
};
const poster = readSlug('p');
const posterLocation = readSlug('l');

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/* The Worker requires a name and the signups table stores it NOT NULL, but we
   deliberately ask for one thing only — a second field is the difference
   between joining and not, at a QR code in a bar. So the name is read off the
   address: the local part, minus any +tag, with separators opened out into
   spaces. `sam.okonkwo+kin@…` becomes "Sam Okonkwo". The address remains the
   identity; this is only what a greeting would use. */
function nameFromEmail(email) {
  const local = email.split('@')[0].split('+')[0];
  const words = local.replace(/[._\-]+/g, ' ').replace(/\d+/g, ' ').trim();
  if (!words) return 'Friend';
  return words
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .slice(0, 100);
}

export function waitlistForm(form) {
  if (!form || form.dataset.signupBound) return;
  form.dataset.signupBound = '1';

  const emailInput = form.querySelector('input[type="email"]');
  const websiteInput = form.querySelector('input[name="website"]');
  const errorEl = form.querySelector('.field-error');
  const statusEl = form.querySelector('.status');
  const button = form.querySelector('button[type="submit"]');
  if (!emailInput || !button) return;
  const label = button.querySelector('.btn__label') || button;
  const done = form.dataset.done
    ? document.querySelector(form.dataset.done)
    : form.parentElement.querySelector('[data-signup-done]');

  const fail = (message) => {
    if (errorEl) errorEl.textContent = message;
    emailInput.setAttribute('aria-invalid', 'true');
  };
  const clear = () => {
    if (errorEl) errorEl.textContent = '';
    emailInput.removeAttribute('aria-invalid');
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'status'; }
  };

  emailInput.addEventListener('input', () => { if (errorEl && errorEl.textContent) clear(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clear();

    const email = emailInput.value.trim();
    if (!email) { fail('Please enter your email.'); return; }
    if (!isValidEmail(email)) { fail('That address doesn’t look right.'); return; }

    const payload = {
      name: nameFromEmail(email),
      contact_method: 'email',
      email: email,
      phone: null,
      website: websiteInput ? websiteInput.value : '', // honeypot — always empty for real users
      poster: poster,
      poster_location: posterLocation
    };

    const original = label.textContent;
    button.disabled = true;
    label.textContent = 'Joining…';

    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let message = 'Something went wrong. Please try again.';
        try {
          const data = await res.json();
          if (data && data.error) message = data.error;
        } catch (_) { /* non-JSON error response */ }
        throw new Error(message);
      }

      form.style.display = 'none';
      // /waitlist's panel is display:none in CSS and needs the inline
      // override; the homepage's is a flex row gated on [hidden] alone.
      if (done) {
        done.hidden = false;
        if (getComputedStyle(done).display === 'none') done.style.display = 'block';
      }
    } catch (err) {
      button.disabled = false;
      label.textContent = original;
      if (statusEl) {
        statusEl.textContent = err.message || 'Network error. Please try again.';
        statusEl.className = 'status error';
      }
    }
  });
}

/* Bind every form on the page that asks for it. */
export function waitlistForms(root = document) {
  root.querySelectorAll('form[data-signup]').forEach(waitlistForm);
}
