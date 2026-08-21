---
"@modyra/widgets": minor
"@modyra/plain": patch
---

What a box holds while you are typing, and which view opens

**A half-typed number is a state every time field has, and the contract had never named it.** So each
renderer answered on its own and all three were wrong in different directions: one padded to two
digits after every keystroke — clearing `00` and typing `0` then `1` gave `001` in a two-digit field,
and `01` was unreachable by the route a person takes — and the other two reformatted the character
away, so no partial existed and the box could not be cleared at all.

`timepickerEntry` states the rule, and it is a hybrid rather than "the text is free until blur":

- a focused segment **may hold a partial** — empty, or fewer digits than the canonical width;
- on every keystroke, **if the text names a value the field accepts, the draft takes it and the hand
  moves there**;
- if it does not — empty, out of range, off the granularity's step — the draft keeps its last
  accepted value and the hand stays;
- on blur or commit the text normalises, which `timepickerEntryText` answers.

So typing `2` in an hour box on a 24-hour face moves the hand to 2, and typing `9` after it leaves the
hand where it was: `29` is not an hour, and the box keeps showing it while the draft does not take it.

The text and the hand are two views of one draft — the same principle the focus contract rests on.

**`MDY_TIMEPICKER_INITIAL_VIEW` is the face.** It was two answers across three renderers, so a person
met a different control depending on which adapter their team had chosen. The face is the faster route
to an approximate time and the only gesture where there is no keyboard; the boxes are one press away
and stay typeable while it is showing.

Also: plain drew its dimmed-stretch layer whether or not there was anything in it — a part of the
anatomy present without being anything, which a conformance reading correctly called an extra part.
