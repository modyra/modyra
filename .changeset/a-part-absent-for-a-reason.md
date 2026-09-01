---
"@modyra/widgets": minor
---

A part's absence is read with the reason it is allowed

"Missing" is three findings wearing one word: a part the contract requires and the renderer did not
draw, a part excused by a condition that does not hold right now, and a part nobody looked for. A
reader shown "absent" for all three goes to the wrong repair twice out of three times.

`readPartPresence` returns an observation with a verdict — `drawn`, `extra`, `excused`, `missing` —
and names the condition when the absence is excused. Only `missing` is a defect; `extra` is a
renderer drawing an optional part it was not obliged to, which is its prerogative.

**The excuse is evaluated when it is asked**, through the contract's own `partIsOwed`. The same part
is excused while an overlay is closed and owed the moment it opens, in the same session, without the
caller re-declaring anything — which is what ADR 0188 says to check by opening the overlay rather
than by reading the code. A mutation that computes the excuse once fails exactly that test.

Named `MdyPartObservation`: `MdyPartPresence` is already the vocabulary of *conditions* a part may be
gated on, and one name for both senses would make a reader ask which they had in front of them.
