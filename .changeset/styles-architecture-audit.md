---
"@modyra/styles": minor
---

The architecture is enforced, and `[hidden]` is the foundation's word

`scripts/audit-styles-architecture.mjs` (run by `test:themes`) holds the migration's premise to
account: a theme may not name an adapter, position an overlay, or re-declare `[hidden]`, and the
foundation may not carry a brand face or a literal palette. What remains is listed as debt with the
reason it is still there — Material and iOS still placing the colours popup, and every theme still
importing the default one — so the list can shrink but not grow unnoticed.

Hiding is now stated once, by the foundation, for anything inside a renderer or a popup. Modern had
restated it four times because a theme's `display` beats the UA's `[hidden]`, and each restatement
was a bug already met. The default theme also stops naming Roboto as its clock's fallback face.
