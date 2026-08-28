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
 * on: nested tables, inline styles, no CSS file, no gradients, no SVG. The
 * tokens are lifted from assets/css/tokens.css by value (a mail client has
 * no custom properties), and they are listed once in PALETTE below so a
 * re-theme is one edit rather than a hunt through markup.
 *
 * What survives everywhere: the warm ground, the cream resin card, the ink,
 * the violet accent, the rounded button. What degrades gracefully: rounded
 * corners and shadows (Outlook squares them off — the layout still reads).
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
  ground: '#E3DBD0',      // --world-grad2 — the warm world behind the card
  card: '#FAF7F2',        // --resin-light — the resin surface
  rim: '#EFE8DD',         // the card's lit edge, faked as a border
  ink: '#23211E',         // --ink-primary
  inkSoft: '#6D6861',     // --ink-secondary
  inkFaint: '#938C80',    // --ink-tertiary
  violetInk: '#7A5A94',   // --violet-ink — the accent at text weight
  violetFill: '#DCC7EC',  // --violet at button strength over cream
  violetEdge: '#C9A8E0',  // --violet
  hair: '#EAE4DA',        // --color-border
};

// Nunito is the site's face. Mail clients will not fetch it, so the stack
// falls through to the rounded system faces the comps were drawn in.
const FONT = "'Nunito','SF Pro Rounded',ui-rounded,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const P = `margin:0 0 18px;font-size:16px;line-height:1.65;color:${PALETTE.ink};`;

/**
 * The shell every message sits in: warm ground, centred cream card, the
 * wordmark, the content, then the footer.
 *
 * `blocks` is raw HTML — the caller has already escaped anything that came
 * from a person. Capped at 600px — the one width every client, Outlook's
 * Word renderer included, lays out the same.
 */
function layout({ preheader, blocks, footer }) {
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
    .pad-top { padding-top:32px !important; }
    .pad-bottom { padding-bottom:32px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${PALETTE.ground};-webkit-font-smoothing:antialiased;">

<!-- The preview line in the inbox list. Hidden in the message itself. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:${PALETTE.ground};">
  <tr>
    <td align="center" style="padding:40px 16px;">

      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <!-- width="100%" + max-width, not width="600": the attribute is not a
           CSS property, so a phone can't shrink it and the card would run
           off the side of the screen. Outlook, which ignores max-width, gets
           the fixed 600 from the conditional table above instead. -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="width:100%;max-width:600px;">

        <!-- ── the card ───────────────────────────────────────────
             One resin surface, as on every page of the site: cream,
             a lit rim, a soft contact shadow, generously rounded. -->
        <tr>
          <td style="background:${PALETTE.card};border:1px solid ${PALETTE.rim};border-radius:28px;
                     padding:0;box-shadow:0 20px 45px -16px rgba(15,13,20,0.16);">

            <!-- the mark -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" class="pad pad-top" style="padding:40px 32px 8px;">
                  <img src="${SITE}/assets/img/min-logo-email.png" width="104" height="59" alt="Min"
                       style="display:block;border:0;width:104px;height:59px;">
                </td>
              </tr>
              <tr>
                <td class="pad pad-bottom" style="padding:16px 40px 40px;font-family:${FONT};">
                  ${blocks}
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ── the footer, outside the card, on the ground ────── -->
        <tr>
          <td align="center" style="padding:24px 24px 8px;font-family:${FONT};
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
 * The site's button, flattened: a pill with ink on it. Built as a table
 * because Outlook ignores padding on an <a>, so an <a>-only button
 * collapses to a bare link there.
 *
 * Two weights, and the message only ever gets one of each: `primary` is
 * the violet fill, `secondary` is the same pill left clear. Two filled
 * violet buttons in one message read as two equal asks — and the survey
 * is explicitly the optional one.
 */
function button(href, label, variant = 'primary') {
  const fill = variant === 'primary' ? PALETTE.violetFill : PALETTE.card;
  const edge = variant === 'primary' ? PALETTE.violetEdge : PALETTE.hair;
  const ink = variant === 'primary' ? PALETTE.ink : PALETTE.violetInk;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px;">
  <tr>
    <td align="center" bgcolor="${fill}"
        style="border-radius:999px;border:1px solid ${edge};">
      <a href="${href}" target="_blank"
         style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:16px;
                font-weight:700;color:${ink};text-decoration:none;border-radius:999px;">${label}</a>
    </td>
  </tr>
</table>`;
}

// A quiet horizontal rule — the divider the site uses between a card's
// content and the aside underneath it.
const RULE = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="margin:28px 0;"><tr><td style="height:1px;line-height:1px;font-size:0;
  background:${PALETTE.hair};">&nbsp;</td></tr></table>`;

/**
 * The catalogue. Key it by a short slug; that slug is what callers pass to
 * sendEmail. Each entry takes whatever data it needs and returns the three
 * parts of a message.
 */
export const TEMPLATES = {
  /**
   * Sent the moment a real new row lands in `signups` (see index.js). Says
   * three things and stops: thank you, when Min opens, and — only if a
   * survey is configured — one optional way to help shape it.
   *
   * `surveyUrl` is optional on purpose. index.js passes env.SURVEY_URL, so
   * with nothing configured the section simply isn't rendered and the mail
   * is still complete.
   */
  welcome: ({ name, surveyUrl }) => {
    // A waitlist row can have no name (see index.js — the QR page asks only
    // for an address), so the greeting has to stand on its own without one.
    const rawName = name ? String(name).trim() : '';
    const hi = rawName ? `Hi ${escapeHtml(rawName)},` : 'Hi,';
    const hiText = rawName ? `Hi ${rawName},` : 'Hi,';

    const survey = surveyUrl
      ? `${RULE}
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.06em;
                text-transform:uppercase;color:${PALETTE.violetInk};">If you have two minutes</p>
      <p style="${P}">We're still deciding what Min should do first. A few questions — completely optional, and it genuinely changes what we build.</p>
      ${button(escapeHtml(surveyUrl), 'Answer a few questions', 'secondary')}`
      : '';

    return {
      subject: "You're on the Min waitlist",

      // The plain-text half. Not a fallback nobody reads — it is what a
      // watch, a screen reader and a text-only client show, so it carries
      // the same three things in the same order.
      text: `${hiText}

Thanks for joining the Min waitlist. You're in.

WHEN
Min opens for Helsinki area students in early 2027. You'll get one email the moment early beta spots open — nothing before that.

WHAT MIN IS
An introduction, not a feed. Min notices the people, groups and moments already around you, and quietly makes the introduction.
${SITE}
${surveyUrl ? `
IF YOU HAVE TWO MINUTES
We're still deciding what Min should do first. A few questions — completely optional, and it genuinely changes what we build.
${surveyUrl}
` : ''}
— the Min team

You're getting this because you joined the waitlist at hellomin.app.
Privacy policy: ${SITE}/privacy-policy/`,

      html: layout({
        preheader: "You're in. Min opens for Helsinki area students in early 2027.",
        blocks: `
      <p style="${P}">${hi}</p>

      <p style="margin:0 0 18px;font-size:22px;line-height:1.35;font-weight:700;
                letter-spacing:-0.02em;color:${PALETTE.ink};">Thanks for joining — you're on the list.</p>

      <p style="${P}">You're one of the first, and that's the part that matters: the early list is who Min gets built around.</p>

      <!-- ── the when ────────────────────────────────────────
           The single fact somebody opens this email for, given
           its own tinted panel so it survives a three-second
           read on a phone. -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="margin:6px 0 22px;">
        <tr>
          <td style="background:#F4EEF8;border:1px solid #E7DBF0;border-radius:20px;padding:20px 22px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0.06em;
                      text-transform:uppercase;color:${PALETTE.violetInk};">Launching</p>
            <p style="margin:0 0 6px;font-size:19px;line-height:1.35;font-weight:700;
                      color:${PALETTE.ink};">Early 2027, Helsinki</p>
            <p style="margin:0;font-size:15px;line-height:1.6;color:${PALETTE.inkSoft};">
              For students across the Helsinki area first. We'll email you the moment early beta spots
              open — and not before.</p>
          </td>
        </tr>
      </table>

      <p style="${P}">Until then, nothing is expected of you. Min is an introduction, not a feed: it notices
        the people, groups and moments already around you, and quietly makes the introduction.</p>

      ${button(SITE, 'See what Min does')}
      ${survey}
    `,
        footer: `You're getting this because you joined the waitlist at
          <a href="${SITE}" style="color:${PALETTE.inkSoft};text-decoration:underline;">hellomin.app</a>.<br>
          <a href="${SITE}/privacy-policy/" style="color:${PALETTE.inkFaint};text-decoration:underline;">Privacy policy</a>`,
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
