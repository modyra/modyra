---
"@modyra/core": minor
---

A record's row may hold an array, and a form's nesting has one published limit.

Phase B of the nested-collections ladder: a `record()` row may now declare an
`array()` — an order whose lines are positional, a line whose allocations are a
list. The row owns it like any other subtree: it is created with the row,
removed with it, and restored whole by undo.

An array's row still holds no collection: its rows are positional, so a
descendant's whole path moves on every insert, remove and move (ADR 0040).

Nesting is capped at 8 levels, collections included — the number the document
validator has published since before collections could nest. A deeper schema is
refused where the form is built.
