# Working on the pitch deck (`/pitchdeck`)

The public, short version of the Kin pitch: eight slides, swipeable, built out
of the site's own material system rather than exported from a slide tool. The
outline it came from is `kin/Business/pitch deck (public).md` (not in this
repo). No financials, no metrics, no ask — that's the investor deck.

Read the brand rules in the root `README.md` ("Brand rules it is built to")
before changing anything visual. They are constraints, not preferences.

`pitchdeck/short/` is the three-minute version: six pages, one hook ("when
did you last talk to a stranger?"), built from these same figures and
exported to `kin-3-minute.pdf`. It is a paged document, not a deck — no
script, nothing moving — and its own file explains how to re-export it.

## Where things live

| File | What it owns |
| --- | --- |
| `pitchdeck/index.html` | the slides. Content and structure — nothing else |
| `assets/css/pitchdeck.css` | paging (the track) + one block per slide's figure |
| `assets/js/pitchdeck.js` | axis, palette, activation, the ring's timeline |
| `assets/css/landing.css` | **the materials.** Loaded first, never edited for the deck |
| `assets/js/min.js` | Min, shared with the homepage |
| `assets/js/press.js` | the button press, shared with everything |

Load order in `<head>` is `tokens → landing → pitchdeck` and it matters:
`pitchdeck.css` overrides the landing page's document assumptions (scrolling
body, tall sections) and would be overridden itself if it came first.

## The rules that will bite you

1. **Reuse the material, don't re-make it.** An object is `.resin`. A person
   is a `.blob`. A button is `.btn` with a `.btn__fill` span and its label in
   `.btn__label`. Min is `<div class="min" data-min>`. If you find yourself
   writing a new `backdrop-filter` or a new gradient wash, the answer already
   exists in `landing.css`.
2. **The axis breakpoint lives in two files.** `760px` — `pitchdeck.css`
   flips the track to vertical there, and `pitchdeck.js` reads the same
   `matchMedia('(max-width: 760px)')` to know which axis it's on. Change one,
   change both, or paging silently reads the wrong scroll offset.
3. **A slide is one screen.** Type is clamped against `svh` as well as `vw`.
   On the vertical (phone) track slides are `overflow: hidden`, because the
   deck owns the up-down gesture and a scrollable slide would swallow the
   swipe — so the phone rules at the foot of `pitchdeck.css` are load-bearing.
   Adding copy means re-checking 390×844.
4. **`data-bg` needs ≥ 5:1 against one of the two inks.** `--ink` picks
   itself by contrast between cream `#f8f2ea` and graphite `#21212d`; a
   mid-tone background gives you neither. Check before committing a colour:

   ```bash
   python3 -c "
   def lum(h):
       c=[int(h[i:i+2],16)/255 for i in (1,3,5)]
       f=lambda v: v/12.92 if v<=0.03928 else ((v+0.055)/1.055)**2.4
       r,g,b=[f(v) for v in c]; return 0.2126*r+0.7152*g+0.0722*b
   con=lambda a,b:(max(a,b)+0.05)/(min(a,b)+0.05)
   h='#5c4a5e'; l=lum(h)
   print(h, 'cream', round(con(l,lum('#f8f2ea')),2), 'graphite', round(con(l,lum('#21212d')),2))"
   ```

   The sequence is also a journey, not a palette: dusk → plum → first light →
   daylight → dusk, mirroring the homepage's ramp.
5. **Looping figures are gated on `.slide.is-active`.** Nothing animates off
   screen. A new animation that isn't behind that selector runs eight times
   over, forever, in the background.
6. **Only the active slide is live.** `pitchdeck.js` marks the rest `inert`.
   Don't reach into another slide from script, and don't expect a hidden
   slide's links to be focusable.
7. **`.min` is `width/height: 100%`,** which beats `aspect-ratio`. Any Min in
   a non-square box needs both dimensions set explicitly (see
   `.slide .min--dawn`) or he stretches.

## Adding or changing a slide

Everything derives from the markup — the toolbar dots, the counter, the
progress hairline and the palette all build themselves from the sections
present, so there is no list to keep in sync.

```html
<section class="slide" data-title="Toolbar label" data-bg="#3a2e44"
         aria-roledescription="slide" aria-label="A sentence describing it">
  <span class="slide__tag">Section label</span>
  <div class="slide__inner">
    <h2 class="rise">One line. The point of the slide.</h2>
    <!-- the figure, which is the slide -->
    <p class="slide__foot rise" data-delay="3">The aside, not the point.</p>
    <p class="slot rise" data-delay="4"></p>
  </div>
</section>
```

- `class="rise" data-delay="n"` joins the emergence cascade `n` steps in
  (opacity, over-scale, y, blur clearing on `--ease-emergence`). Cascade, never
  a simultaneous bloom. `landing.css` only defines steps **1–5**; a sixth
  `data-delay` is silently a delay of zero. Anything that has to land later
  than five steps gets an explicit `transition-delay` instead — see slide 3,
  where the payoff and the foot wait for the joins to finish drawing.
- **`<p class="slot">` is the owner's space** — one per slide, left empty.
  `.slot:empty` is `display: none`, so an unused one doesn't exist. Never
  delete these, and never put placeholder text in them: this page is public,
  and "TBD" on a live slide is worse than silence.
- Slide 5 has a commented-in `<video>` snippet where the demo film goes, in
  place of the three `.beat__stage` figures.
- Speaker notes stay out of this file. It's the public artifact.

Keep it visual. If a slide needs a paragraph, it needs two slides.

## Previewing and verifying

```bash
python3 -m http.server 8000     # from the repo root
# open http://localhost:8000/pitchdeck/   ·   deep links: /pitchdeck/#4
```

Check both axes and both light conditions: 1440×900 (sideways track) and
390×844 (vertical track), and at least one dusk slide and one daylight slide.

For static screenshots, the headless Chromium that ships with Playwright works
without the npm package:

```bash
# $(echo …) because a bare assignment doesn't expand the version glob
SH=$(echo ~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-mac/headless_shell)
"$SH" --headless --disable-gpu --hide-scrollbars --virtual-time-budget=3000 \
      --window-size=390,844 --screenshot=out.png "http://localhost:8000/pitchdeck/#4"
```

Two things to know about that: WebGL fails in headless, and the console
warning is the atmosphere degrading exactly as designed — not a bug. And
virtual time stops advancing early, so a screenshot catches the reveal
cascade and the ring's timeline **mid-flight**. To see a settled slide,
temporarily copy the page and inject a stylesheet forcing the end states
(`.rise { opacity: 1; transform: none; filter: none }`, `--in: 1` on the
armed scene, `stroke-dashoffset: 0` on the why-now joins), then delete the
copy.

## What must keep working

- Drag/swipe through every slide **with JavaScript disabled** — the track is
  native scroll-snap; the script only adds keyboard, wheel, toolbar and hash.
- The atmosphere (`landing-scene.js`) is a bonus, never a dependency.
- `prefers-reduced-motion`: the ring stays unarmed (assembled), the why-now
  joins are already drawn, and paging is instant rather than smooth.
- The homepage. Anything touched in `landing.css`, `min.js` or `press.js` is
  shared — check `/` before you call it done.
