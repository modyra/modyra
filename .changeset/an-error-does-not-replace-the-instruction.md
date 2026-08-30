---
"@modyra/angular": patch
---

An error does not take the place of the instruction that would have prevented it

Nine Angular renderers rendered the supporting text as the alternative to the error container:
`@if (errorsReserved()) { … } @else if (supportingText()) { … }`. So a field that could fail lost its
supporting text the moment the container was reserved — which is every field with a rule — and the
person who most needed the instruction was the one who never saw it.

`aria-describedby` named both throughout, because the shared projection says both: *an error does not
take the place of the instruction that would have prevented it*. With only one of them on the page,
three controls pointed at a description element that did not exist. A dangling reference is a
description that comes back empty, which is what the accessible-description sweep read.

Both render now, error first, in the order the reference names them.
