---
"@modyra/widgets": patch
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": patch
"@modyra/styles": patch
---

The two controls a number field is declared to have

The catalogue names `increment` and `decrement` at a number field's trailing edge, gives them classes a
theme styles, and neither plain nor lit built them. The promise was kept by the platform's own spinner
where a browser draws one and by nothing where it does not — the same field with a stepper on one
engine and no way to step on another. Both renderers draw them now, out of the tab order (the box
itself takes the arrows) and stepping through the same intent typing goes through, so a stepped value
meets the field's rules on the way in.

`mdy-number-spinner` is declared as presentation: the box and its steppers need one positioning
context between them, and it is not a part — nothing is announced by it and no contract member points
at it.

**And a multiselect's trailing controls are drawn whether or not they have something to do.** lit and
Angular omitted the clear-all and the overflow count until they applied; plain drew them hidden. A part
a kind declares is a part its renderers carry, so all three draw both and hide what does not apply —
which also keeps them disabled with the field rather than absent from it.
