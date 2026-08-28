/**
 * Render the email templates to HTML files and open them.
 *
 *   node scripts/preview-email.mjs            # every template, both states
 *   node scripts/preview-email.mjs welcome    # just one
 *
 * Renders to .preview/ (git-ignored). The logo src is rewritten to the
 * local file so the mark shows without deploying — the real send always
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
const logo = resolve(here, '../../assets/img/min-logo-email.png');

// Each case is a name and the data a real send would carry. Both states of
// every optional field, so the preview covers the branches — a missing name
// and a missing survey are the two the welcome mail actually ships with.
const CASES = {
  welcome: [
    ['welcome-full', { name: 'Aino', surveyUrl: 'https://example.com/survey' }],
    ['welcome-no-name-no-survey', {}],
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
    const local = html.replaceAll('https://hellomin.app/assets/img/min-logo-email.png', `file://${logo}`);

    const htmlPath = resolve(outDir, `${label}.html`);
    writeFileSync(htmlPath, local);
    writeFileSync(resolve(outDir, `${label}.txt`), `Subject: ${subject}\n\n${text}`);
    written.push(htmlPath);
    console.log(`${label}\n  subject: ${subject}\n  ${htmlPath}\n  ${htmlPath.replace(/\.html$/, '.txt')}`);
  }
}

if (!written.length) throw new Error(`Nothing rendered${only ? ` for "${only}"` : ''}.`);
if (process.platform === 'darwin') execFile('open', written);
