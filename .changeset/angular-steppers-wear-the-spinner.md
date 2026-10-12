---
"@modyra/angular": patch
---

An Angular number field's steppers are pressed where they are drawn

The steppers are now housed in the contract's spinner (`mdy-number-spinner`), as in the other
renderers, and take their geometry from the shared stylesheet instead of inline offsets. Those
offsets pinned the two buttons 0.15em from the top and bottom edges, so in any field shorter than two
buttons they overlapped; in a 36px field (the modern theme) the centre of Increase was a press on
Decrease.

Now a field under 48px of `--mdy-input-height` lays the steppers side by side, Decrease before
Increase, and keeps a 48px trailing margin so the value stays clear; a taller field stacks them
without overlap at the trailing edge.

**Migration.** The wrapper, the input's trailing padding and the buttons no longer carry inline
styles. A stylesheet that overrode those inline values with `!important` can target
`.mdy-number-spinner` and `.mdy-spin-btn` instead. The steppers move by a few pixels in every theme,
so screenshot baselines of number fields change.

The steppers now depend on `@modyra/styles`: without that stylesheet, or with a custom one lacking the
`.mdy-number-spinner` and `.mdy-spin-btn` rules, they render as two plain buttons after the input.
The side-by-side layout under 48px comes from the `@modyra/styles` release that ships alongside this
one; with an older `@modyra/styles` the steppers of a short field still overlap, so upgrade both
together.
