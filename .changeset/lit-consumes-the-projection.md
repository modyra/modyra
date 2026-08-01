---
"@modyra/lit": patch
---

Lit elements take their semantic state from the shared projection

Every element named its own ARIA attributes, and between them they covered different subsets: none
emitted `aria-disabled` at all, and `aria-invalid` was absent from the slider, toggle, segmented
control and colour picker.

Elements now bind `${mdyPart(this.controlPart(handle))}` and receive `aria-invalid`,
`aria-required`, `aria-disabled` and `aria-describedby` from the projection in `@modyra/widgets`.
An attribute added there reaches the DOM without an element being touched.

Placement follows the contract rather than the markup: the segmented control carries the field's
state on its group, since each button carries its own option state, and the colour picker carries it
on the native input the contract names as its control.
