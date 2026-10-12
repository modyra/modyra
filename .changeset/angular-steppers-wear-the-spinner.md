---
"@modyra/angular": patch
---

An Angular number field's steppers are pressed where they are drawn

The steppers are now housed in the contract's spinner (`mdy-number-spinner`), as in the other
renderers, and take their geometry from the shared stylesheet instead of inline offsets. Those
offsets placed the two 24px buttons less than 24px apart, so they overlapped in every theme; in a
36px field (the modern theme) the centre of Increase was a press on Decrease.

Now a field under 48px of `--mdy-input-height` lays the steppers side by side, Decrease before
Increase, and keeps a 48px trailing margin so the value stays clear; a taller field stacks them
without overlap at the trailing edge.

**Migration.** The wrapper, the input's trailing padding and the buttons no longer carry inline
styles. A stylesheet that overrode those inline values with `!important` can target
`.mdy-number-spinner` and `.mdy-spin-btn` instead. The steppers move by a few pixels in every theme,
so screenshot baselines of number fields change.
