---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/angular": patch
"@modyra/lit": patch
"@modyra/styles": minor
---

Declarative layout gets a contract, a grid and an audit

Contract v2 lets a form declare sections and column rows, but what they rendered as was Plain's
invention and no theme styled any of it. `MDY_LAYOUT_CLASSES`, `MDY_LAYOUT_COLUMN_COUNT_PROPERTY`
and `layoutNodeAttributes` name that vocabulary, the foundation draws the grid from it — even
tracks that may shrink, collapsing to a stack below 40rem — and Plain takes its classes from there.

`scripts/audit-layout-contract.mjs` (wired into `test:contracts`) checks that every class the
contract names is styled, that an adapter rendering layout consumes the contract rather than
literals, and lists the adapters that do not render layout yet: Lit and Angular. That gap is
recorded, not implied.

The timepicker's `hour` and `minute` now carry distinct modifiers. Sharing one class made the two
segments indistinguishable — the demo's own conformance banner reported a part-order violation
because both resolved to the same element.
