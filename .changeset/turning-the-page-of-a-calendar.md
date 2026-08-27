---
"@modyra/widgets": minor
---

A calendar declares the keys that turn its month

`PageDown` moves to the next month and `PageUp` to the one before, in all three renderers, and none
of them was asked to. An adapter written from the contract alone shipped a calendar that could not
leave the month it opened on: the arrows walk within a month and cross its edge one day at a time,
which is a long way to reach next March.

Declared for the kinds that have a `grid`, which is what a month is — a calendar has one and a list
does not, so a page key means something here and nothing there. `MdyKeyBinding` gains `page`,
separate from `by` rather than a third value in it, because the two compose: a page key carries a
direction like any other movement, and a reader asking "which way" gets the same answer from both.

Nothing renders differently. The table records a gesture the three already agreed on, and stops an
adapter from having to discover it.
