---
"@modyra/widgets": minor
---

The element vocabulary says what it admits

`MdyWidgetSemanticElement` names twenty categories a renderer maps to its own rendering API, and
said nothing about what any of them means. The table that decides — which tags and roles each
category admits — existed, was enforced by every conformance run, and was **not exported**: a
renderer author could not read the rule they were being judged against.

`MDY_SEMANTIC_ELEMENTS` is now published from `@modyra/widgets/testing`, and the type carries a
line per category derived from it — including which four are deliberately unconstrained, and why
`container` and `presentation` are not the same answer.

The distance this closes is measurable: the reference renderer written from the published contract
alone had to invent its own mapping, covered twelve of the twenty categories, and named two that do
not exist.
