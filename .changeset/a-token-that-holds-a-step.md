---
"@modyra/styles": patch
---

Twenty-three component tokens hold a step instead of a number.

A token below the scale holding a literal is a value a theme cannot move: change the scale and
everything follows except those. Padding, gaps, offsets and hairlines now read from the scale —
`--mdy-input-padding` is `space-2 space-4`, a `1px` border is `--mdy-stroke-1`, the focus underline is
`calc(-1 * var(--mdy-stroke-2))`.

Two moved to the nearer step rather than staying literal: the chip's internal gap (0.375rem → 0.5rem)
and the overlay's padding (1.25rem → 1.5rem). The number stepper's size stops being its own 1.5rem and
reads `--mdy-affordance-target-stacked`, the token `DESIGN.md` already names for a stacked control.

Eleven properties are deliberately left, in two groups: three have no scale to belong to — a popup's
maximum height is a viewport question, not a spacing one — and eight are the floating label's `calc`
derivations, where a step inside the arithmetic would not make the result a step.
