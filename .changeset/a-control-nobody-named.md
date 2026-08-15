---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": patch
---

A control a document did not label is named by its field

A label is optional in a document — deliberately: the published corpus declares fields without one,
and refusing them would invalidate the material that documents the contract. But a control with no
accessible name is announced as its role and nothing else, and
`MDY_SEMANTICS_REQUIRING_NAME` already says some roles may not be.

`fieldAccessibleName({ ariaLabel, label, name })` is the order, in one place so every renderer answers
the same: what a host wrote for the control, then the visible label, then the **field's own name**.

The fallback is not a poor one. A document's field name is a single segment — a dotted path is refused
where the document is read — and in the published corpus the names *are* the label's words: `city`,
`zip`, `email`, `first`, `last`, beside labels reading `City` and `ZIP`. Announcing `city` announces
the word the author would have written; announcing nothing announces "text box".

`@modyra/plain` names the element a person operates rather than the one it was handed — a slider
arrives wrapped in its track, and a name on the wrapper is a name the control does not carry — and
names a checkbox and a toggle, whose words sit beside the box rather than in a `<label for>`.
`@modyra/lit` takes the same order.

`nameIsAFallback` answers whether the name came from the field rather than from words for a person,
so a host that wants to report it can.
