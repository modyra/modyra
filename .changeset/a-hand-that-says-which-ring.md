---
"@modyra/widgets": minor
"@modyra/styles": patch
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

The hand says which ring it is pointing into

A 24-hour face carries two numbers at every position: 3 outside and 15 inside share a direction. The
contract has always told them apart by how far from the centre the pointer was, and a granularity
makes the ambiguity ordinary rather than rare — with a three-hour step, 3 and 15 are the two hours
that position offers. **Drawn with a hand of one length, the two selections are identical**, and a
person cannot tell which they chose until they read the header.

The hand now stops at the ring it points into. `timepickerSelectedRing` says which that is, from the
same predicate that decides where a number is drawn, so the face and the hand cannot disagree; all
three renderers read it and none derives it.

Its length is `--tp-hand-length × var(--tp-inner-ring)`, and `--tp-inner-ring` is where the
stylesheet's own figure for the ring now lives — one number for the numbers and the hand that points
at them. It was two: a literal beside the inner numbers, and `MDY_TIMEPICKER_INNER_RING` in the
contract. A shortened hand written as a third would have made the hand point at one ring while the
hit test picked the other, with every number still exactly where it should be.

`css-properties.spec.mjs` now fails if the hand takes a figure of its own, if the sheet stops
declaring `--tp-inner-ring`, or if it stops matching the contract.
