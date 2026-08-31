/**
 * Render the email templates to HTML files and open them.
 *
 *   node scripts/preview-email.mjs            # every template, both states
 *   node scripts/preview-email.mjs welcome    # just one
 *
 * Renders to .preview/ (git-ignored). Image srcs are rewritten to the
 * local files so the marks show without deploying — the real send always
 * points at https://hellomin.app.
 *
 * This only checks the layout in a browser. A browser is a far more
 * capable renderer than Outlook or Gmail, so treat a clean preview as
 * "the content is right", not "it renders everywhere".
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { TEMPLATES } from '../src/emails.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../.preview');
const assets = resolve(here, '../../assets/img');

// Each case is a name and the data a real send would carry. Both states of
// every optional field, so the preview covers the branches — a missing name
// is the one the waitlist actually ships with, since the QR page asks only
// for an address.
const CASES = {
  welcome: [
    ['welcome', { name: 'Aino' }],
    ['welcome-no-name', {}],
  ],
  welcomeWithSurvey: [
    ['welcome-survey', { name: 'Aino', surveyUrl: 'https://example.com/survey' }],
    ['welcome-survey-no-name', { surveyUrl: 'https://example.com/survey' }],
  ],
};

const only = process.argv[2];
mkdirSync(outDir, { recursive: true });

const written = [];
for (const [template, cases] of Object.entries(CASES)) {
  if (only && only !== template) continue;
  if (!TEMPLATES[template]) throw new Error(`No such template: ${template}`);

  for (const [label, data] of cases) {
    const { subject, html, text } = TEMPLATES[template](data);
    // Point every image at the local file so the marks show without deploying.
    const local = html.replaceAll(
      /https:\/\/hellomin\.app\/assets\/img\/([\w.-]+)/g,
      (_, file) => `file://${assets}/${file}`,
    );

    const htmlPath = resolve(outDir, `${label}.html`);
    writeFileSync(htmlPath, local);
    writeFileSync(resolve(outDir, `${label}.txt`), `Subject: ${subject}\n\n${text}`);
    written.push(htmlPath);
    console.log(`${label}\n  subject: ${subject}\n  ${htmlPath}\n  ${htmlPath.replace(/\.html$/, '.txt')}`);
  }
}

if (!written.length) throw new Error(`Nothing rendered${only ? ` for "${only}"` : ''}.`);
if (process.platform === 'darwin') execFile('open', written);
