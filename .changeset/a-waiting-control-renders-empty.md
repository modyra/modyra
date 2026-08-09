---
"@modyra/angular": patch
---

A control bound to a row that has not been declared renders empty instead of throwing.

`getField` answers `null` for exactly one reason — a path inside a keyed collection whose row is not
declared — so the control now serves the inert state it already had for an unresolved binding, and
binds when the row arrives. Every other path still creates its field on demand, so a mistyped name is
unaffected by this.
