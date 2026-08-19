---
"@modyra/core": minor
---

A form is stopped from replacing another form's draft even when its own shape contains the other's.
The guard asked "is every stored path one I declare", which answers yes for a superset — so a second
form with one field more read the first's work as its own and overwrote it, silently. A draft now
carries the shape of the form that wrote it (`MdyFormEngine.shapeKey()`, the paths it was built with,
hashed), and a form that does not have that shape keeps no draft under the key and says so. A draft
written before this carries no shape and falls back to the path comparison, so nothing stored
already becomes unreadable.
