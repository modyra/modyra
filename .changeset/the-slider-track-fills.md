---
"@modyra/styles": patch
---

A slider's track fills up to its handle

Reported as reading like "a circle sliding in a controller box" rather than a slider. It was neither
the box nor the circle: **the track never filled**, in any theme, so what was on screen really was a
uniform rail with a knob on it.

`--mdy-slider-track-color` composed the split gradient inside a *token*:

```css
--mdy-slider-track-color: linear-gradient(to right,
    var(--mdy-slider-active-color) var(--mdy-slider-fill-pct, 0%),
    var(--mdy-slider-inactive-color) var(--mdy-slider-fill-pct, 0%));
```

A custom property substitutes what it references when **its own** declaration is computed, not when
it is used. Declared at token scope, where `--mdy-slider-fill-pct` is unset, both stops were frozen
at the `0%` fallback and inherited down that way. The renderer wrote the real percentage onto the
control on every value change, and by then the gradient it was meant to feed had already been built
without it. Measured on a slider sitting at 5 of 10: `linear-gradient(…, rgb(103 80 164) 0%, … 0%)`
while `--mdy-slider-fill-pct` on the same element read `44.44%`.

The gradient is now composed in the rule that uses it, on the element carrying the percentage. Same
two colours, same token names, one stop that is actually the value.

`modyra-material.css` had a second version of the problem: it set `background` outright to one flat
colour, so even a working gradient would have been replaced and that theme's slider could never show
a filled portion. It sets `--mdy-slider-inactive-color` now — the empty part of the track, which is
what it was describing — and the foundation composes the split.

The test moves the handle and asserts the fill grows with it, in all four stylesheets, rather than
checking a remembered number.
