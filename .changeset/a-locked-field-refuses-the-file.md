---
"@modyra/plain": patch
"@modyra/lit": patch
---

A read-only file field refuses the file

Locking a file field disabled the button that opens the picker, and nothing else. A file dropped on
the field, handed to the input by a script, or delivered by an assistive technology driving the
control was written straight into the model — a value the application had declared unchangeable,
changed.

Measured: with the field locked and the file delivered to the input directly, plain and Lit took it
and Angular did not. Angular was the only one that held.

The refusal now lives where the value is written rather than on the affordance, so every route in is
covered by one guard. **A guard on a door is not a lock.**
