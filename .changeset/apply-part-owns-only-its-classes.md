---
"@modyra/widgets": patch
---

`applyPart` no longer removes classes it did not add

It rebuilt the whole `class` attribute from a baseline captured on the first call, so any class a
host added afterwards — a framework binding toggling a state class, most often — was erased on the
next apply. Nothing broke visibly: the element still rendered, just without the class.

It now tracks the classes it put on the element and takes back only those. A contract that names no
classes, which is every projection-driven part, leaves `class` alone entirely.
