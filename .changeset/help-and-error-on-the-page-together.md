---
"@modyra/lit": minor
---

Help and error appear together, in the order the contract declares

Two defects, both invisible because no fixture had ever put a help line and an error message on the
page at the same time.

**Seven kinds rendered their error list above their supporting text**, and the contract declares
`supportingText` before `errors` for all seventeen. The conformance kit checks part order and cannot
check an order between two elements when only one of them exists, so every suite was green — and
restoring the wrong order after fixing it changed nothing anywhere, which is how this was found.

**The radio group and the select rendered one *or* the other**: `showBlockErrors ? renderErrors() :
renderSupportingText()`. So the moment either field failed, the instruction that would have prevented
the failure left the page, at the one moment it was most useful. Both now render, help first.

`packages/lit/test/help-and-error-together.test.mjs` is the fixture that was missing. It reads the
expected order from the contract rather than restating it — a fixture that repeats the answer it
checks passes when the contract moves and the renderer does not — and it covers eight elements.
Planting either defect back fails it.
