---
"@modyra/core": patch
---

`acceptedCount + rejectedCount` is what the document declared

The pair is worth reading because it lets a caller tell "three fields, one refused" from "two
fields". For a document whose fields all live inside collections it said neither:

```
v3/nested-collections.json   accepted 0, rejected 0   — it declares five fields
v3/positional-nesting.json   accepted 0, rejected 0   — it declares four
```

Both are published fixtures, both parse cleanly, and both have their collections found and reported.
A field inside a collection is declared and legitimately never becomes a flat field — a document
cannot name rows that do not exist yet — so `fields` cannot answer for it, and the pair was the one
place that could.

The count now descends into collections, and a rejection is counted from what was **reported** rather
than from the difference between declared and kept: counting the difference would call every
collection cell a rejection, and a correct document would read as having lost everything.

A collection itself still counts as neither — it is understood, and reported by path and kind.
