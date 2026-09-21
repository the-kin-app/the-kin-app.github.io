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

   The SCHOOL field is read the same way: /ads/ carries a
   <select name="school"> and every other page does not. When it
   is absent the payload below is byte-for-byte the one the Worker
   has always received, so adding the ad page changed nothing
   about the poster funnel. When it is present it is required, and
   `school` rides along as one more key. That is deliberately the
   only difference between the two pages' contracts — a second
   implementation of this fetch is how the two would drift.

   Progressive as before: the markup is a working <form> on its
   own. This file only adds validation and the fetch.
   ============================================================ */

/* Where the visit came from — which poster, where it hangs, which of the two
   homepages they were shown, and which scan brought them. Read once per page
   view by one module, which also reports the arrival back to the Worker; see
   scan-attribution.js for the whole query-string contract and why none of it
   is persisted about the person.

   The Worker's origin comes from there too, so the site has exactly one
   definition of where the API lives.

   The trade-off, unchanged: navigate away and back without the query string
   and the signup lands unattributed. Every poster and both variants lose the
   same share of those, so the comparison still holds. Which is why ?l=, ?p=,
   ?v= and ?s= stay in the address bar — with nothing persisted, the URL *is*
   the attribution. */
import { API_BASE, attribution } from '/assets/js/scan-attribution.js?v=20260916a';

const SUBMIT_URL = API_BASE + '/waitlist';

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/* A form with two fields needs two places to complain, and the message has to
   land under the field it is about. aria-describedby already names that
   element for the screen reader, so it is used here rather than a second
   convention that could disagree with it. Falls back to the form's first
   .field-error, which is what every one-field page has always used. */
function errorFor(form, control) {
  const id = control && control.getAttribute('aria-describedby');
  return (id && form.querySelector('#' + CSS.escape(id))) || form.querySelector('.field-error');
}

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
  /* Only /ads/ has one. Absent everywhere else, and everything below is
     gated on it rather than on which page this is. */
  const schoolInput = form.querySelector('select[name="school"]');
  const errorEl = form.querySelector('.field-error');
  const statusEl = form.querySelector('.status');
  const button = form.querySelector('button[type="submit"]');
  if (!emailInput || !button) return;
  const label = button.querySelector('.btn__label') || button;
  const done = form.dataset.done
    ? document.querySelector(form.dataset.done)
    : form.parentElement.querySelector('[data-signup-done]');

  /* `control` defaults to the address so every existing call site reads the
     same as it did when this form only had one field. */
  const fail = (message, control = emailInput) => {
    const el = errorFor(form, control);
    if (el) el.textContent = message;
    control.setAttribute('aria-invalid', 'true');
    /* The thumb should land on the thing that is wrong, not at the top of a
       form it has already filled in. Only ever on a real failure. */
    if (typeof control.focus === 'function') control.focus({ preventScroll: false });
  };
  const clear = () => {
    form.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
    emailInput.removeAttribute('aria-invalid');
    if (schoolInput) schoolInput.removeAttribute('aria-invalid');
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'status'; }
  };

  emailInput.addEventListener('input', () => { if (errorEl && errorEl.textContent) clear(); });
  /* Answering the question is what clears the complaint about it. */
  if (schoolInput) schoolInput.addEventListener('change', () => {
    if (schoolInput.getAttribute('aria-invalid')) clear();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clear();

    const email = emailInput.value.trim();
    if (!email) { fail('Please enter your email.'); return; }
    if (!isValidEmail(email)) { fail('That address doesn’t look right.'); return; }

    /* Required where it exists. The empty value is the prompt option, which is
       `disabled` in the markup — this catches the keyboard and the autofill
       paths that can get past that. */
    const school = schoolInput ? schoolInput.value : null;
    if (schoolInput && !school) {
      fail('Please pick your school.', schoolInput);
      return;
    }

    const payload = {
      name: nameFromEmail(email),
      contact_method: 'email',
      email: email,
      phone: null,
      website: websiteInput ? websiteInput.value : '', // honeypot — always empty for real users
      poster: attribution.poster,
      poster_location: attribution.location,
      // Which homepage they signed up from, and which scan brought them.
      // The variant is sent by every signup on either homepage, scanned or
      // not, so a visitor who reached /b/ from a link still counts on the b
      // side. The token is only there when a poster brought them; it is what
      // lets scan -> arrival -> signup be read as one funnel instead of three
      // counts that have to be lined up by eye.
      variant: attribution.variant,
      scan_token: attribution.scanToken
    };

    /* Added rather than always sent as null, so a page without the field posts
       the exact body the Worker has accepted since before /ads/ existed. The
       value is a slug from the <select>; the Worker's SCHOOL_KEYS allowlist is
       what decides whether it is stored or dropped, the same way POSTERS and
       LOCATIONS already work. Both sides have to list a school or the answer
       lands as NULL — see outputs/school-field-spec-2026-09-17.md. */
    if (school) payload.school = school;

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
