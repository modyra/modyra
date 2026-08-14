---
"@modyra/studio-contract": minor
"@modyra/studio-model": minor
"@modyra/studio-editor": minor
---

Studio draws the nesting the engine runs

`@modyra/core` lifted the one-positional-level rule and the depth cap (ADR 0043), and Studio stated
the old rule in three places: `ArrayNode.item` excluded another array, the editor refused to insert
one, and the compiler reported `UNSUPPORTED_NESTING` and emitted nothing for that branch.

An array's row is any schema node now, the editor inserts what a project declares, and the compiler
emits the nesting. `UNSUPPORTED_NESTING` is gone: no shape produces it, so a consumer matching on the
code will never see it again.
