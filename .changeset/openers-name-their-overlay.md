---
"@modyra/widgets": minor
"@modyra/angular": patch
---

Every overlay opener names the element it opens, and the relation is checkable

Angular emitted `aria-expanded` on its select, colour and range openers and `aria-controls` on none
of them, so nothing tied an opener to the overlay it opened. All three now bind the shared opener
projection, and the element the relation names carries the id — on the node holding the popup's
contract classes, not on the positioning wrapper.

`MDY_POPUP_OPENERS` pointed the timepicker's relation at a `dialog` part the catalogue never
declared, so the relation named an id no part was responsible for rendering. The element exists and
carries `role="dialog"` and the modal semantics; the catalogue simply omitted it. It is declared now,
and a new assertion fails if any declared relation names a part the contract does not have.
