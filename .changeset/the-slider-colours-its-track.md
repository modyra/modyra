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

The percentage itself is now `sliderFillPercent` in `@modyra/widgets`, one calculation instead of
one per adapter. Angular and Lit had disagreed about a range with no width — Angular answered `0`,
Lit divided by a nudged denominator — and `0` is the answer that degrades to an empty track instead
of an arbitrary one. A value that is absent or not a number fills to the minimum rather than
painting `NaN%`.
