---
"@modyra/core": patch
---

A row handle follows the reorder, instead of the record it was born with.

`form.f.items.rows()` is recomputed from the row count, and a structural change destroys every row's
fields and registers them again. An operation that keeps the count — `move` above all — therefore
handed back **the same handle objects, pointing at records the engine had already destroyed**.

The consequence was not cosmetic. The arrangement the guide shows binds `rows()[i]` to a control, so
after a drag the control displayed the value the row held *before* the move, and what the user typed
into it went into a destroyed record: the model never changed, and nothing said so.

Row handles are now built the way a keyed collection's cells already were — resolving the field by
path on every read — which is what makes a handle survive a rebuild by construction. Measured
unchanged on the benchmarks and the form-scale budgets.

`record()` was never affected: its cells have resolved by path since they existed, which is why
sorting the demo's keyed table has always been safe.
