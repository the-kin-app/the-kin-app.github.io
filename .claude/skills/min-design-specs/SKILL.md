---
name: min-design-specs
description: Use whenever a task touches Min's look, motion, material, colors, radii, sizing, or any Kin/Min UI component (buttons, page dots, cards, camera, icon pebbles) on this website. Load BEFORE writing CSS/JS for such a change — these files are the source of truth the SwiftUI app itself was built from, not something to reverse-engineer from the current site code. Trigger words: "add animation", "give it motion", "material", "color", "token", "radius", "spacing", "component spec", "how does X look/move in the app".
---

# Min / Kin design specs (source: `~/Desktop/Min components/`)

This folder holds the SwiftUI app's actual design system — the specs and
components this website's Min, buttons, and page dots are ports of. When a
task asks to add, fix, or match motion/material/sizing for a component,
read the relevant file(s) below BEFORE writing CSS/JS. Don't guess values
that are already authored here.

## Which file for which ask

| Ask is about... | Read |
|---|---|
| Motion/animation for ANY component (emerge, press, blink, breathe, transitions, screen changes, easing curves, timings) | `MOTION.md` |
| Colors, gradients, opacity, materials, radii, shadows, the "resin" look | `MATERIAL.md` |
| Sizing across screen sizes, safe areas, Dynamic Island / notch clearance, responsive scaling | `SCALING.md` |
| Overall component inventory, what exists, naming | `README.md`, `HANDOFF.md` |
| Exact SwiftUI implementation of a specific component (buttons, page dots, cards, camera, icon pebbles, background) | `Components/*.swift` — see table below |
| Live component tokens (exact colors/sizes as Swift constants, not prose) | `Components/KinTokens.swift` |

## Component → Swift file

| Component | File |
|---|---|
| Page dots / indicator | `Components/PageDots.swift` |
| Primary/secondary button (emerge, press, wet, rim, fill) | `Components/KinButton.swift` |
| Info pebble (copy transitions) | `Components/KinInfoPebble.swift` |
| Icon pebble | `Components/KinIconPebble.swift` |
| Card / card-book page turns | `Components/CardBook.swift`, `CardModel.swift`, `GlassCard.swift` |
| Background (parallax, drift, viewports) | `Components/KinBackground.swift` |
| Camera / shutter | `Components/KinCamera.swift`, `KinCameraParts.swift`, `KinShutterPlatform.swift` |
| Logo / wordmark forming | `Components/KinLogo.swift` |
| Typography emerge | `Components/KinTextRise.swift` |
| Screen-level transitions | `Components/KinScreen.swift` |
| Tokens (colors, radii, sizes — exact values) | `Components/KinTokens.swift` |

`Screens/` and `KinPreview.swift` show these composed into full flows —
check them if a spec file references a "harness" or full-screen behavior.

## How to use this

1. Identify what the task touches (motion vs. material vs. a specific
   component) and grep the matching file(s) above for the relevant
   section rather than reading the whole thing.
2. Port values exactly (colors, pt sizes, timing curves, percentages) —
   these are the authored numbers, not approximations. pt ≈ px is a fine
   1:1 assumption for this site's CSS.
3. Translucency/material color CAN be adjusted for the web if the exact
   Swift material doesn't read well against this site's own backgrounds
   (this has been explicitly OK'd before) — geometry, timing, and layer
   order should still match.
4. If a referenced Swift component or spec section doesn't exist yet
   (the app is still evolving), say so rather than inventing a value.
