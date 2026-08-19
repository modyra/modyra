---
"@modyra/studio-model": patch
---

Studio reports an option list a form cannot render: two options sharing a value, and a value carrying
a space or the `__` that separates the parts of a generated id. An option's value becomes part of its
id, so a shared value is a shared id — the rendered list is short one option and a keyboard lands on
whichever the DOM found first — and a space splits the ARIA reference that points at it, because
those attributes are space-separated lists of ids. Both compiled without a word beside the empty
list, which the compiler already refuses.
