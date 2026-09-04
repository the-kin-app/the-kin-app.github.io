# Handoff — open problems on the resin wordmark / Min rebuild

Context for whoever picks this up: this repo (`the-kin-app.github.io`, static
site, GitHub Pages) has been getting a redesign pass — the homepage/waitlist
wordmark swapped from a CSS-mask glass effect to an inlined "Min · Resin"
SVG with a forming animation, and Min himself was rebuilt from Figma node
`598:356` ("MIN · idle breathe", file `PmauZKhA4iyowYabC3XOJE`) with exact
geometry pulled via Figma MCP. **A second Claude session has also been
editing this repo in parallel** (visible in `git log` — commits like
"changes", "adjustments to slide", the Worker move to its own repo) and
independently touched some of the same components (page dots, the
`.dock-cta` button, cache-busting). Pull latest before starting — do not
assume the state described below is still current everywhere.

All changes described below are already pushed to `origin/main`. Run a
**hard refresh** (or private window) before judging anything — GitHub
Pages serves CSS/JS with long cache headers, and stale assets have caused
several false "it's not working" reports this session. Cache-busting is
now `?v=20260904` on the shared CSS/JS links in both `index.html` and
`waitlist/index.html` — bump that date on any further change to those
files, or the fix won't visibly land for returning visitors.

## Known-broken / needs another pass

### 1. Logo park-in motion — still not "right"
File: `assets/css/landing.css`, `@keyframes wm-park` and
`.wordmark--hero-resin` (also mirrored in `assets/css/waitlist-hero.css`
for `.wlq .wordmark--hero-resin`).

User's explicit spec, repeated several times: the WHOLE wordmark should
rise from below into its parked position with a **slow, dramatic ease —
not a snap, not overshoot**, and the letter-forming animation (edge → fill
→ flash) should only start once it's essentially landed, not while still
travelling. Current state uses hand-picked keyframe stops
(`0% → 220px, 45% → 62px, 75% → 14px, 100% → 0`) at 1500ms with
`ease-out` — user's last message said this "looks ass" and wanted a
"proper dramatic ease bezier" with a much slower park. **This needs an
actual authored cubic-bezier (not multi-stop keyframes) tuned by eye,
probably closer to 2000–2500ms, and should be checked against
`MOTION.md`/`KinLogo.swift` on the user's Desktop
(`~/Desktop/Min components/`) for the actual authored curve rather than
guessed.**

### 2. Logo emerge order — confirm it's really border-first now
User's spec, stated multiple times: **border/outline appears alone first
→ then a white flash washes over → flash fades to reveal the real
material fill.** Partway through this session the order regressed (flash
showing before/without a visible border stage) — this was traced to
scope/timing issues in `assets/css/landing.css`, specifically:
- `.wordmark-letter > path` (the rim/edge) vs `.wordmark-letter > g` (the
  fill) vs `.wordmark-flash` delays
- Verify the actual computed timeline before trusting the code — this
  session's own manual re-checks kept contradicting each other; a stray
  unterminated HTML comment (see #4) silently deleted large chunks of
  `min.js` earlier in the session and cost significant time before being
  found. **Grep the whole file for `<!--` / `-->` pairs and confirm every
  comment actually closes with `-->`, not `*/`, before assuming any
  animation code is broken** — that bug produced confusing, inconsistent
  symptoms that looked like several different problems.

### 3. Min rasterized / "looks like shit" (user's last words on it)
File: `assets/js/min.js`. This was reported fixed, then reported broken
again, then the render-pipeline bug (#4) was found and fixed, and no
screenshot was taken after that specific fix landed before the user ended
the session. **Take a fresh screenshot at both large (hero) and small
(nav/inline) sizes before doing anything else** — the rasterization
complaint may already be resolved as a side effect of #4, or may still be
open. If still visible: Min's silhouette is masked via `<mask id="mshell">`
in `min.js` (NOT `<clipPath>` — see #4 for why). Rasterization at small
sizes with masks is a known category of browser issue (the mask layer can
get rasterized at a fixed resolution and scaled); if it's still present,
look at whether the `feGaussianBlur` in `#fcore` (the eye core glow) or
`#minOutline` (dilate/composite outline filter) needs `x/y/width/height`
region tightened, or whether `shape-rendering` hints help.

### 4. [RESOLVED, but flagging the failure mode] Unterminated HTML comment
Root cause found and fixed: `assets/js/min.js` line ~54 had an HTML
comment closed with `*/` (JS-style) instead of `-->`. This silently
swallowed the entire `<mask>` definition, all gradients, filters, and the
outline group into one comment — nothing in that range ever reached the
DOM, but `getComputedStyle` on elements *outside* the swallowed range
still returned plausible-looking values, which is why this took many
rounds of contradictory diagnostics to isolate. **If Min ever goes
inexplicably invisible again with otherwise-sane-looking CSS**, the first
move should be: `python3 -c "import re; s=open('assets/js/min.js').read();
[print(m.start()) for m in re.finditer(r'<!--(.*?)-->', s, re.S) if '--' in
m.group(1)]"` — any unterminated/malformed HTML comment will show up
immediately. Also worth: `document.querySelectorAll('mask')` /
`querySelectorAll('clipPath')` from devtools to confirm expected element
counts actually exist in the live DOM, rather than trusting that valid
source implies valid render.

### 5. Two competing wordmark implementations on `/waitlist/`
The merge conflict on `waitlist/index.html` resolved by keeping this
session's version (inlined animated SVG, matching the homepage). The
OTHER session's version — visible in `git log` / reflog if needed — used a
plain `<img src="/assets/img/min-logo-resin-no-dot.svg">` instead, with a
comment noting the CSS-glass approach "came out grey" at this size. That
`<img>` approach has no forming/park/flash animation at all, which
contradicts what the user asked for repeatedly, so it was NOT kept — but
whoever picks this up should be aware both approaches exist in history and
confirm which one the user actually wants going forward, especially if the
animated version continues to be troublesome.

### 6. Card restacking per new Figma spec — not started
User provided three Figma node links for a redesign of the homepage
"01 Leave a memo" / `.not` cards section, including a full ChatGPT-authored
motion spec (scroll-scrubbed cascade, pebble geometry, milky-resin
material, non-cascading page dots analog). Figma MCP was unavailable in
this session the whole time it was needed. Links:
- `https://www.figma.com/design/PmauZKhA4iyowYabC3XOJE/Min-app?node-id=603-1112`
- `https://www.figma.com/design/PmauZKhA4iyowYabC3XOJE/Min-app?node-id=673-1409`
- `https://www.figma.com/design/PmauZKhA4iyowYabC3XOJE/Min-app?node-id=616-366`

This is a genuinely large net-new feature (scroll-driven multi-phase
composition), not a small fix — budget accordingly.

### 7. Waitlist slide text transition direction
User asked for slide text to enter/exit left-to-right (matching
`CardBook.swift`'s row-cascade / two-phase OUT-then-IN pattern) rather
than whatever the `.hslides__track` carousel currently does. Not
addressed — the carousel does already slide the whole slide (figure +
text) horizontally via `transform: translateX`, so it's unclear what
specifically read as wrong. Needs the user to point at a concrete example
or a closer read of `CardBook.swift` on the Desktop.

## Reference material already in place

- `.claude/skills/min-design-specs/SKILL.md` — maps "add motion" / "what's
  the color" type asks to the right file in
  `~/Desktop/Min components/` (`MOTION.md`, `MATERIAL.md`, `SCALING.md`,
  `Components/*.swift`). Load this before touching any Min/Kin component.
- `assets/img/min-character/` — raw SVG assets pulled from Figma for
  Min's shell/eyes/specular/shadow (source material, not directly wired
  into the live page — `min.js` reimplements the geometry inline instead).
