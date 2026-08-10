---
"@modyra/widgets": minor
"@modyra/lit": minor
---

The select's "name what the list cannot name" hook now exists in Lit as well as Angular.

`unknownOptionLabel` shipped on the Angular select and nowhere else, which made a rule of the
contract into one renderer's feature. It matters exactly where the value is an object: without it
such a value renders as `[object Object]` — honest, and useless.

The framework-free renderer deliberately has no such hook: its field configuration is data, and a
function cannot live in a document. There the value names itself.

Also new: `optionsWithUnrecognizedValues`, the multi-value form of the existing helper. Nothing uses
it yet — it exists so that closing the multiselect's half of ADR 0029 starts from one place rather
than three. See that record's amendment for what is still open there, and
`packages/plain/test/multiselect-unrecognized.test.mjs` for the tests that pin it.
