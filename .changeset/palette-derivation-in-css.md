---
"@modyra/styles": minor
"@modyra/core": patch
---

The palette follows the colour it is derived from

`modyra-base.css` now derives secondary, tertiary and error from `--mdy-sys-color-primary` in OKLCH,
with the model selected by `data-mdy-palette` on the root or on any subtree. Four ship — `brand`
(default), `monochrome`, `complementary`, `triadic` — each nothing but hue offsets and chroma and
lightness multipliers, written as plain custom properties.

Before this, choosing a brand colour moved the primary and left everything else where it stood: a
green brand still rendered violet chips and coral accents, in every theme, measured. Dark mode was
worse than that — it restated secondary and tertiary from the fixed reference colours, so a chosen
colour worked in the light theme and quietly stopped applying in the dark one. Both derive now.

`brand` uses round +30°/+90° where the stock palette measured at +24°/+96°, so its colours shift
slightly and deliberately.

**Contrast is derived too, and this is the part that was actually broken.**
`--mdy-sys-color-on-primary` was `color-mix(primary, cloud 95%)` — 95% white whatever the primary
was, which on a light brand colour is white text on a light background. Each `on-` colour now reads
the colour it is named for and resolves to black or white against it.

Getting that right took three measured corrections, none of which were visible from reading the code:

- **CSS has no conditional**, but `clamp()` on lightness makes a step. The slope has to be steep:
  at ×100 a colour landing within 0.01 of the threshold resolved *inside* the clamp — one measured
  at lightness 0.5559 produced a mid grey, the worst text colour available on any background.
- **A lightness threshold cannot stand in for a luminance one.** WCAG weights green at 0.72 and blue
  at 0.07, so a blue and a green of identical OKLCH lightness are nowhere near equally bright; a
  constant pivot picked the wrong side 38 times in 1080 samples. Luminance is estimated instead as
  `l³ · (1 + 0.85·c·cos(h − 179°))` — exact for a grey, fitted for the rest — which is wrong 16
  times in the same 1080, all within 0.0075 luminance of the crossover where the two choices are
  worth the same. `pow()` and `cos()` are both older than the relative-colour-syntax baseline, so
  this costs no support.
- **The `on-` colour must be judged on the *painted* colour, not the requested one.** A rotated hue
  at full chroma often leaves sRGB, and clipping it back moves its lightness.

Everything sits inside `@supports (color: oklch(from white l c h))`. Relative colour syntax needs
Chrome 119, Safari 16.4 or Firefox 128; an older browser keeps exactly the palette it renders today
rather than losing its colours.

**Derivation is a default, not a cage**: a theme declaring `--mdy-sys-color-secondary` outright still
wins, and there is a test that says so.

The stylesheet's estimate is an approximation and `@modyra/core/color-utils` is not — it measures
both candidates and is exact, which is the guarantee for generating a theme ahead of time. The new
`e2e/palette.spec.ts` measures what a browser actually paints, through a canvas rather than a second
implementation of the colour maths, and asserts the approximation never falls far from the best
colour available. A test parses the stylesheet and compares every number against
`MDY_PALETTE_MODELS`, because two copies of a number is exactly what drifts.
