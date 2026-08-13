---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
---

`applyOverlayProperties` — a placement is written when it changes, not on every pass

A renderer re-applies an open popup's placement on every render pass, and most
of those writes set a custom property to the value it already holds. That is not
free: a custom property write invalidates style on the element and everything
inheriting from it, which for a popup holding a calendar is its whole subtree.

Measured on a calendar switching to its year view: **six writes per pass became
zero**, because the placement genuinely does not change — the contract holds the
decision it opened with.

The framework-free and Lit renderers consume it. Angular does not need it: it
binds a computed style object, and the framework already skips what has not
changed.
