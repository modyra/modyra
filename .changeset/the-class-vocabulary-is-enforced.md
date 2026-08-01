---
"@modyra/widgets": minor
---

The class vocabulary is enforced, and modifiers are bounded by declared states

`strictClasses` gated the invented-class check and no adapter suite enabled it — the only caller was
a unit test. All three now do, so a class outside the contract fails on Plain, Angular and Lit.

Even enabled it was too loose: any `base--modifier` passed as long as the base was canonical, so
`mdy-label--anything` was accepted. A part's `states` exist to make the classes it can carry finite,
and nothing read them. Modifiers are now checked against the states their part declares —
`mdy-chip--selected` passes, `mdy-chip--invented` does not. A part that declares no states stays
unconstrained, since that vocabulary is still being filled in.

Each adapter carries an enumerated list of the classes it uses that the contract does not yet
declare — 31 on Plain, 40 on Angular, 6 on Lit. The lists are asserted, so a class added tomorrow
fails until it is declared or added deliberately. They fall into three groups: adapter-internal
hooks, classes the widget's own runtime projections emit that the static catalogue never lists, and
structural classes the themes style that the catalogue has never described.
