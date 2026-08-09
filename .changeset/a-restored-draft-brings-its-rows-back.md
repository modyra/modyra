---
"@modyra/core": patch
---

A record's rows survive a draft restore and an undo.

Drafts and history write a flat value straight into the engine, and the gate that stops a mounting
control from declaring a row was refusing those writes too — a restored draft came back with its rows
missing. A value arriving for an undeclared path is now offered to the collection that owns it, which
declares the row; a control mounting still declares nothing. `MdyPathGate` is exported for adapters
that own keyed paths of their own.
