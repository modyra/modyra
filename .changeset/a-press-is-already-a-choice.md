---
"@modyra/widgets": minor
"@modyra/lit": patch
"@modyra/angular": patch
---

A press is already a choice, and the dial's arrows obey the step

**A tap on the dial set nothing, in Angular and in Lit.** Both emitted only on move and on release,
so a pointer that lands and lifts without travelling produced no intent at all. On a mouse the jitter
between press and release hides it; on a touch screen there is no movement, and that is the entire
interaction on a phone. Plain was already correct and is what both now do: a press emits where the
pointer is, through the same call the move uses, so the two cannot differ.

**The dial's own keyboard restated the bounds and ignored the granularity.** `timepickerDialKeyIntent`
carried its own `min`, `max` and wrap, so on a field offering only some times the arrows walked
through values the face does not draw and the field would refuse — the keyboard being the one route
that reached them. It goes through `timeFieldBounds` and `stepTimeField` now, like a segment's arrows
and everything else. `End` answers the last value **on offer**, which is not the range's end when the
step does not divide it: a 12-hour clock stepping by five ends at 11, not 12.

That matters beyond tidiness. A dial is a pointer affordance, and the header's inputs are what make
the popup usable without one — WCAG 2.1.1. If its arrows disagreed with its face, the two ways in
would answer differently about the same field.
