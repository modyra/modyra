---
"@modyra/core": patch
---

A constraint written where constraints do not live is reported

`validators: { required: true }` is the contract's spelling. `required: true` on the field is what an
author — or a model writing the document — reaches for instead, and the parser kept it, nothing read
it, and the form had no rule where its author believed there was one: no validation, no `required()`
on the handle, no `aria-required`, `ok: true` in strict mode. The same for `email`, `minLength`,
`maxLength` and `pattern`.

The nuance is what made it hard to learn: `min` and `max` at that level *do* work, because they are
legitimate members of a number field, so the same word meant two things depending on the level, and
only for some words.

A property whose name is a validator the contract declares, appearing where validators do not live,
is now reported (`MDY_DYNAMIC_MISPLACED_VALIDATOR`). Unknown members are still ignored, which is what
lets a v3 document be read by a parser that predates v3 — this is narrower: the contract already owns
these names.
