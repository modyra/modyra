---
"@modyra/widgets": major
---

Every part declares what element it is, and an undeclared one fails

`semanticElement()` ended in `return "group"`, so a part nobody had classified silently admitted any
element at all — 121 of 237 nodes were `group` because the question had never been asked. A part name
missing from the new `PART_SEMANTICS` map now throws at load: the contract does not get to have no
opinion by accident.

`group` still exists and means what it always did — a container the contract leaves unconstrained —
but it is now an answer rather than the absence of one, and it covers 48 nodes instead of 121.

Two semantics are new because the old vocabulary could not express what the widgets are.
`columnheader` is a weekday above a calendar: a grid cell, not prose. `affordance` is a label or a
button that reaches a value.

`text` is no longer unconstrained: prose may be a `<p>`, a `<div>`, a `<span>` and several others,
and may not be a control or a button pretending to be a caption. Supporting text is classified as
prose rather than as a live status, which it never was.

Declaring the semantics found one real divergence: supporting text is a `<div>` in one renderer and a
`<p>` in another. Both are prose and both now conform, which is the answer — the contract had simply
never said so.
