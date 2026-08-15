---
"@modyra/core": patch
---

A correct document does not report that something was rejected

The counter added so `acceptedCount + rejectedCount` describes the document treated a collection as a
declaration that failed to become a field. It is neither:

```
a leaf and a record   accepted 1, rejected 1, diagnostics []   collections ["rows"]
```

A correct document reported that something had been lost, with nothing to look at — while the same
result handed the author a `collections` list naming exactly the thing the count was about.

A collection is *understood*, not lost: it is reported by path and kind, and its cells are not flat
fields because a document cannot name rows that do not exist yet. It now counts as neither accepted
nor rejected, so a rejection always has a reason beside it.
