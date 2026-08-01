---
"@modyra/core": patch
"@modyra/widgets": patch
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

No package names one it must not know about, and an audit keeps it that way.

`scripts/audit-package-independence.mjs` runs in `test:contracts`. The rule it enforces:
`@modyra/core` and `@modyra/widgets` are the contract and name no adapter at all; an adapter may name
itself and nothing else. Siblings are peers, not references.

It found **58 comments** across five packages, all the same shape — "modeled on Angular's real
component", "the same structure the themes style for the Angular renderer", "the answer Angular
kept", "Plain and Angular come through `current`". A framework-free renderer explaining its anatomy
by naming the framework one is the same inversion as the contract doing it, one layer down; and a
contract that cites a consumer is describing the wrong thing.

The import graph was clean throughout, which is why none of this was caught: nothing here is a
dependency, so nothing objects at build time. The audit checks file names too — that half is what an
`angular-ui.json` sitting in the widgets package would have failed.

`plain` counts only when spelled `@modyra/plain`, because it is also an ordinary adjective: a plain
button, a plain array.
