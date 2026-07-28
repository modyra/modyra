---
"@modyra/core": minor
---

Add `daterange`, `file` and `colors` to the dynamic field union, so the Contract covers every
`@modyra/widgets` catalog kind. The change is additive: parsers on earlier versions drop the new
kinds in lenient mode and reject them in strict mode.
