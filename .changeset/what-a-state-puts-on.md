---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
---

`shellStateClasses` answers which shell classes a field's state puts on — and takes off

`MDY_FIELD_STATE_CLASSES` has always declared which base each shell part carries and which states it
admits. It never said the answer: *given these flags, which classes are on*. So every renderer wrote
that out, with the class names as string literals beside lines that read the vocabulary properly.

Two things a renderer had to get right unaided, and both now come from one place:

- **one state, two spellings.** A failing field takes `--error` on its wrapper and `--has-error` on
  its label. Both were declared; nothing composed them, so each renderer paired them by hand.
- **off is an answer.** Every class is named with its on-or-off, not just the ones that are on. A
  list of what to add says nothing about what to remove, and a field that stops failing keeps the
  class that says it is — a control left looking wrong after it was corrected.

The states it answers for are derived from the vocabulary rather than listed, so a state added there
and not here fails the check rather than going quietly missing from every renderer at once.

Angular is unchanged: its sixteen host blocks bind the same state declaratively and read the same
signal, which is repetition without a divergence to close. Doing it there needs the host binding to
move to the shared base, and that is a change to how every renderer declares its classes rather than
to what they mean.
