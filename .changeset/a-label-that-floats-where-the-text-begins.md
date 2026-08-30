---
"@modyra/styles": patch
---

A label that floats where the text begins

The floating label was positioned with `left` and shrunk from `transform-origin: left top`, so under
`dir="rtl"` it stayed on the left while the field it labels ran the other way — measured 10px from
the left in both directions, on a control whose own text begins 10px from the right. At rest the
label stands in for the placeholder, so it belongs at the edge that text starts from.

`inset-inline-start` now, with the origin flipped for `rtl` because `transform-origin` has no logical
keyword with usable support — so the one case that needs it is stated rather than derived.

No screenshot changed, and that is the finding underneath: **nothing on any demo page draws this
mode**, in any of the three renderers, though two of them publish it. A block of the foundation was
covered by no picture and no check. `e2e/lit/a-label-that-floats-where-the-text-begins.spec.ts` is
the first, applying the class lit's own `floatingLabel` property toggles.
