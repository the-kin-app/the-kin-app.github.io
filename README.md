# Kin — marketing site

Static site (plain HTML/CSS/JS, no build step) served from the domain root.
Deployed via GitHub Pages (`CNAME`). A Cloudflare Worker + D1 handles
waitlist submissions.

## Structure

```
/
├── index.html              Homepage — the long-form landing page (see below)
├── pitchdeck/index.html    The public pitch deck — swipeable slides (see below)
├── waitlist/index.html     The scan page — a three-slide banner + one-field signup, all above the fold
├── privacy-policy/index.html
├── qr/index.html           QR code that links to the waitlist
├── assets/
│   ├── css/
│   │   ├── tokens.css       Design tokens (colors, type, spacing, radius) ← mirrors KinTokens.swift / Figma `Kin tokens`
│   │   ├── base.css         Reset, document defaults, layout primitives
│   │   ├── components.css   Reusable UI blocks (card, form, buttons, hero, prose, qr…)
│   │   ├── landing.css      Homepage only (does not load base/components)
│   │   ├── pitchdeck.css    Deck paging + per-slide figures; loads on top of landing.css
│   │   ├── waitlist.css     The waitlist card, form and inputs; loads on top of landing.css
│   │   └── waitlist-hero.css  The waitlist's three-slide banner + its no-scroll layout
│   ├── js/
│   │   ├── waitlist-hero.js The waitlist banner (auto-advance, swipe, dots) + its one-field form
│   │   ├── press.js         The submerge button press (shared by every page)
│   │   ├── min.js           Min himself: anatomy, the 5s morph loop, the gaze (shared)
│   │   ├── landing.js       Homepage: colour ramp, reveals, typewriter, constellation
│   │   ├── landing-scene.js WebGL atmosphere (three.js, ES module) — homepage + deck
│   │   └── pitchdeck.js     Deck: paging, palette, the ring's on-entry timeline
│   ├── img/
│   │   ├── kin-logos/       Logo assets (flat / gradient / glass) + their README
│   │   ├── kin-letters-mask.svg  Wordmark minus the i-dot; masks the glass hero logo
│   │   ├── logo.png         Kin wordmark
│   │   ├── card.svg         Waitlist card vector (Figma export)
│   │   ├── bg-world.jpg     The world — the app's own warm backdrop (far + near plates, composited)
│   │   └── bg-waitlist.jpg  Previous hero photo (unused; kept for reference)
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
   They mirror the app's `KinTokens.swift` (and through it the Figma `Kin
   tokens` collection) 1:1, with `/` becoming `-`: `color/ink/primary` →
   `--ink-primary`, `resin/pebble` → `--resin-pebble`. The old
   `--color-*` names are kept at the foot of the file as aliases onto the new
   ones, so existing pages re-theme without a rename pass; they are there to
   be deleted, not extended.
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

- `assets/img/logo.png` and `assets/img/card.svg` come straight from the Figma
  "Waitlist (using components)" frame. Re-export and drop in at the same paths
  to update them; `assets/favicon.svg` is still a placeholder.
- `assets/img/bg-world.jpg` is the app's own backdrop — `kin-bg-far` +
  `kin-bg-near` from `kin-app-designs`, composited over `--world-grad1` and
  flattened. Regenerate it from those plates rather than editing it.

## The homepage (`/`)

A long-form scroll narrative lit by one moving light source: it opens at the
back of the cave (`#2A2320 → #463A31`), breaks into daylight
(`#D6C5AC → #F0EBE2`) at the moment Min leaves the wordmark, and returns to the
cave at the closer — the app's world, seen end to end. It uses
`tokens.css` but not `base.css` / `components.css` — it has its own stylesheet
so it can't drag the rest of the site around.

### Brand rules it is built to

From `kin/samppa/creative direction` and the Kin Figma file. These are
constraints, not preferences — a "cool" landing page that breaks them is off
brand:

- **Materials, not effects.** Every surface is the one optical resin — a
  *thick translucent object*, not a tinted sheet: heavy `backdrop-filter` so the
  fog reads through it, `--edge-resin` for the lit top and dimmer bottom edges,
  `--bloom-resin` for the light trapped inside, and a specular sweep layered
  into the `background` itself. Because the material is a pale wash, a resin
  object carries dark ink in *both* lighting conditions and never re-themes —
  exactly how the Figma dark-gradient onboarding card behaves. Dark mode is the
  same identity lit from deeper in the cave, never a black void.
  - Anything sitting *on* an object is a **well sunk into it** (inset shadow, no
    border) rather than another pebble stacked on top. Same reason the nav's CTA
    is an inset well: an object inside an object reads as flat sheets.
  - The closer has **no card at all** — the closing line stands in the open air
    and the button is the only object, so the ending doesn't flatten.
- **Optics, not glow.** Real depth of field: each point's circle of confusion
  grows with its distance from the focal plane, and the ones near focus get a
  small hot core. Everything is *normal*-blended and fogged by depth
  (`fogAmount()`, shared by dots and threads) — additive neon bloom, radar grids
  and HUD lines are gone, since "excessive glow", "RGB lighting", "cyberpunk"
  and "gaming UI" are all on the explicit avoid list. On top of the WebGL there
  are three CSS fog banks drifting on 68–96s loops; you should never be able to
  point at one. Fine film grain is on the approved list and stays.
- **Surface tension, not springs.** Connection is shown two ways: people who
  drift close *gather* — pull fades out at very short range so pairs settle
  **touching** rather than collapsing through each other — and **thin threads of
  light** stretch between them, each with a soft pulse travelling end to end.
  Threads are 1px by definition in WebGL and vanish completely into fog, which
  is what keeps a whole field of them delicate instead of a network graph.
- **The reveal recipe is the Figma splash handoff's, to the number:** opacity
  0→1, scale 1.06→1, y +8→0, blur 5→0, `--duration-emergence` on
  `--ease-emergence`, cascaded `--stagger-cascade` apart. One after another,
  never a simultaneous bloom.
- **Min is the dot of the lowercase i.** He is already in the logo. The hero
  letterforms are **cast glass** — `kin-letters-mask.svg` (the wordmark minus the
  i-dot) masking a `backdrop-filter`, so the environment blurs *through* them —
  and Min occupies the dot's exact position (49.62% / 13.70% of the 216×136 box).
  He only detaches at the `#dawn` beat, so the visitor feels they discovered him
  rather than being introduced to a mascot.
  - **He is a creature, not a pebble.** A dome body cast in warm opal resin and
    lit from the inside, a short flappy ear at each shoulder, two foot nubs,
    two hot eyes. The light sits low and centred, because that is where it is
    trapped; the dome above it stays milky.
    - **His eyes sit high**, a little above his middle, per the turnaround
      sheet. Drawn low in the belly he reads as bottom-heavy and sad; up there
      the dome above them becomes forehead and the light pooling below becomes
      a body. `EYE` in `min.js` is the one place that position lives.
    - **The ears are ears, not arms** — short flaps at the shoulder, angled
      down and out, straddling the eye line and stopping there. The sort of
      thing that can become a wave, a point or a wing when he needs one. Run
      one down toward his feet and it stops reading as an ear.
  - **He carries the accent only in the small flat mark.** At any real size he
    is warm opal resin — the violet belongs to the logo's i-dot, not to him.
  - His body is **generated, not drawn** (`bodyPath()` / `earPath()`), morphing
    on an **exact 5s loop** — every harmonic is a whole multiple of the loop
    frequency, which is what makes it seamless rather than nearly-seamless.
    - The silhouette is a list of **anchor points with a stiffness weight** each,
      not a radius function: feet are not a harmonic, they have to be authored.
      The dome breathes at full amplitude and the feet barely move, because a
      creature whose feet wobbled like its head would read as a jelly.
    - The ears **bend, they do not swing**: every point rotates by the sway
      angle scaled by its distance from the root, so the tip travels furthest
      and the flap curves along its length. One angle for the whole outline is
      a paddle on a hinge. They also **trail the body by a beat**.
    - The whole figure **squashes and stretches conserving volume**, scaled
      about his feet rather than his centre — he settles onto the ground, he
      does not shrink toward his middle.
    - His eyes carry a slow 5s glow. **He never blinks.** Gaze follows the
      cursor with inertia.
  - Min is stamped into each host as real DOM by `minFigure()`. An `<svg><use>`
    would clone him into a shadow tree where per-instance CSS and gaze can't
    reach, and every copy would share one morph phase.
- **The accent never arrives alone.** The violet is always mixed live under the
  cursor (`--gradient-interactive`), pale into deep, so no surface is a slab of
  one accent. It appears on the i-dot in the flat mark, on the primary CTA, on
  Kinka, and on a pair in the field that has actually found each other.
  **Violet is the only cool note in Kin** — that is precisely why it reads as
  the accent, and why the ink is warm (`#23211E`) rather than cool graphite.
- **Buttons are pressable objects.** Press → the object *submerges*: sinks 3px,
  goes almost clear, drops its blur to 3px (wet), and keeps only a thin bright
  edge and its label — which switches to the page ink, because the material it
  was printed on is no longer there. A ripple spreads from the contact point.
  Release → it surfaces and the pale-into-deep violet fill floods in to say it's
  active. Layer order matters here: the fill sits at `z-index: 0` (*above* the
  element's own background, or the resin wash hides it) and labels are wrapped
  in `.btn__label` spans, since a bare text node can't be lifted above it.
- **Type** is `--font-rounded` (SF Pro Rounded, per the comps; `ui-rounded` on
  Apple platforms, Nunito as the web fallback) at Semibold — not bold, not black.

> **Accent history.** `Brand Book.md` once named the accent as *Coral Red /
> Vermilion / Poppy*, and the site shipped `#c15cdb` magenta for a while. Both
> are superseded: the app's settled tokens give **one** accent, violet
> `#C9A8E0`, at three levels. If it ever moves again it is a one-line change to
> `--violet` — nothing else hardcodes it.

### How it holds together

- **`--bg` and `--ink` are runtime variables.** `landing.js` lerps them along a
  colour ramp keyed to scroll progress; rules and hairlines are `color-mix`ed
  from `--ink`, so they re-theme for free. Resin surfaces deliberately sit
  *outside* the ramp — one material, both lighting conditions.
- **The loop section is an actual loop.** Four stations in a diamond grid
  around a dashed ring, with Kinka orbiting it — the orbit is a rotating
  container, not path maths, so it stays perfectly circular at any size. Below
  860px the ring disappears and the diamond straightens into an ordered list
  with the hub promoted to its heading, because a cramped diamond stops being a
  diagram.
- **The ramp's keyframes are derived from real section offsets**, not hardcoded
  fractions — so editing copy can't drift the sunrise into the middle of a
  paragraph. Rebuilt on resize.
- **`#dawn` and `#closer` are deliberately over-tall.** The two moments where
  `--bg` and `--ink` cross over are unavoidably low-contrast, so each is parked
  in a window where the screen holds no copy at all. **These windows are
  measured, not guessed** — `buildRamps()` records the current numbers (the dawn
  line clears at +0.554vh, the next copy enters at +0.77vh). If you change
  either section's height or padding, re-measure and retarget the flip, or the
  crossover lands on live text at ~2:1 contrast.
- **The nav opts out of the ramp entirely** — it's on screen at every scroll
  position, including both crossovers, so it keeps its own resin chrome and its
  own fixed graphite ink regardless of what the page is doing.
- **The WebGL atmosphere is a bonus, never a dependency.** three.js loads from a
  CDN via import map; if the fetch fails, or the visitor prefers reduced motion,
  the canvas is removed and the page still reads correctly.
- **New tokens are additive.** `tokens.css` gained the brand environments,
  `--gradient-resin`, resin shadows/blur, `--radius-pebble` / `--radius-resin`,
  `--font-rounded`, and the emergence timings. No existing value changed, so the
  other pages render exactly as before. They could adopt `--font-rounded` and
  the resin material next.

The previous single-screen splash (logo + tagline + CTA, built on
`base.css` / `components.css`) is still in git history if it's ever wanted
back — it was the `index.html` at commit `c8ffe30`.

## The pitch deck (`/pitchdeck`)

The public, short version of the pitch — eight slides, built out of the same
material system as the homepage rather than exported from a slide tool. It
loads `landing.css` first and `pitchdeck.css` on top, so a surface that needs
to be an object is `.resin`, a person is a `.blob`, a button is a `.btn`, and
Min is Min. The source of the outline is
`kin/Business/pitch deck (public).md`.

`pitchdeck/CLAUDE.md` is the working context for the deck — the invariants,
the add-a-slide template, and the preview/screenshot recipe. Read that before
editing in there.

**Editing it is markup, not code.** One `<section class="slide">` is one
slide; the toolbar, the dots, the counter, the progress hairline and the
palette all build themselves from what's in the document.

| Attribute / hook | What it does |
| --- | --- |
| `data-title` | the slide's name in the toolbar dot's tooltip |
| `data-bg` | that slide's background colour |
| `<p class="slot">` | **your space** — one empty paragraph per slide. Type into it and it appears; `.slot:empty` is `display: none`, so an unused one doesn't exist |
| `class="rise" data-delay="n"` | joins the emergence cascade, `n` steps in |

- **Paging is native, and it turns with the device.** The deck is a
  `scroll-snap` track — sideways on a desktop, **downwards on a phone**, the
  gesture each one already has — so swiping is the browser's own. The axis is
  a CSS decision at the 760px breakpoint; `pitchdeck.js` reads the same
  `matchMedia` query, so that number lives in both files and has to stay in
  step. The script only adds the keyboard (arrows, space, Home/End), a
  vertical wheel → page translation for the sideways track, the toolbar and a
  `#3`-style hash you can link to. Without it you can still drag through
  every slide.
- **The light moves with your thumb.** Each slide's `data-bg` is a stop on
  the same ramp the homepage scrolls through — cave, cave floor, first light,
  daylight, cave again — and the mix follows the scroll position rather than
  the settled slide, so the room changes *while* you swipe. `--ink` still
  picks itself by contrast, so a new slide colour needs no second edit.
  Check any colour you add: it wants ≥ 5:1 against one of the two inks.
- **Only the slide you're on is live.** The rest are `inert` — eight slides'
  worth of links in the tab order would scroll the track out from under a
  keyboard user — and the looping figures are gated on `.is-active`, so
  nothing animates off screen.
- **Slide 3 is the three shifts, and the hairlines that join them.** Three
  cards rise in order, the lines under them draw down into one point, and the
  payoff lands last — the argument in the order you'd say it out loud. The
  cards are hollows rather than `.resin`, because resin forces dark ink and
  this slide's cave brown is the mid-tone trap.
- **The ring on slide 4 is the homepage's `#dawn` figure**, geometry and CSS
  untouched. A slide has no scroll to scrub, so `ring()` plays the same
  `--in` / `--cold` / `--warm` values on a 4.2s timeline on entry instead.
- **Slide 5 is where the demo film goes.** There's a commented-in snippet in
  the markup: drop the video in place of the three `.beat__stage` figures.
- **Min lives in `min.js` now**, imported by both the landing page and the
  deck, so there is one Min and not two that drift apart. Nothing about his
  behaviour changed in the move.

Slides fit one screen by construction (type is clamped against `svh` as well
as `vw`, and the phone breakpoint drops the beats' sentences and shortens the
figures). On the **sideways** track a slide that outgrows the viewport anyway
scrolls inside itself instead of clipping, and the wheel handler notices and
lets that scroll happen rather than paging. On the **vertical** track it
can't: the deck owns the up-down gesture there, so slides are
`overflow: hidden` and the phone rules have to keep them inside one screen —
worth re-checking at 390×844 if you add copy to a slide.

## Local preview

```bash
python3 -m http.server 8000      # from the repo root
# open http://localhost:8000
```

For the waitlist form to submit locally, run the Worker and point the form at
it (see `worker/README.md`): set `window.KIN_API_BASE` before
`waitlist-hero.js` loads.

## Backend

The waitlist API (validation, D1 storage, rate limiting, and other security
measures) is a Cloudflare Worker in `worker/`. See `worker/README.md`.
