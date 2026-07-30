---
"@modyra/core": minor
---

The relational maths behind a palette, at `@modyra/core/color-utils`

A palette is not a list of colours, it is one colour and a set of relationships. Modyra's already
was — measured in OKLCH, the stock secondary sits at the primary's hue +24°, the tertiary at +96°,
the error at a fixed red with 0.83× the primary's lightness. Those relationships were real and
frozen as hex literals, so picking a new brand colour left the rest of the palette where it stood: a
green brand still got violet chips and coral accents.

This module holds the relationships as numbers, so the palette can follow. `modyra-base.css` will
hold the same numbers as custom properties and let the browser do the arithmetic live; a later test
binds the two copies together, because two copies of a number is exactly what drifts.

Four models ship — `brand` (default), `monochrome`, `complementary`, `triadic` — each a set of hue
offsets and chroma/lightness multipliers, nothing more. `brand` uses round +30°/+90° rather than the
measured +24°/+96°, so the stock palette shifts slightly and deliberately.

**Error keeps a pinned red hue** and takes only its weight from the primary. It is the one colour in
a palette whose meaning is not decorative, and an error that has gone green because the brand did is
no longer an error.

OKLCH rather than HSL: HSL's "lightness" is not lightness — `hsl(60 100% 50%)` and
`hsl(240 100% 50%)` claim the same 50% while one is blinding and the other nearly black, so rotating
hue in HSL changes perceived brightness and the derived palette comes out uneven.

**Contrast is the part CSS cannot check for itself**, so it lives here: `contrastRatio` is WCAG 2.1,
and every `on-` colour is chosen by measuring both candidates rather than guessing. Three findings
came out of writing that, each from a test failing rather than from reasoning:

- **The lightness pivot was wrong.** Solving for where black overtakes white puts the crossover
  between 0.508 and 0.590 OKLCH lightness, mean 0.562 — not the 0.62 first assumed. At 0.62 an
  indigo of lightness 0.607 was handed white text at 4.09:1, under AA, when black gives 5.07:1.
- **The `on-` colour must be decided from the *painted* colour, not the requested one.** A rotated
  hue at full chroma often lands outside sRGB, and clipping it back moves its lightness: a tertiary
  asked for at 0.551 was painted at 0.579, so judging the request chose white where the thing on
  screen wanted black.
- **No constant pivot can be right for every hue.** With one, five pairs in the test sample landed
  under AA despite 4.64–4.87:1 being available to them. Measuring both candidates and keeping the
  better clears AA for every model and every primary tested. `contrastPivot` stays in the model as
  the stylesheet's approximation of this rule — the stylesheet has no way to compute a luminance —
  and what that approximation costs will be measured in a browser rather than assumed.

The margin is genuinely thin at mid lightness: a colour sitting on the crossover has only ~4.6:1
available whichever way it goes. That is a property of black and white text on mid-tone backgrounds,
not something a better pivot could fix.

No new package and no build change — this follows the existing `@modyra/core/time-utils` subpath
pattern. Nothing renders differently yet; this batch establishes the numbers.
