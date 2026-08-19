---
"@modyra/core": patch
---

A condition whose `operands` is not a list is refused with a diagnostic instead of throwing out of
the reader. The shape guard recognised a *missing* clause and not a malformed one, so
`{ op: "equals", operands: "x" }` — the shape a missing pair of brackets takes, and what a model
generating JSON produces — reached `.forEach` and raised `operands.forEach is not a function`,
naming neither the document nor the field nor the clause, in lenient mode as well as strict. Lenient
is the mode a consumer chooses precisely to survive a document they do not control.
