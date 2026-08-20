---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/angular": patch
---

The dial's inner ring is hit where it is painted

`timepickerDialRing` compared a fraction of the **hand's length** against a fraction of the **dial's
radius** — two different lengths. With the shipped geometry (a 256px dial, 40px numbers, so a 100px
hand) the boundary landed at 102.4px, *2.4px beyond the outer digits*: every point on the face read
as `inner`, including the outer numbers themselves, so a person had to aim past a number to be read
as pointing at it.

The boundary is now the midpoint between where the two rings are actually drawn — 80px for that
geometry — and `handLength` is passed in rather than recomputed, because `dialSize / 2 − numSize / 2
− 8px` are the drawing's numbers and a copy of them in TypeScript is a copy that drifts. Plain and
Angular read `--tp-hand-length` from the face.

`MDY_TIMEPICKER_INNER_RING` is published as the one value the drawing and the hit test share, and a
contract test holds it against the stylesheet's own `-0.6` — the drift that produced this defect
cannot happen silently again.

`timepickerDialRing` gains a required parameter, which the surface audit calls major. It was added
after the version commit and is in no released package, so there is nothing to migrate.
