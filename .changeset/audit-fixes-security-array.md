---
"@modyra/core": major
---

Fix two latent bugs found during security audit:

1. **Custom sanitizer exception handling**: Custom sanitizers that throw exceptions now fail gracefully instead of crashing the form. Errors are reported through the violation telemetry hook and the original value is preserved.

2. **Array manager field cleanup**: Orphaned array row fields that accumulated during undo/redo cycles are now properly cleaned up. The reconciliation effect now detects and removes rows that have disappeared from the value but were still registered in the engine, preventing memory leaks.

Behaviour is unchanged for normal operations, but the **type surface is not**: reporting the new
failure added `"sanitizer-error"` to `MdySecurityViolationKind`, which is a closed union in a return
position — `MdyValueSecurityResult.actions[].kind` — and is also what `MdySecurityPolicy.onViolation`
receives. A consumer that switches exhaustively over either, with an `assertNever` default, stops
compiling. `npm run test:type-surface` classifies it major, and that is what it is.

Migration: handle `"sanitizer-error"` alongside `"sanitized"` and `"max-length"`. It reports that a
custom sanitizer threw; the original value was preserved, so treating it like `"sanitized"` is wrong
— nothing was stripped.
