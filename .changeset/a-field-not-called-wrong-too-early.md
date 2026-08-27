---
"@modyra/widgets": patch
"@modyra/plain": patch
---

A field is not announced wrong before anybody has reached it

A required field that is still empty is not a mistake — it is a field somebody has not got to yet.
Three kinds announced `aria-invalid="true"` on a form nobody had touched, and painted nothing: a person
looking saw a clean form while a person listening heard one already failing, and the refusal that does
matter arrived later sounding exactly the same.

The contract's own projections had it right. The renderer wrote the attribute again, from a different
question — *is this field invalid* rather than *is this refusal one to show now* — and its write landed
after, so the wrong answer won. `select`, `datepicker` and `timepicker` now ask what everything else
asks, naming their kind so that a value which *is* that kind's empty is not read as one that arrived
from a draft or a server.
