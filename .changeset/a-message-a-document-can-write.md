---
"@modyra/core": minor
---

A document can write what its own rules say when they refuse

The cross-field slot has carried a mandatory `message` since it existed, with the reason beside it:
*a validation nobody can read is a field that will not submit for no stated reason*. A field's own
rules had no such slot, so the one sentence a person must read to get any further was the one an
author could not write — and a document is the surface written by people who do not write code.

`validators.messages` names the rules a field declares — `required`, `email`, `min`, `max`,
`minLength`, `maxLength`, `pattern` — and each takes a sentence. Optional, because the framework has
one for every rule in the form's own language; a key that names no rule, or a message nobody can
read, is refused where the document is read. Both published schemas carry the slot.
