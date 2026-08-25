---
"@modyra/angular": patch
---

A read-only file field says it cannot be operated

The contract declares no read-only state for `file`, and the reason is written in the renderers: the
picker belongs to the browser and the element's role has no `aria-readonly` to carry. What *is*
expressible is that the affordance cannot be operated, while the field stays in play — focusable,
submitted, validated. The plain and Lit renderers already said it that way.

Angular did not: locking the field left the browse button, the drop zone and the clear button fully
operable and looking it. Nothing on the page — and nothing in the accessibility tree — said the field
was locked.

The three now agree.
