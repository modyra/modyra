---
"@modyra/plain": patch
---

The last two kinds stop announcing themselves wrong before anybody has reached them

A range and a file field marked their controls `aria-invalid="true"` on a form nobody had touched,
while the error list beside them rendered nothing — the same split between what is seen and what is
heard that the other kinds had.

The cause is one line shorter than the previous one. Both renderers project the field shell
themselves, and the shell decides what to announce from an optional answer it is given: *is this
refusal one to show now*. Neither passed it, so the shell fell back to the only thing it could ask
on its own — *is there an error at all* — which is true for a required field from the first paint.
Three lines further down each renderer asked the right question to fill its error list, so the two
halves of one verdict were computed in the same function and only one of them reached the control.

Both now pass what they already knew, naming their kind so that a value which *is* that kind's empty
is not read as one that arrived from a draft or a server.
