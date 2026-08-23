---
"@modyra/lit": patch
---

The multiselect's box stops claiming a role, a name and a description no contract gives it.

It carried `role="group"`, `aria-label` and `aria-describedby` — alone among the three renderers, and
declared by none of them. That is an extra level in the accessibility tree for the same document
depending on which renderer drew it, which is the divergence `@modyra/widgets` exists to prevent.

Nothing is lost: the combobox inside the box holds the value, the name and the description, and the
list of options is the group the catalogue does declare — all three renderers already put it there.
