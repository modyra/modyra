---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A ring you have to reach for, and a rule every renderer follows

Three defects the user found by using it, all in the same place.

**The inner ring claimed most of the face.** It was everything closer to the centre than the midpoint
between the two rings — so the empty middle, which is most of a dial's area, answered with an hour
whose number was nowhere near the pointer, and the hand jumped short for a press aimed at the outer
ring. It is now a band as wide as the gap between the two painted radii, centred on the inner one:
near the digits to claim them, and anything else belongs to the ring drawn out there.

**A minute face has one ring, and was being asked about two.** `timepickerDialRing` did not know
which field was being picked, so a press near the middle of a minute dial read as `inner` and
shortened the hand for a ring that does not exist. It takes the field now.

**The hand's length changed only at the ends of a gesture.** In Angular the ring was a plain field,
so the view was never told it had changed: the hand kept the length it began with and snapped on
release. It is a signal, and the length follows the pointer.

And the part that mattered most: **the granularity was enforced in one renderer of three.** Angular
passed the steps down; plain and lit called the same contract functions without them, so a document
declaring quarter-hour minutes still took `07` by typing, still stepped by one on the arrows, and
still drew twelve numbers on its minute face. All three now resolve the steps per interaction — a
windowed granularity depends on the hour the draft is on — and all three set the native `step` on
their segments, so the platform's own spinner offers what the field offers.
