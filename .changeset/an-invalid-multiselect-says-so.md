---
"@modyra/lit": patch
---

An invalid multiselect says that it is invalid.

The state projection landed on the wrapper the chips sit in, not on the search button the label
names and the user focuses, so `aria-invalid` was on an element no assistive technology reads it
from. The button already carried `aria-describedby`, which is what hid this: the error list was on
screen and the reference reached it, and only reading the state itself found that the field never
said it was wrong.

The button now carries `aria-invalid` under the contract's own rule — a field with errors is invalid —
rather than under the one that decides whether the *list* is shown. Those are different questions:
having errors is not the same as showing them, and only the second waits for the user to touch the
field. Gating the attribute on `touched` passed every test that drives the invalid state and
disagreed with the projection everywhere else, which is how the disabled state caught it.

Deliberately the attribute rather than the whole projection: applying a field-shell part contract to
that button is how this renderer's sibling ended up with one class naming two elements.
