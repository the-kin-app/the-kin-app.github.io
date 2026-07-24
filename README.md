# Kin — marketing site

Static site (plain HTML/CSS/JS, no build step) served from the domain root.
Deployed via GitHub Pages (`CNAME`). A Cloudflare Worker + D1 handles
waitlist submissions.

## Structure

```
/
├── index.html              Homepage (logo + description + CTA)
├── waitlist/index.html     Waitlist signup form
├── privacy-policy/index.html
├── qr/index.html           QR code that links to the waitlist
├── assets/
│   ├── css/
│   │   ├── tokens.css       Design tokens (colors, type, spacing, radius) ← Figma variables map here
│   │   ├── base.css         Reset, document defaults, layout primitives
│   │   └── components.css   Reusable UI blocks (card, form, buttons, hero, prose, qr…)
│   ├── js/
│   │   └── waitlist.js      Waitlist form validation + submission
│   ├── img/
│   │   ├── logo.png         Kin wordmark
│   │   ├── card.svg         Waitlist card vector (Figma export)
│   │   └── bg-waitlist.jpg  Hero background photo
│   └── favicon.svg          Placeholder favicon
├── worker/                 Cloudflare Worker + D1 waitlist API (see worker/README.md)
└── CNAME
```

All asset paths are **absolute** (`/assets/...`), so pages work at any depth.

## Design system & the Figma → code workflow

The site is token-driven so a designer can own the visual layer without
touching page markup:

1. **Tokens are the single source of truth.** Every color, font size, spacing
   step, and radius lives in `assets/css/tokens.css` as a CSS custom property.
   These are named to mirror **Figma Variables** 1:1 (e.g. Figma
   `Color/accent` → `--color-accent`, `Radius/lg` → `--radius-lg`).
2. **Components reference only tokens** — never hard-coded values. Class names
   in `components.css` (`.card`, `.btn`, `.input`, `.segmented`, `.hero__*`,
   `.prose`) each correspond to a Figma component of the same name.
3. **To re-theme:** export updated variable values from Figma and paste them
   into `tokens.css`. No other file needs to change.
4. **To restyle a component:** edit its block in `components.css`.
5. **New component from Figma:** add its class to `components.css` using
   existing tokens, then use the class in the relevant page.

When generating code from Figma (Figma → code / Dev Mode / MCP), map the
output onto these tokens and component classes rather than emitting inline
styles, so everything stays consistent and maintainable.

### Replacing assets

- `assets/img/logo.png`, `assets/img/card.svg`, and `assets/img/bg-waitlist.jpg`
  come straight from the Figma "Waitlist (using components)" frame. Re-export
  and drop in at the same paths to update them; `assets/favicon.svg` is still
  a placeholder.

## Local preview

```bash
python3 -m http.server 8000      # from the repo root
# open http://localhost:8000
```

For the waitlist form to submit locally, run the Worker and point the form at
it (see `worker/README.md`): set `window.KIN_API_BASE` before `waitlist.js`
loads.

## Backend

The waitlist API (validation, D1 storage, rate limiting, and other security
measures) is a Cloudflare Worker in `worker/`. See `worker/README.md`.
