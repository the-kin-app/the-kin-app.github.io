# Working on the pitch deck (`/pitchdeck`)

The public, short version of the Min pitch: eight slides, swipeable, built out
of the site's own material system rather than exported from a slide tool. The
outline it came from is `kin/Business/pitch deck (public).md` (not in this
repo). No financials, no metrics, no ask — that's the investor deck.

Read the brand rules in the root `README.md` ("Brand rules it is built to")
before changing anything visual. They are constraints, not preferences.

There are two paged, printable three-minute versions. Both are documents
rather than decks — no script, nothing moving — and each one's own file
explains how to re-export it.

| Folder | Hook | Pages | PDF |
| --- | --- | --- | --- |
| `pitchdeck/short/` | "when did you last talk to a stranger?" | 6 | `min-3-minute.pdf` |
| `pitchdeck/strangers/` | a village talks, a city doesn't | 10 | `min-strangers-3min.pdf` |

`strangers/` loads `pitchdeck-short.css` for the print layer and then
`pitchdeck-strangers.css` for its own figures — `.places`, `.layers`,
`.stats`, `.cats`, `.flow`, `.map`, `.money`. Its speaker notes live in an
HTML comment above each page: **every page is a picture**, there is no
explanatory paragraph anywhere in it, and the paragraph is what gets said
out loud. The only small type in the whole deck is a diagram label and the
two citation lines on pages 3 and 4.

Four of its pages are deliberate pairs, and the rhyme is the argument:
1/6 (the same crowd, cold then warm), 3/4 (the same rings **in the same
place, at the same radii**, one colour gone — the bands widen outward,
32 · 28 · 38 · 48, because a social layer holds more people the further
out it sits, and it puts the widest band on the one that vanishes), 5/6 (the same columns, the hole filled) and
5/6 → 8 (a hole, and Min standing in it, a third time). Move a body, a ring
or a column on one and you must move it on its partner. Pages 3 and 4 share
one `.split` layout for exactly this reason, and pages 5 and 6 carry
**two-line headlines of the same length** so the diagram under them does not
jump when you page across.

Two things in it are unlike anything else on the site:

- **Real App Store icons** (`assets/img/apps/*.png`, 128px, pulled from the
  iTunes Search API) are the only saturated colour in the deck. That is a
  deliberate exception on pages 5, 6 and 8 — a room recognises Instagram in
  a way it never recognises the words "social apps" — and not a licence to
  add more. To add one: search the iTunes API for it, take
  `artworkUrl512`, and resize to 128px.
- **Page 8 stays on the intimacy axis.** It reuses pages 3/4/5's own line
  — stranger · familiar stranger · casual friend · friend · date or
  partner — and shows three matching apps leaping off it to a landing
  spot you had to pick *before meeting anybody*, against Min's single
  step drawn ON the line. That shared axis is the whole reason this page
  is allowed to exist next to page 5: page 5 asks which point nobody
  serves, page 8 asks how far each app makes you travel and when it makes
  you decide.

  Two earlier versions had to go, and neither should come back. A
  scheduled-vs-spontaneous quadrant: a second positioning map on axes
  that didn't reconcile with page 5's, with Tinder in a tidy box one page
  after page 5 showed Tinder leaping the layer. Then a five-row "find a
  date / find a friend / find a place" list: right argument, but a table
  on a deck where every other page has a shape.
- **`.cats` (pages 5 and 6) reads in three bands**: row 3 is social
  media, row 4 is Min's slot, row 5 is matching apps and the straight run
  they make across the board. Every category sits in the same kind of
  bubble, including matching apps — they are one more category on the
  diagram, not an annotation on it. The run used to be an arc leaping the
  middle column; a lone curve on a page of straight lines read as
  decoration, and its length says the same thing without the flourish.
- **Pages 8 and 9 are one argument in two halves** — why we are not a
  matching app, and why we are not social media — so both carry the real
  marks of the thing they are arguing against. Page 8: the intimacy axis
  with Tinder/Bumble/Hinge/Meetup/Meet5/Timeleft leaping off it. Page 9:
  the revenue lines with Instagram/TikTok/Snapchat on the line that
  climbs with your screen time. Neither page carries a caption; both
  arguments are said out loud.
- **`.app-min` is Min as an App Store icon** — the platform's own ~23%
  corner ratio, on a violet-into-cave gradient, sized a step above his
  neighbours. Use it anywhere Min stands in a row of real app marks
  (pages 6 and 8): loose, he reads as a mascot that wandered into a
  chart. It also solves the next line for free.
- **Min needs a dark ground, always.** He is warm opal lit from the
  inside, so on the deck's daylight tones he is a pale creature on a pale
  page and disappears. Page 7 sits on `--resin-volume` (#6b5c4d) for
  exactly this reason, and page 8's last row puts him in a `--world-cave`
  well — a well sunk into the row, not another pebble stacked on it.
  That is a legibility constraint, not a palette preference.
- **The closing QR has no plate**, so it is generated from the `cave`
  palette (cream modules, transparent ground) rather than `mono`. It is
  therefore an INVERTED code: current phone cameras read those, but test
  it live before presenting. If it ever fails, put page 10 on a light
  ground and regenerate at `mono` — don't bring the plate back.
- **`assets/img/qr-waitlist.svg`** is generated with `logo: false`, unlike
  the poster codes. The wordmark is already on the page above it, and a
  badge in the middle spends error correction on a logo nobody needs twice.
  Regenerate it through `qr-encode.js` + `qr-style.js`, never by hand.

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
# The layout inside the download changed: it is chrome-headless-shell in a
# chrome-headless-shell-mac-<arch> directory now, not headless_shell in
# chrome-mac. $(echo …) because a bare assignment doesn't expand the glob.
SH=$(echo ~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-*/chrome-headless-shell)
"$SH" --headless --disable-gpu --hide-scrollbars --virtual-time-budget=3000 \
      --window-size=390,844 --screenshot=out.png "http://localhost:8000/pitchdeck/#4"
```

For a paged deck, one tall screenshot of the whole stack is faster than ten:
in `@media screen` the pages are a 40px-gapped column, so page *n* starts at
`40 + n * 760`. Shoot `--window-size=1280,7700` and slice it up.

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
