---
"@modyra/core": minor
---

`MdyDynamicFormConfig` is the family, not version one

The type described version 1 alone — `{ version: 1; fields }` — so a consumer typing their document
against the name the package advertises was *required* by the compiler to write the one version the
parser had just stopped accepting. The migration ADR 0136 carries — set `"version": 2` — was not one
the published type allowed.

It is now the versions this contract has. `MdyDynamicFormConfigV2`, `V3` and `V4` remain for a
consumer who wants to say which one they wrote, and `MdyDynamicFormDocument` is unchanged in meaning.

Verified in both directions against the built package: a document declaring `version: 2` compiles, and
one declaring `version: 1` is refused by the compiler as it is by the parser.
