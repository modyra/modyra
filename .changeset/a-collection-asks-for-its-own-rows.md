---
"@modyra/core": minor
---

Declaring rows into a collection no longer costs more per row the more rows there are

Two questions scoped to a path were answered by a scan of the whole form: the gates covering a path
were found by walking every registered gate, and an array's reconciliation read every field name the
form holds to keep the ones under itself. A collection registers a gate and runs that effect, so a
form holding a collection per row paid both once per row — the cost of a bulk write grew with the
square of the row count. Measured on orders holding ten lines each, per order: 1.12 ms at 25 orders,
1.63 at 100, 3.56 at 200.

Gates are now looked up at the path's own ancestors, and `MdyFormEngine` keeps the child segments
under each prefix and answers `childSegmentsUnder(prefix)` from them. Per order after: 0.55, 0.41,
0.58 — flat.

`MdyCollectionHost.childSegmentsUnder` is optional, so a host implemented against the published
interface keeps working and is asked `fieldNames()` as before. `MdyFormEngine` gains the method,
which is additive. See ADR 0101.
