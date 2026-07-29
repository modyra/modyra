---
"@modyra/angular": minor
---

Angular names a popup's placement the way the catalog does

`<mdy-overlay-panel>` emitted `mdy-overlay-panel--above` and `mdy-overlay-panel--overlay`. No
stylesheet in the workspace has ever matched either — while the catalog had declared `above` and
`overlay` as states of every popup part all along, and `@modyra/plain` now emits exactly that.

The panel takes a `kind`, and reflects the placement through `partClasses(kind, "popup", …)`. A
datepicker opening upwards wears `mdy-datepicker__popup--above`, which is the class the foundation
styles and the class Plain writes. `below` carries none, as the catalog documents.

`mdy-overlay-panel--above` and `--overlay` are **no longer emitted**. Nothing styled them, so no
theme changes; a host that had written its own rule against those names should move it to the
widget's popup class. `--right`, `--modal` and `--visible` are unchanged — they describe the panel
element rather than the popup part, and the catalog names no state for them.

Wired for datepicker, daterange, timepicker and multiselect. `select` and `colors` do not pass a
kind yet and reflect nothing, exactly as before.
