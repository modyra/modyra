---
"@modyra/widgets": patch
"@modyra/angular": patch
---

"No attribute" is said with `null`

Taking `aria-checked` off the native checkbox left the key out of the object rather than setting it to
`null`. This contract says "no attribute" with `null` everywhere — `aria-readonly` beside it does —
and a key simply absent reads as `undefined` to anything asking the projection what the field says,
which is a value no reader maps and outside the three the standard allows. Worse than the redundancy
it replaced: an ARIA attribute holding an uninterpretable value beside a box that maps its own state.

Also in Angular's colour field: `aria-label` was bound twice on the hex box, so one of the two names
was silently discarded, and `aria-disabled` was written only while true where the other two renderers
and the contract say it in both states.
