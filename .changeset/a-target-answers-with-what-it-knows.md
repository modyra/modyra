---
"@modyra/studio-codegen": minor
"@modyra/studio-target-core": patch
"@modyra/studio-target-react": patch
"@modyra/studio-target-angular": patch
---

A target answers with everything it knows about the project

`core`, `react` and `angular` reported only what their own generators found, so a project the
contract compiler rejects was answered with `compatible: true` and generated without a word — a
field whose kind no catalog declares became a plain leaf and the author's tooling had nothing to
stop on.

Each now carries the contract compiler's **errors** (its warnings stay with the contract document —
these targets emit the server validators it omits) and reports a field whose kind is not in its own
`capabilities.fieldKinds` through the new `capabilityDiagnostics`, the sibling of
`arrangementDiagnostics`.
