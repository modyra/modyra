---
"@modyra/core": minor
---

An array's row may hold a record, rebuilt atomically.

Phase C of the nested-collections ladder: an `array()` row may declare a
`record()` — an order line whose allocations are keyed by lot. `insert`,
`remove` and `move` rebuild the descendant under its new index: values follow
the row, and touched/dirty do not, exactly as an array's own rows have always
behaved (ADR 0040).

The rule that replaces the old blanket refusal is **one positional level per
path**: an array below another array is refused where the schema is written,
including below a record an array's row declared, because two positional levels
make a descendant's path move for two reasons nothing can tell apart.
