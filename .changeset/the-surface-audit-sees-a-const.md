---
"@modyra/widgets": patch
---

The type-surface audit records exported constants, so a public name can no longer
enter or leave the surface with nothing reporting it.

Nothing shipped changed. The audit recorded interfaces, type aliases, classes and
`function` declarations, and not variable statements — so its blind spot followed
how a declaration is spelled rather than what it is. `MDY_EMPTY` shipped named only
by a hand-written changeset, which is what surfaced this; but the same hole hid
every validator, because they are written `export const required = () => …`.
`required`, `email` and `minLength` — the most-imported names in the repository —
were outside the audit entirely, while `field` and `createForm`, written
`export function`, were inside it.

The baseline grows from 837 recorded shapes to 992. Those are names that were
already public and already shipped: they are newly *recorded*, not newly exported,
and the diff's wording on first acceptance says the latter because it can only
compare what it has.

A constant's value is deliberately not recorded. A tuned threshold is not a surface
change, and a baseline that moved on every one would be re-accepted without reading.

`test:coverage-and-demo` measures constants apart from its verdict and prints their
count and the unexercised ones by name: folding them in would have moved that gate
by a definition change rather than by anything anybody did, and dropping them
quietly would have been the hole again under another name.
