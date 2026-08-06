---
"@modyra/core": patch
---

Fix two latent bugs found during security audit:

1. **Custom sanitizer exception handling**: Custom sanitizers that throw exceptions now fail gracefully instead of crashing the form. Errors are reported through the violation telemetry hook and the original value is preserved.

2. **Array manager field cleanup**: Orphaned array row fields that accumulated during undo/redo cycles are now properly cleaned up. The reconciliation effect now detects and removes rows that have disappeared from the value but were still registered in the engine, preventing memory leaks.

Both fixes maintain backward compatibility and existing behavior for normal operations.
