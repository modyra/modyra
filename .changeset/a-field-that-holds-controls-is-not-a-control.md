---
"@modyra/widgets": minor
"@modyra/styles": patch
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A multiselect's chip strip is a sibling of the control that opens the list, not its child.

`MDY_WIDGET_CONTRACTS.multiselect.parts.chips` now hangs from `inputWrapper` rather than from
`trigger`, and is declared before it so the reading order is the drawing order. Every renderer draws
it beside the opener.

**Why it had to be structural.** Each chip carries a button that takes a value off, and the opener is
a `<button>` — invalid HTML, and worse than invalid: a press aimed at the opener could land on a
delete, and which one depended on how long a chosen label happened to be. Aligning the field's
affordances moved that hazard without removing it — sampled across the opener's midline it went from
the midpoint to 17% of the whole line — which is what a rule expressed in geometry does. The
invariant is structural instead, and checkable as one: *the opener has no operable descendants.*

Pressing the field's empty area still opens the list. It is now a behaviour of the box, which
forwards a press on **its own** area; a press that lands on a chip never reaches the opener, because
a chip is not inside it.

`@modyra/styles`: the strip takes the width its chips need and the opener takes the rest. Inside the
opener the strip had nothing to share the row with; as siblings, a strip that still grew covered the
opener and the opener covered it back.

**Migration for a renderer implementing this contract**: draw the strip as a sibling of the opener
inside the field's box, before it; forward a press on the box's own area to the opener; and do not
give either the full width of the row.

See ADR 0142.
