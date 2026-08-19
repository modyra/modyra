---
"@modyra/core": patch
---

Reading a form no longer depends on the order its fields were created in. A group, a collection and a
section each carry a field at their own path so that what is said *about* them — a condition, an
error — has somewhere to live, and that field's value is always `null`. Assembling the value wrote
paths in creation order, so when such a path was created *after* the fields under it — which is what
`setInactive` on a section does — its `null` replaced the whole branch, and `getValue()` threw
"Flat value does not match schema shape" on a form that held everything it should. A path that names
a branch no longer overwrites it.
