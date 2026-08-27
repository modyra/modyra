---
"@modyra/angular": patch
---

A layout bound past the depth limit drops the arrangement and keeps the questions

Angular's dynamic form applied the nesting limit by throwing from the computed that reads its
`layout` input. A template has nowhere to catch: the exception took the whole view down — no
sections and **no fields** — and in an application it reached the installed error handler, which
swallowed it, leaving a form that reported itself mounted with no structure and nothing said.

Strictly worse than the silence it replaced. A bound layout is now refused the way a document is:
the arrangement is dropped, the questions still reach the person, and the reason — the depth, the
path and why the limit exists — is stated where a developer looks.

The dividing line is not imperative against declarative but whether there is anywhere to catch. A
function call has a caller holding the result who cannot notice silence, so `mountMdyForm` still
throws. ADR 0160 carries all three shapes.
