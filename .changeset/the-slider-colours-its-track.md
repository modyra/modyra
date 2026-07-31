---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/angular": patch
"@modyra/lit": patch
"@modyra/styles": patch
---

The slider colours its track

Reported: the slider's bar never filled. Two things were wrong, and each one alone was enough.

`@modyra/plain` never wrote `--mdy-slider-fill-pct`, so the gradient sat on its `0%` fallback no
matter where the handle went. It writes it now, on the control, which is the element the gradient is
composed on.

Even written, nothing painted it. `.mdy-input-wrapper input:not(.mdy-checkbox)` sets `background:
transparent` to flatten a text control's frame, and at `(0,2,1)` it erased the split track composed
on `.mdy-slider` at `(0,1,0)` — for every renderer, not only plain. The slider joins the checkbox in
that exemption: both draw themselves.

Then it filled to the wrong place. A range input's handle travels by its **centre**, from `thumb/2`
to `100% - thumb/2`, so a stop written at `ratio × 100%` follows the element rather than the handle
and misses it by `thumb × (ratio − 0.5)` — measured at −10px, 0px and +10px across the range, right
only at the midpoint. The stop is now `thumb/2 + ratio × (100% − thumb)`, taken from
`--mdy-slider-thumb-size`, so a theme that resizes the handle stays aligned for free.

That correction has to happen in CSS, because the handle's size is a theme token and a renderer that
knew it would be drawing the theme. CSS can only do it given a unitless number: `calc()` cannot
divide by a percentage to recover `0.3` from `30%`.

**`--mdy-slider-fill-pct` is therefore no longer the property to write.** Renderers write
`--mdy-slider-fill`, a ratio in 0–1. Anything that *reads* `--mdy-slider-fill-pct` keeps working — it
is still declared, derived from the ratio on the control itself. Anything that *writes* it directly
no longer has an effect and should move to `--mdy-slider-fill`.

How far along the value sits is now `sliderFillRatio` in `@modyra/widgets`, one calculation instead
of one per adapter. Angular and Lit had disagreed about a range with no width — Angular answered
`0`, Lit divided by a nudged denominator — and `0` is the answer that degrades to an empty track
instead of an arbitrary one. A value that is absent or not a number fills to the minimum rather than
painting `NaN`.
