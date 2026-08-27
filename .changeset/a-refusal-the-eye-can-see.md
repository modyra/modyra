---
"@modyra/plain": patch
"@modyra/styles": patch
---

A refused field says so to the eye, not only to a reader

Every kind announced its refusal — `aria-invalid` was there throughout — and three drew nothing. A
checkbox, a switch and a range looked exactly as they had a moment before, so a person who could see
the control was told nothing while a person listening was told everything.

Three separate causes under one symptom:

- **the sheet painted the box and not the words.** The box treatment names `mdy-input-wrapper`, and a
  checkbox and a switch carry their own wrapper class, so the rule addressed a block they do not have.
  The refusal is now stated on the label, which is the one part every kind has;
- **a checkbox said it was wrong before anybody had been near it.** It asked *is this field invalid*
  where every other kind asks *is this refusal one to show yet* — two answers to one question, and the
  first is true from the moment a required box is drawn unchecked;
- **a range said it too, for a different reason.** Its empty value is an object, and the predicate was
  not told the kind, so a value that *is* this field's nothing read as one that arrived from a draft
  or a server — which is said at once rather than waiting for a turn. `file` had the same shape and is
  fixed with it.

The first two made refused and untouched look **identical**, which is why nothing caught them: the
state that mattered was the one that never changed.
