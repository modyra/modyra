---
"@modyra/core": patch
---

An operand that names more than one of `{path}`, `{self}`, `{root}` and `{context}` is refused where
an expression is validated, and each guard answers `false` for it. One carrying two was claimed by
two guards at once and parsed clean, so which half it meant was decided by the order a reader
happened to ask in — a document meaning one thing here and another in the Rust or Java reader of the
same contract, on a document all three accept. A context key of no characters is not a context
reference either: the guard now agrees with the validator that has always refused it. See ADR 0092's
amendment.
