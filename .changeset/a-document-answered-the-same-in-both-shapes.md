---
"@modyra/core": patch
---

A tree document is told what a flat document is told

The same defect written as a flat list and as a v2 tree got two answers, and the tree — the shape the
current spec describes and a CMS sends — got silence:

```
a kind nobody declared     flat: MDY_DYNAMIC_UNKNOWN_KIND       tree: kept 0, nothing said
a select with no options   flat: MDY_DYNAMIC_OPTIONS_REQUIRED   tree: kept 0, nothing said
a costly pattern           flat: MDY_DYNAMIC_PATTERN_TOO_COSTLY tree: kept 1, nothing said
```

`strict` approved a document whose only field it had dropped — `ok: true, fields: [], diagnostics:
[]` — because `ok` follows the diagnostics and there were none. Strict mode is the check documented
for saving a contract or accepting one into a registry.

The tree walk now reports through the same sink the flat list does, with the leaf's own path. And the
counts describe the document rather than what survived it: `acceptedCount + rejectedCount` equals what
was declared, including for a schema refused before the walk runs — three children entering and
nothing coming back used to report `rejectedCount: 0`.

`strict` now refuses documents it used to approve. Recorded as
[ADR 0071](../docs/architecture/0071-a-document-is-answered-the-same-in-both-its-shapes.md).
