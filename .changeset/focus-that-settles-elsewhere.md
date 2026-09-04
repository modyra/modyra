---
"@modyra/widgets": minor
"@modyra/vue": patch
"@modyra/plain": patch
---

A panel closes when the keyboard settles outside the widget — in every renderer, from one place.

Every kind with a popup declares `dismissOnFocusOutside`. The rule was written out inside each
renderer that honoured it, which is exactly why it was honoured by one of four: a rule that lives in
a renderer is a rule the next renderer has to be told about. `@modyra/widgets` now publishes
`bindDismissOnFocusOutside`; `@modyra/plain` keeps the signature its fields call and hands the
question to it, and `@modyra/vue`'s six panel kinds ask it for the first time.

The spec that found this says why the severity exists better than a changeset can: *three
implementations written by the same hands agreeing is indistinguishable from conformance right up
until somebody who was not in the room implements the contract from the catalogue alone.*

**Arrival, not departure.** A departure names nowhere, and a panel that repaints — a calendar swapping
its day grid for its months — destroys the element holding focus and fires one. Bound that way,
opening the month view closes the calendar it belongs to.

**Inside the panel is inside the widget, wherever the panel is drawn.** The opener names it, so a
renderer that portals its panel out of the field does not stop owning it; a rule written as `contains`
on the field would shut the panel the moment somebody reached the thing they opened it for. And a
pointer outranks focus: a drag begun inside takes focus out on the way past, and closing there would
reinstate through the focus path the dismissal the pointer policy refuses.
