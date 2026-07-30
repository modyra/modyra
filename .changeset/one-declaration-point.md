---
"@modyra/styles": minor
---

Every theme derives its palette from the colour it actually chose

The maths landed in `modyra-base.css` but could not reach two of the themes, because they never
declared a primary where the maths could see it. Material set `--mdy-primary: #18181b` and iOS
`--mdy-primary: var(--mdy-ios-blue)` — the *short* tier, which is downstream of the derivation. Their
identity colour arrived after the palette had already been built from a primary they never chose.
Both declare `--mdy-sys-color-primary` now, and the short names still bridge from it.

**`modyra.css` imports `modyra-base.css`.** It was documented as the file to import and did not
import the file holding the `--mdy-ref-*` / `--mdy-sys-*` / `--mdy-comp-*` tiers — so a page loading
a theme on its own, which is what every framework-free example does, had no `sys` tier at all and ran
entirely on the literal hex fallbacks spelled into the `var()` chains. Fixed hex cannot follow a
chosen colour. Only the Angular demo and Studio were loading base separately.

Measured across the four stylesheets, before and after: **`modyra-modern` changed in nothing at all**
— it already imported base, which makes it the control that says the import itself is inert. The
other three gain the 311 `sys` tokens they were missing and change 8 to 16 values each, every one of
them the derivation taking effect: chips, segmented buttons, the slider's inactive track, and the
`on-` colours that were 95% white regardless of what they sat on.

**Two consequences worth stating rather than burying:**

- **Material's accents become grey.** Its primary is `#18181b`, whose chroma measures 0.006, so a
  palette derived from it has almost no colour: `--mdy-sys-color-secondary` comes out
  `oklch(0.217 0.006 316)` and its chips go from lavender to light grey. This is coherent rather than
  broken — the theme's own block is headed *"Key Palette (Zinc Neutral)"* and already derived every
  surface from that zinc. The chips were lavender only because they fell through to base's fixed
  violet, which was an accident of the theme not owning that token, not a decision. Whether Material
  should now *force* an accent is a design call and is left open, which the derivation allows.
- **Material keeps its own red.** `--mdy-sys-color-error: #dc2626` is declared outright instead of
  derived — exactly the escape hatch the derivation leaves for a theme that wants its own palette.

iOS needed nothing beyond the declaration move: its blue drives a secondary at 287° and a tertiary at
347°, and its chips stay iOS blue because that theme forces them.
