---
"@modyra/core": patch
---

A field reports each message once, however many rules say it

The kind's own shape guard is attached by the schema `buildFlatFormSchema` produces *and* by
`applyFlatValidators`, which applies a document's validators — and calling both is what the flat
route documents. A field holding the wrong shape then reported `This field holds number` twice, once
per call.

Two rules that say the same sentence are one thing for the person to fix, so a field's synchronous
errors are reported once per distinct message. Nothing about which rules run changes.
