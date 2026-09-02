---
"@modyra/widgets": minor
---

An id two elements claim, counted

A duplicate id does not fail loudly. `getElementById` returns the first, `label[for]` names the
first, and every reference resolves to whichever element the document holds first — so two instances
of one widget produce a form where clicking the second field's label focuses the first, and nothing
anywhere reports an error.

`readIdClaims` counts rather than flags: two elements claiming an id is a collision, five is a loop
that has been minting the same id since it was written, and the number is the difference between a
mistake and a mechanism.

Shown able to see the defect rather than assumed to be: two forms mounted from one document claim no
id twice, because plain scopes them — and with a duplicate planted in that same page the collector
names it and its count. A green from the first measurement alone would have proved only that the
page was clean, never that anything was looking.

On `@modyra/widgets/testing`: `readIdClaims`, returning `MdyIdClaim` per id.
