---
"@modyra/plain": patch
"@modyra/lit": patch
---

The file field's rules come from the contract, not from each renderer

`createFileFieldController` became importable in the previous release and nobody was calling it —
each renderer had written its own copy of what it does: the accept-and-reject transition, the
separate list of what a pick turned away, and the guard that belongs on the model rather than on the
button. That last one carried the same comment in both, word for word: *a file still arrives by being
dropped, by a script, or through an assistive technology driving the input, and a guard on a door is
not a lock.*

Two of the three now call it. Adoption goes from 42 of 51 renderer/kind pairs to 44.

**Angular does not, and not because it was harder to type.** Its file field routes every value change
through its own intent pipeline rather than setting the handle, so a controller that sets the handle
would make two things own the value. That is a question about how that renderer moves values, not a
swap, and answering it by doing the swap would have left the field with two sources of truth.

The element's own `value` is still cleared by hand where the field is cleared: a file input keeps the
last pick's name until it is told otherwise, and no model owns that.
