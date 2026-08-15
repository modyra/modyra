---
"@modyra/core": patch
---

A list grows to receive the next row, not to reach a number

A draft is read back flat, and a path for a row the list does not have yet made the list grow to reach
it. `tags.5` on a list of one produced `["t", "", "", "", "", "X"]` — five entries nobody typed — and
the number came from storage, which anything on the origin can write. It is not linear: a list of
50,001 took five seconds to restore and a large enough index stopped the form opening at all.

A positional collection now grows by the row a path names and only when that row is the next one. A
write that legitimately carries a list carries every index in it.

**A flat write is applied in path order**, numerically where a segment is a number. Object key order
is the order a document happened to be serialised in; sorting makes a write's effect the same
whichever order it arrives in, which is what lets a list grow one row at a time without depending on
how storage was written.
