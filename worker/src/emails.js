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
 */

const FROM = 'Min <hello@hellomin.app>';

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Wraps a template's paragraphs in the shared shell, so a new template
// writes content and inherits the look. Plain inline-styled HTML: email
// clients are a decade behind on CSS, and this has to render in all of them.
function layout(paragraphs) {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;">${p}</p>`)
    .join('');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:520px;">${body}</div>`;
}

/**
 * The catalogue. Key it by a short slug; that slug is what callers pass to
 * sendEmail. Each entry takes whatever data it needs and returns the three
 * parts of a message.
 */
export const TEMPLATES = {
  welcome: ({ name }) => ({
    subject: "You're on the Min waitlist",
    text: `Hi ${name},\n\nThanks for joining the Min waitlist. We'll email you as soon as early beta spots open up — Helsinki, early 2027.\n\n— the Min team`,
    html: layout([
      `Hi ${escapeHtml(name)},`,
      "Thanks for joining the Min waitlist. We'll email you as soon as early beta spots open up — Helsinki, early 2027.",
      '— the Min team',
    ]),
  }),
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
