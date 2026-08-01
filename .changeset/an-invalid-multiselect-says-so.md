---
"@modyra/lit": patch
---

An invalid multiselect says that it is invalid.

The state projection landed on the wrapper the chips sit in, not on the search button the label
names and the user focuses, so `aria-invalid` was on an element no assistive technology reads it
from. The button already carried `aria-describedby`, which is what hid this: the error list was on
screen and the reference reached it, and only reading the state itself found that the field never
said it was wrong.

The button now carries `aria-invalid` under the same predicate as its description — touched, with
errors — so the two cannot disagree about whether there is anything to announce.

Deliberately the attribute rather than the whole projection: applying a field-shell part contract to
that button is how this renderer's sibling ended up with one class naming two elements.
