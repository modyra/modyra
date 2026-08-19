---
"@modyra/core": patch
---

`acceptedCount` and `rejectedCount` add up for the documents a host actually receives: the walk that
counts what a document declared stopped at ten thousand declarations, so a document refused whole
after declaring fifty thousand fields reported having lost 9,999 of them — a number short by a factor
of five for a host reading the counts to see how much of a generated document survived. The bound
stays, an order of magnitude higher, and a document past it now carries
`MDY_DYNAMIC_COUNT_INCOMPLETE`: the counts are a floor and say so.
