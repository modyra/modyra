---
"@modyra/lit": patch
---

The dial reports where the pointer is

The clock read its own angle with `angleToHour`, which answers for the outer ring alone, and built a
time string from it — so a 24-hour face could only ever name the twelve numbers outside, and `00` and
13–23 were unreachable however carefully you aimed.

It now sends the position it actually knows: the angle and which ring, as `set-from-angle`, with the
hand's length read from `--tp-hand-length` so the hit cannot drift from the paint. What those mean —
which of the two hours lying in that direction — is the controller's to say.

Dragging carries them too, so the hand follows a finger across both rings.
