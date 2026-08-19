---
"@modyra/core": patch
---

A mistake the parser reports at the top of a document is reported inside a row

The document walk knew a node's shape and left what a *field* declares to the flat reader, which
never sees a cell inside a collection. So a `kind` nobody declared, or a `validators.pattern` that is
a number, parsed clean in every mode at any depth below a row — and then met `buildDynamicFormSchema`,
which throws, at the point where a person is already waiting.

Every check a field gets in a flat list now applies wherever the field is, reported at its own path.
