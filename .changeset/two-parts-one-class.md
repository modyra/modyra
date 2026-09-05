---
"@modyra/widgets": patch
---

Two parts with one class are told apart by where they live

A kind may declare two parts carrying identical classes — a timepicker's hour and minute boxes are
both `mdy-timepicker-segment-input`, and no selector separates them. The contract distinguishes them
the only way it can: the hour box lives inside the hour segment, the minute box inside the minute
segment. The comment beside the code that resolved them said exactly that — "what separates them is
already in the anatomy" — and the code used their position among the matches instead.

Measured on a document that draws the segments in the other order: the walk bound each part to the
other's element, then reported both as sitting outside the parent they were sitting inside. **One
true finding became three, two of them false** — and the true one, that a segment is out of the
declared order, was the one a reader had to find among them.

Parts are now resolved by their declared parent, falling back to declared order only where the
parent does not separate them — two parts under one parent have nothing else to be told apart by.

This is the kit's own resolution rule, not a public contract: no declared part, class or relation
moves. What changes is which element a check is looking at when two parts could claim the same one.
