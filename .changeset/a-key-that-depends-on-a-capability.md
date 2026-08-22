---
"@modyra/widgets": minor
---

A key that depends on a capability says so

`MdyKeyBinding` gains `requires?: string`, the field-level capability a binding depends on where the
kind alone does not decide it. `on` says which part answers a key; this says whether the key exists
at all for this field.

Reordering forced it. Every multiselect has chips, and only one declared `reorderable` has an order a
person may change — so `Alt`+`ArrowLeft` and `Alt`+`ArrowRight` now carry `requires: "reorderable"`.
Until now the table said the kind answers four keys that a default field answers none of, and anything
reading it across kinds — a sweep, a help panel, a consumer's own key handler — had to carry its own
list of which ones were conditional. A capability named in the table is one a reader can ask the field
about.
