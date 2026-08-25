/* ============================================================
   Kin — Waitlist form handler
   Validates input and submits to the Cloudflare Worker API.
   See /worker for the API. Endpoint is configurable via
   window.KIN_API_BASE (set before this script loads).
   ============================================================ */
(function () {
  'use strict';

  const form = document.getElementById('waitlist-form');
  if (!form) return;

  const tabEmail = document.getElementById('tab-email');
  const tabPhone = document.getElementById('tab-phone');
  const segmented = tabEmail.closest('.segmented');
  const segmentedPill = segmented.querySelector('.segmented__pill');
  const emailField = document.getElementById('email-field');
  const phoneField = document.getElementById('phone-field');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const nameInput = document.getElementById('name');
  const websiteInput = document.getElementById('website');
  const formStatus = document.getElementById('form-status');
  const submitButton = form.querySelector('button.submit');
  const submitLabel = submitButton.querySelector('.btn__label') || submitButton;

  // Cloudflare Worker endpoint. Override at deploy time by setting
  // window.KIN_API_BASE before this script runs.
  const API_BASE = (window.KIN_API_BASE || 'https://api.kinapp.social').replace(/\/$/, '');
  const SUBMIT_URL = API_BASE + '/waitlist';

  // Poster attribution. Each printed QR points at
  // api.kinapp.social/<location>/<poster>, which counts the scan and redirects
  // here with ?l=<location>&p=<poster>. Read once into memory and held for
  // this page view only — no cookie, no localStorage, nothing stored on the
  // device, so this needs no consent banner. The trade-off: navigate away and
  // back without the query string and the signup lands unattributed. Every
  // poster loses the same share of those, so the comparison still holds.
  //
  // Keep ?l= and ?p= in the address bar. With nothing persisted, the URL *is*
  // the attribution.
  //
  // Only the shape is checked here. worker/src/index.js holds the
  // authoritative allowlists and stores anything it doesn't recognise as
  // NULL, so the vocabulary lives in one place rather than two.
  const SLUG_RE = /^[a-z0-9-]{1,32}$/;
  const params = new URLSearchParams(window.location.search);

  function readSlug(key) {
    const value = params.get(key);
    return value && SLUG_RE.test(value) ? value : null;
  }

  const poster = readSlug('p');
  const posterLocation = readSlug('l');

  let contactMode = 'email';

  function setMode(mode) {
    if (mode === contactMode) return;
    contactMode = mode;
    const isEmail = mode === 'email';
    tabEmail.classList.toggle('active', isEmail);
    tabPhone.classList.toggle('active', !isEmail);
    segmented.classList.toggle('is-phone', !isEmail);
    segmentedPill.classList.remove('is-launching');
    void segmentedPill.offsetWidth; // restart the launch keyframes on repeat clicks
    segmentedPill.classList.add('is-launching');
    emailField.style.display = isEmail ? '' : 'none';
    phoneField.style.display = isEmail ? 'none' : '';
    clearErrors();
  }

  function clearErrors() {
    document.getElementById('name-error').textContent = '';
    document.getElementById('email-error').textContent = '';
    document.getElementById('phone-error').textContent = '';
    formStatus.textContent = '';
    formStatus.className = 'status';
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function isValidPhone(value) {
    return value.replace(/[^\d]/g, '').length >= 7;
  }

  tabEmail.addEventListener('click', () => setMode('email'));
  tabPhone.addEventListener('click', () => setMode('phone'));

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors();

    let valid = true;

    if (!nameInput.value.trim()) {
      document.getElementById('name-error').textContent = 'Please enter a name or nickname.';
      valid = false;
    }

    if (contactMode === 'email') {
      if (!emailInput.value.trim()) {
        document.getElementById('email-error').textContent = 'Email is required.';
        valid = false;
      } else if (!isValidEmail(emailInput.value.trim())) {
        document.getElementById('email-error').textContent = 'Please enter a valid email.';
        valid = false;
      }
    } else {
      if (!phoneInput.value.trim()) {
        document.getElementById('phone-error').textContent = 'Phone number is required.';
        valid = false;
      } else if (!isValidPhone(phoneInput.value.trim())) {
        document.getElementById('phone-error').textContent = 'Please enter a valid phone number.';
        valid = false;
      }
    }

    if (!valid) {
      formStatus.textContent = 'Please fix the errors above.';
      formStatus.className = 'status error';
      return;
    }

    const payload = {
      name: nameInput.value.trim(),
      contact_method: contactMode,
      email: contactMode === 'email' ? emailInput.value.trim() : null,
      phone: contactMode === 'phone' ? phoneInput.value.trim() : null,
      website: websiteInput ? websiteInput.value : '', // honeypot — always empty for real users
      poster: poster,
      poster_location: posterLocation
    };

    const originalLabel = submitLabel.textContent;
    submitButton.disabled = true;
    submitLabel.textContent = 'Joining…';
    formStatus.textContent = '';
    formStatus.className = 'status';

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

      document.getElementById('form-view').style.display = 'none';
      document.getElementById('success-view').style.display = 'block';
    } catch (err) {
      submitButton.disabled = false;
      submitLabel.textContent = originalLabel;
      formStatus.textContent = err.message || 'Network error. Please try again.';
      formStatus.className = 'status error';
    }
  });
})();
