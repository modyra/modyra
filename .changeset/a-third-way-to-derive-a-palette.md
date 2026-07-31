---
"@modyra/core": minor
"@modyra/styles": minor
---

A third way to derive a palette, and a tonal model for the two that were already there

Modyra derived a palette two ways: OKLCH arithmetic and Material's HCT, both live in the browser
through relative colour syntax. A perceptual model cannot be expressed that way, because it asks a
question CSS has no way to answer at paint time — how much chroma sRGB can actually show at this
lightness and hue — and then moves lightness only as far as a minimum perceptual distance requires.
So it compiles instead. `@modyra/core/theme-compiler` turns one seed into complete light and dark
`--mdy-sys-color-*` sets, solved independently rather than one lifted from the other, and
`@modyra/styles/salience.css` is the first theme it produced.

It sits on its own subpath, not in the root barrel: it is build-time code, and re-exporting it took
the core entry from 14.7 KB to 18.0 KB gzip against a 15 KB budget.

The live models gain `tonal`, which ramps the brand hue deep-to-pale instead of rotating it, and
per-role chroma floors so a muted brand still derives a visible accent instead of collapsing into
grey. Colours that are actually neutral stay neutral: below c = 0.005 the hue is numerical noise,
and amplifying it would invent a brand colour nobody chose.

Fixes `--mdy-sys-color-tertiary` resolving to nothing on every model but `tonal`. The floors are
read with `max()` on every model, so the one that was declared only where it bites made the whole
declaration invalid at computed-value time everywhere else — measured empty in Chromium under
`brand`, `monochrome` and `triadic`.
