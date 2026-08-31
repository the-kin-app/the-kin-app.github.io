/**
 * Transactional email templates + the Resend send helper.
 *
 * One place for every message the Worker sends, so adding a new one is
 * adding a key to TEMPLATES — never touching the send path or index.js.
 *
 * A template is a pure function: data in, { subject, text, html } out. It
 * does no I/O and knows nothing about Resend, which makes each one trivial
 * to eyeball or unit-test. Escaping happens inside the template, on the way
 * into the HTML half; the text half stays raw on purpose.
 *
 * Sending is fire-and-forget by design — see sendEmail. Callers pass it to
 * ctx.waitUntil so a slow or failed send never delays or fails the request
 * that triggered it: a person on the list is the thing that matters.
 *
 * ── On the design ──────────────────────────────────────────────────────
 * The look is the site's, rebuilt in the subset of HTML mail clients agree
 * on: nested tables, inline styles, no CSS file, no SVG, no backdrop blur.
 *
 * The site's daylight, not its cave. landing.js lerps the world from the
 * cave out into the light and back, and this takes the light end: the cream
 * page ground, the wordmark floating on it, and one resin card holding what
 * is being asked. The order is the site's own — mark, the when, card,
 * footer — so the mail reads as the next screen after /waitlist/ rather than
 * a receipt from somewhere else.
 *
 * Two things the site does that mail cannot: the resin is translucent (here
 * it is flattened to the cream it averages to over a light ground, with a
 * lit rim faked as a near-white border), and the buttons mix violet live
 * under the cursor (here they are frozen at their rest value — a pale warm
 * mauve, not a slab of violet; the accent is a light in this system, never
 * a fill).
 *
 * The tokens are lifted from assets/css/tokens.css by value — a mail client
 * has no custom properties — and listed once in PALETTE below, so a
 * re-theme is one edit rather than a hunt through markup.
 *
 * What survives everywhere: the cream ground, the resin card, the ink, the
 * violet accent, the rounded pill. What degrades gracefully: the ground's
 * gradient (Outlook gets the flat cream), rounded corners and shadows
 * (Outlook squares them off — the layout still reads).
 */

const FROM = 'Min <hello@hellomin.app>';
const SITE = 'https://hellomin.app';

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// The site's tokens, flattened to literal values. Mail clients strip
// <style> often enough that every colour has to be inlined at the point of
// use; naming them here keeps that from becoming forty magic hex strings.
const PALETTE = {
  // The world at its light end — the three stops of --gradient-page-bg,
  // which is the ground the site gives anything without the live scroll
  // atmosphere behind it.
  ground: '#F0EBE2',      // --world-grad1
  groundMid: '#E9E2D7',   // between grad1 and grad2 — the gradient's middle
  groundFar: '#DFD7C9',   // --world-grad3
  // Ink on the ground. Warm, per tokens.css: violet is the only cool note.
  ink: '#23211E',         // --ink-primary
  inkSoft: '#6D6861',     // --ink-secondary
  inkFaint: '#938C80',    // --ink-tertiary
  // The resin card. Over a light ground the wash resolves to cream, so
  // here the canonical --resin-light is the honest flattening; the pebble
  // inside it goes a step warmer so it still reads as its own object.
  card: '#FAF7F2',        // --resin-light
  pebble: '#F3EDE3',      // --resin-base, warmed — the secondary pill's fill
  rim: '#FFFFFF',         // the card's lit edge, faked as a border
  violetInk: '#7A5A94',   // --violet-ink — the accent at text weight
  // The primary button's rest fill. The site mixes --gradient-interactive
  // at 34% over a pale resin wash; this is what that actually resolves to.
  // A saturated violet here would read as a slab and break the rule that
  // the accent is a light.
  violetRest: '#E2D5E9',
  violetEdge: '#D0BBDE',
  hair: '#E4DDD1',        // the rule inside resin
};

// Nunito is the site's face. Mail clients will not fetch it, so the stack
// falls through to the rounded system faces the comps were drawn in.
const FONT = "'Nunito','SF Pro Rounded',ui-rounded,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

// Typography, lifted from the site rather than from email defaults. Min is
// set semibold with tight tracking and fairly tight leading — 700 at 1.65
// reads as a newsletter, which is the one thing this must not look like.
// Body copy takes the secondary ink: the heading is the only thing in full
// strength, which is how every card on the site is weighted.
const P_SOFT = `margin:0 0 16px;font-size:16px;line-height:1.55;letter-spacing:-0.01em;color:${PALETTE.inkSoft};`;
// The eyebrow over a pebble. Uppercase and small, and the only place the
// violet appears as text.
const EYEBROW = `margin:0 0 5px;font-size:12px;font-weight:700;letter-spacing:0.08em;`
  + `text-transform:uppercase;color:${PALETTE.violetInk};`;

/**
 * The shell every message sits in, in the site's own order: the mark on the
 * dark world, the one line that has to survive a glance, the resin card, and
 * the footer back out on the ground.
 *
 * `blocks` is raw HTML — the caller has already escaped anything that came
 * from a person. `standfirst` is the line under the mark, on the ground, and
 * is optional. Capped at 600px — the one width every client, Outlook's Word
 * renderer included, lays out the same.
 */
function layout({ preheader, standfirst = '', blocks, footer }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Min</title>
<!-- Progressive enhancement only. Every rule here has an inline default
     that already reads correctly; a client that strips <style> (some do)
     just gets the desktop padding on a phone, which is survivable. -->
<style>
  @media only screen and (max-width:600px) {
    .pad { padding-left:24px !important; padding-right:24px !important; }
    .pad-top { padding-top:28px !important; }
    .pad-bottom { padding-bottom:28px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${PALETTE.groundFar};-webkit-font-smoothing:antialiased;">

<!-- The preview line in the inbox list. Hidden in the message itself. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>

<!-- ── the world ─────────────────────────────────────────────
     The cream ground, warming as it falls — the site's --gradient-page-bg
     at the same 160deg. bgcolor carries the colour everywhere; the gradient
     is pure decoration, and Outlook drops background-image and gets the flat
     cream, which is the top of that gradient anyway. -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       bgcolor="${PALETTE.ground}"
       style="background-color:${PALETTE.ground};
              background-image:linear-gradient(160deg, ${PALETTE.ground} 0%, ${PALETTE.groundMid} 45%, ${PALETTE.groundFar} 100%);">
  <tr>
    <td align="center" style="padding:44px 16px 40px;">

      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <!-- width="100%" + max-width, not width="600": the attribute is not a
           CSS property, so a phone can't shrink it and the card would run
           off the side of the screen. Outlook, which ignores max-width, gets
           the fixed 600 from the conditional table above instead. -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="width:100%;max-width:600px;">

        <!-- ── the mark, and the when ────────────────────────────
             Small, as on the site: a signature, not a hero. The ink
             lockup, because it is sitting out on the cream ground. -->
        <tr>
          <td align="center" style="padding:0 24px 14px;">
            <img src="${SITE}/assets/img/min-logo-email.png" width="120" height="68" alt="Min"
                 style="display:block;border:0;width:120px;height:68px;">
          </td>
        </tr>
        ${standfirst ? `<tr>
          <td align="center" style="padding:0 24px 26px;font-family:${FONT};
                     font-size:15px;line-height:1.4;font-weight:600;letter-spacing:-0.01em;
                     color:${PALETTE.inkSoft};">
            ${standfirst}
          </td>
        </tr>` : ''}

        <!-- ── the card ───────────────────────────────────────────
             One resin surface, as on every page of the site: cream, a lit
             rim, the soft contact shadow of --shadow-card, generously
             rounded. -->
        <tr>
          <td bgcolor="${PALETTE.card}"
              style="background-color:${PALETTE.card};border:1px solid ${PALETTE.rim};border-radius:28px;
                     padding:0;box-shadow:0 2px 3px rgba(15,13,20,0.10), 0 20px 45px -16px rgba(15,13,20,0.18);">

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="pad pad-top pad-bottom" style="padding:38px 40px;font-family:${FONT};">
                  ${blocks}
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ── the footer, outside the card, back on the ground ── -->
        <tr>
          <td align="center" style="padding:26px 24px 4px;font-family:${FONT};
                     font-size:13px;line-height:1.6;color:${PALETTE.inkFaint};">
            ${footer}
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->

    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * The site's button, flattened: a pale resin pill with warm near-black on
 * it. Built as a table because Outlook ignores padding on an <a>, so an
 * <a>-only button collapses to a bare link there.
 *
 * Two weights, and the message only ever gets one of each. `primary` is the
 * pill with the violet already mixed into it at its rest value — on the site
 * that light follows the cursor, and a mail has no cursor, so it is frozen
 * where the site leaves it. `secondary` is the same pill left clear, with the
 * accent moved into the label. Two primaries in one message read as two
 * equal asks, and the survey is explicitly the optional one.
 *
 * The arrow is the site's — every Min button that goes somewhere carries one.
 */
function button(href, label, variant = 'primary') {
  const fill = variant === 'primary' ? PALETTE.violetRest : PALETTE.pebble;
  const edge = variant === 'primary' ? PALETTE.violetEdge : PALETTE.hair;
  const ink = variant === 'primary' ? PALETTE.ink : PALETTE.violetInk;
  // A real lift, not a slab: the site's buttons are objects with a lit top
  // edge and a shadow under them. Outlook drops both and gets a flat pill.
  const lift = variant === 'primary'
    ? 'box-shadow:inset 0 1.5px 0 #FFFFFF, 0 2px 2px rgba(15,13,20,0.08), 0 10px 20px -10px rgba(15,13,20,0.28);'
    : 'box-shadow:inset 0 1.5px 0 #FFFFFF;';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 4px;">
  <tr>
    <td align="center" bgcolor="${fill}"
        style="background-color:${fill};border-radius:999px;border:1px solid ${edge};${lift}">
      <a href="${href}" target="_blank"
         style="display:inline-block;padding:15px 28px;font-family:${FONT};font-size:16px;
                font-weight:600;letter-spacing:-0.01em;color:${ink};text-decoration:none;
                border-radius:999px;white-space:nowrap;">${label}&nbsp;&nbsp;<span style="color:${ink};">&rarr;</span></a>
    </td>
  </tr>
</table>`;
}

// A quiet horizontal rule — the divider the site uses between a card's
// content and the aside underneath it. Inside resin, so it is the warm hair
// line, not the cream one the dark ground uses.
const RULE = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="margin:30px 0;"><tr><td style="height:1px;line-height:1px;font-size:0;
  background:${PALETTE.hair};">&nbsp;</td></tr></table>`;

/**
 * The greeting, which has to work with and without a name. A waitlist row
 * can have none (see index.js — the QR page asks only for an address), so
 * this never leans on one.
 */
function greeting(name) {
  const raw = name ? String(name).trim() : '';
  return { hi: raw ? `Hi ${escapeHtml(raw)},` : 'Hi,', hiText: raw ? `Hi ${raw},` : 'Hi,' };
}

/**
 * The body both welcome mails share: hello, you're on the list, one line
 * about what happens next, and the way on to the site. Deliberately short —
 * somebody who has just handed over an address wants confirmation, not a
 * briefing, and the site is one tap away for the rest.
 *
 * `aside` is raw HTML appended inside the card, under a rule. The plain
 * welcome passes nothing; the survey version passes its ask.
 */
function welcomeBody({ hi, aside = '' }) {
  return `
      <p style="margin:0 0 10px;font-size:16px;line-height:1.5;letter-spacing:-0.01em;
                color:${PALETTE.inkSoft};">${hi}</p>

      <!-- The heading the done-view on /waitlist/ ends on, so the mail picks
           up mid-sentence from the screen they just left. -->
      <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;font-weight:600;
                 letter-spacing:-0.03em;color:${PALETTE.ink};">You&rsquo;re on the list.</h1>

      <p style="${P_SOFT}">Thanks for signing up. We&rsquo;ll let you know the moment Min launches
        &mdash; and nothing before that.</p>

      ${button(SITE, 'See what Min does')}
      ${aside}
    `;
}

const FOOTER = `You&rsquo;re getting this because you joined the waitlist at
  <a href="${SITE}" style="color:${PALETTE.inkSoft};text-decoration:underline;">hellomin.app</a>.<br>
  <a href="${SITE}/privacy-policy/" style="color:${PALETTE.inkFaint};text-decoration:underline;">Privacy policy</a>`;

// The line under the mark, out on the world. Word for word the one on
// /waitlist/, because somebody who is not a Helsinki student should learn
// that in the first second, here as there.
const STANDFIRST = 'Launching for all Helsinki area students in early 2027';

const PREHEADER = "You're in. Min opens for Helsinki area students in early 2027.";

const SUBJECT = "You're on the Min waitlist";

const TEXT_FOOTER = `— the Min team

You're getting this because you joined the waitlist at hellomin.app.
Privacy policy: ${SITE}/privacy-policy/`;

/**
 * The catalogue. Key it by a short slug; that slug is what callers pass to
 * sendEmail. Each entry takes whatever data it needs and returns the three
 * parts of a message.
 */
export const TEMPLATES = {
  /**
   * Sent the moment a real new row lands in `signups` (see index.js). Says
   * one thing and stops: you're on the list, and we'll write when it opens.
   */
  welcome: ({ name }) => {
    const { hi, hiText } = greeting(name);
    return {
      subject: SUBJECT,

      // The plain-text half. Not a fallback nobody reads — it is what a
      // watch, a screen reader and a text-only client show, so it carries
      // the same thing in the same order.
      text: `${hiText}

You're on the list.

Thanks for signing up. We'll let you know the moment Min launches — and
nothing before that.

An introduction, not a feed. Min notices the people, groups and moments
already around you, and quietly makes the introduction.
${SITE}

${TEXT_FOOTER}`,

      html: layout({
        preheader: PREHEADER,
        standfirst: STANDFIRST,
        blocks: welcomeBody({ hi }),
        footer: FOOTER,
      }),
    };
  },

  /**
   * The same mail with one thing added: the survey, and the patch that comes
   * with it. index.js picks this key only when SURVEY_URL is configured, so
   * the ask can never link somewhere broken.
   *
   * The ask sits under a rule, in the secondary button weight, and the patch
   * is named in it — a physical thing you collect on your own campus is the
   * whole reason somebody answers, so it does not get buried in a postscript.
   */
  welcomeWithSurvey: ({ name, surveyUrl }) => {
    const { hi, hiText } = greeting(name);
    const url = escapeHtml(surveyUrl);
    return {
      subject: SUBJECT,

      text: `${hiText}

You're on the list.

Thanks for signing up. We'll let you know the moment Min launches — and
nothing before that.

An introduction, not a feed. Min notices the people, groups and moments
already around you, and quietly makes the introduction.
${SITE}

HELP SHAPE HOW MIN WILL WORK
If you're interested in helping us make this product better, please fill in
this survey. As a thanks you'll get a special Min patch, which you can pick
up from your campus.
${surveyUrl}

${TEXT_FOOTER}`,

      html: layout({
        preheader: PREHEADER,
        standfirst: STANDFIRST,
        blocks: welcomeBody({
          hi,
          aside: `${RULE}
      <p style="${EYEBROW}">Help shape how Min will work</p>
      <p style="${P_SOFT}">If you&rsquo;re interested in helping us make this product better, please fill in
        this survey. As a thanks you&rsquo;ll get a special Min patch, which you can pick up from
        your campus.</p>
      ${button(url, 'Fill in the survey', 'secondary')}`,
        }),
        footer: FOOTER,
      }),
    };
  },
};

/**
 * Render one template and hand it to Resend.
 *
 * Never throws: an unknown template, a missing API key, a network blip and
 * a 4xx from Resend all end the same way — logged, and the caller carries
 * on. Nothing here is allowed to cost a signup.
 */
export async function sendEmail(env, { to, template, data = {} }) {
  if (!env.RESEND_API_KEY) return; // not configured — skip silently

  const render = TEMPLATES[template];
  if (!render) {
    console.error('Unknown email template:', template);
    return;
  }

  const { subject, text, html } = render(data);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: env.EMAIL_FROM || FROM, to, subject, text, html }),
    });
    if (!res.ok) console.error('Resend send failed:', template, res.status, await res.text());
  } catch (err) {
    console.error('Resend send threw:', template, err);
  }
}
