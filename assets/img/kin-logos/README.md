# Kin — Logo assets

All PNGs have a transparent background (no matte, straight alpha).
SVGs are vector and scale to any size.

## Files

| Asset | Files | Notes |
|---|---|---|
| **Flat** | `kin-logo-flat.svg`, `kin-logo-flat-{512,1024,2048}w.png` | Warm ink `#23211E` wordmark, `--violet-deep` `#B287CC` dot. The workhorse — use on light backgrounds. |
| **Gradient** | `kin-logo-gradient.svg`, `kin-logo-gradient-{512,1024,2048}w.png` | Pale violet → deep violet across the letterforms, glowing violet dot. One hue, three levels — never a second colour. |
| **Glass** | `kin-logo-glass.svg`, `kin-logo-glass-{512,1024,2048}w.png` | Translucent white resin with a warm bloom. Needs something behind it — see caveat. |

## Caveat on the glass version

In Figma this logo uses a **backdrop blur**, meaning it blurs whatever sits
behind it. A transparent PNG has nothing behind it, so the blur cannot be
baked in. What is rendered here is everything else — the 55% white body, the
hairline glass edges, the warm outer bloom and the translucent violet dot.

Over a photo or gradient it will read very close to Figma. On a flat colour it
will look slightly flatter than the Figma frame, because the real blur is
missing. For hero placements, composite the SVG over the background live
(CSS `backdrop-filter`, or the SwiftUI `.thickMaterial` in `ResinMaterial.swift`)
rather than using the flat PNG.

## App icon

`kin-appicon-frosted` is not in this folder. It is a frosted card whose whole
character comes from backdrop blur, and it needs to be 1024×1024 for store use —
too large to move through this pipeline and impossible to rasterise faithfully
outside Figma.

Export presets have been added to it in Figma (PNG @1x/@2x/@3x + SVG), so select
`kin-appicon-frosted` on the 02 Material Lab page and hit Export. The same
presets were added to all three logos if you ever want them straight from source.
