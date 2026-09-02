---
"@modyra/angular": patch
---

The select renderer asks the catalogue for its class names

Nine parts' classes are taken from `widgetContract.parts.X.classes` instead of being spelled in the
template. The classes emitted are the same strings; what changes is that there is now one place they
are written instead of two.
