/* ============================================================
   Min — where this visit came from, and whether it arrived
   ------------------------------------------------------------
   One module owns the query-string contract the Worker redirects
   through, because two copies of it would drift and the drift
   would look like a result rather than a bug.

   A poster's QR points at the Worker, never at the site:

     api.hellomin.app/<location>/<poster>
        │  counts the scan, draws a side of the landing A/B,
        │  mints a token for this one scan
        ▼
     hellomin.app/?l=kumpula&p=unclesam&v=a&s=<token>
     hellomin.app/b/?l=kumpula&p=unclesam&v=b&s=<token>

   Four values arrive:
     l  where the poster hangs
     p  which poster design
     v  which of the two homepages the Worker sent this scan to
     s  this scan's token — the handle that ties scan, arrival
        and signup into one funnel

   Codes already on walls point at api.kinapp.social, the OLD host,
   kept alive permanently because printed paper cannot be reissued.
   Both hosts run this same Worker and redirect here identically.

   Read once into memory and held for this page view only. NOTHING
   IS WRITTEN TO THE DEVICE — no cookie, no localStorage, no
   sessionStorage — which is what keeps the site clear of a consent
   banner, and it is deliberate rather than incidental.

   An earlier draft of the arrival ping kept a sessionStorage key to
   avoid pinging twice on a reload. It came out: the Worker already
   ignores a second ping (it only stamps where landed_at IS NULL),
   so the key bought one saved request and cost the one property on
   this page worth protecting. A dedup key written for analytics is
   not "strictly necessary" under ePrivacy, and it is not worth
   arguing about to save a 204.
   ============================================================ */

/* The Worker's origin. Lives here rather than in waitlist-form.js because
   this module is now the one place that knows how the site talks to the
   Worker — the form imports it. Override at deploy time by setting
   window.KIN_API_BASE before any module runs. */
export const API_BASE = (window.KIN_API_BASE || 'https://api.hellomin.app').replace(/\/$/, '');

/* Shapes only. min-waitlist-worker src/index.js holds the authoritative
   vocabularies (POSTERS, LOCATIONS, VARIANTS) and stores anything it does not
   recognise as NULL, so adding a poster stays a one-file edit over there. */
const SLUG_RE = /^[a-z0-9-]{1,32}$/;
const TOKEN_RE = /^[0-9a-f]{16}$/;

const params = new URLSearchParams(window.location.search);
const readMatch = (key, re) => {
  const value = params.get(key);
  return value && re.test(value) ? value : null;
};

/* Which page this is, taken from <html data-variant>, not from the path.
   The attribute is declared in the markup of each homepage, so it is right
   on the live site, right behind a local file server, and right in a copy
   opened from disk — all three of which give a different location.pathname.

   Falls back to ?v= when a page carries no attribute, and to null when
   neither is there. null is correct for /waitlist/ and /partners/: they are
   not in the test, and forcing them into a side would put signups on a page
   nobody was shown. */
const pageVariant = document.documentElement.dataset.variant || null;
const declared = pageVariant === 'a' || pageVariant === 'b' ? pageVariant : null;
const fromQuery = params.get('v');

export const attribution = {
  poster: readMatch('p', SLUG_RE),
  location: readMatch('l', SLUG_RE),
  /* The page wins over the query string. ?v= says which side the Worker
     drew; the attribute says which side actually rendered. They agree on a
     normal scan, and when they don't — someone editing the address bar, a
     stale link — what the person SAW is the honest answer. */
  variant: declared || (fromQuery === 'a' || fromQuery === 'b' ? fromQuery : null),
  scanToken: readMatch('s', TOKEN_RE),
};

/* ---- the arrival ----------------------------------------------
   A scan is a camera pointed at paper. An arrival is a page that actually
   rendered. They have always been counted as one number and they are not one
   number: camera previews get dismissed, redirects get abandoned on the walk
   to the platform, phones lose signal mid-hop. Every rate measured against
   scans alone was measured against the larger of the two.

   This runs on import rather than on an explicit call from each page. A page
   that forgot the call would report zero arrivals and read as a page nobody
   reaches — a silent, plausible, wrong number. Importing the form imports
   this, and the ping is gated on a token no page has unless a scan sent it
   here, so the pages outside the test stay silent on their own.

   sendBeacon, not fetch: it survives the page being closed a second later,
   it needs no preflight, and there is nothing to wait for — the Worker
   answers 204 and the page has no use for it. */
function reportArrival() {
  const token = attribution.scanToken;
  if (!token) return false;

  /* No dedup guard here on purpose — see the note at the top. A reload sends
     a second ping and the Worker ignores it: the UPDATE only matches where
     landed_at IS NULL, so the arrival keeps its original timestamp and the
     count cannot be inflated by anyone hammering refresh. */
  const url = API_BASE + '/scan/land';
  const body = JSON.stringify({ s: token });

  try {
    /* text/plain keeps it a simple request: no OPTIONS, no round trip before
       the one that matters. The Worker parses the body as JSON regardless. */
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
      if (ok) return true;
      /* sendBeacon returns false when the browser refuses to queue it — over
         its size budget, or blocked. Fall through to fetch rather than losing
         the arrival. */
    }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: body,
      keepalive: true,
      mode: 'cors',
      credentials: 'omit',
    }).catch(() => { /* an unreported arrival costs one row of analytics */ });
    return true;
  } catch (e) {
    return false;
  }
}

export const arrived = reportArrival();
