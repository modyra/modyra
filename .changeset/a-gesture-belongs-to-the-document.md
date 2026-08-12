---
"@modyra/widgets": minor
"@modyra/lit": patch
"@modyra/plain": patch
---

A gesture is bound once, and Lit stops deciding on the tail of it

`bindLightDismiss` joins `createLightDismiss`: the policy decides whether an
interaction dismisses, and this is the six listeners that feed it. Written per
renderer, the set drifted — one bound `pointerup` and the other did not, leaving
that one to decide on `click` alone, which the policy's own documentation calls
the tail of the gesture rather than the gesture. A release outside that produced
no click never dismissed.

`createPointerDrag` returns to the package entry, taken up by the Angular and Lit
clock dials, whose document listeners were byte-identical. The framework-free
renderer keeps its own: it uses `setPointerCapture`, which retains the pointer
that leaves the dial without any document listener at all.

The Lit multiselect stops writing its own toggle, increment and decrement — a
third form matching neither of the other renderers — and the Lit datepicker stops
accepting a typed date outside its own bounds, which its grid already refused.
