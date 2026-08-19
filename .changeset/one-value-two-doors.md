---
"@modyra/core": patch
---

A value is sanitized the same number of times whichever door it came through

Every write that went *through* a collection ran the field's sanitizer twice: `setInitialValue`
sanitized into the baseline and the record then seeded itself from that baseline through the
sanitizer again. Those are the doors a form is *populated* by — a server response, a loaded record, a
row added.

It was written off on the grounds that a sanitizer is idempotent. DOMPurify is; escaping is not, and
escaping is what a text sanitizer does, so four load-and-save rounds with nobody touching the field
turned `Tom & Jerry` into `Tom &amp;amp;amp; Jerry` — a value nobody typed, with no moment at which
anyone got it wrong.

A declared initial is sanitized once, where it is declared; re-baselining a collection no longer
rewrites a value the field is already holding.
