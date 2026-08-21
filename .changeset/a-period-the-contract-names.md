---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": patch
"@modyra/angular": patch
---

A period the contract names, and the same one in every renderer

AM and PM were `presentation` — the catalogue's own word for a class a renderer may use that carries
no semantics. So there was no part, no `selected` state, no conformance check, and nothing holding
the three renderers to one anatomy. They diverged exactly where you would expect: Angular and Lit
drew a two-button segmented control with one marked, and **plain drew a single button whose text was
the current period and which toggled on click**.

That is the weaker form in three ways. The value was only readable as the label of the control that
changes it; nothing was ever marked selected, so a screen reader had no state to announce; and the
target was half the size. It is also a control that says "AM" and means "switch to PM" — a label
describing what it is not.

`periodOption` is now a declared part with `states: ["selected"]`, and both classes have left
`presentation`. Plain draws two buttons, each asking for its own half. Angular and Lit take the class
from the catalogue rather than writing the literal, so the anatomy is decided in one place.
