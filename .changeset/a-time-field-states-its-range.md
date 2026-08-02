---
"@modyra/widgets": minor
---

`timeFieldBounds`, `acceptTimeField` and `stepTimeField`: a time field's range becomes contract.

An hour runs 1–12 with a period beside it and 0–23 without; a minute is 0–59 on either clock. Those
ranges lived as literals inside the transitions, where the hour's two variants are easy to keep
straight and **the minute's 0–59 is easy to lose** — it reads like the hour's neighbour and is not.

The contract states two behaviours, deliberately different, because the user means different things
by them:

- **Stepping wraps.** An arrow key or a spinner is sequential: 12 + 1 is 1, 0 − 1 is 23, and a
  minute rolls 59 → 0. Someone holding the up arrow is scanning a range, not asserting a value, and
  stopping dead at the end answers the wrong question. A step also brings an already-invalid value
  back inside the range, because stepping is how a user *leaves* a bad value.
- **Typing is judged.** A typed `25` or `61` is a claim about a specific time. `acceptTimeField`
  returns a rejection carrying *why* — `out-of-range` or `not-a-number` — and the range it was judged
  against, so a renderer can mark the field invalid and say what it expected. Previously the answer
  was `null`, which a caller cannot tell from "nothing happened": an out-of-range entry was dropped
  in silence, leaving a field that looked accepted holding a value it never took.

Also stated rather than assumed: an empty box is not a request for midnight. `Number("")` is `0`,
which is a valid hour on a 24-hour clock, so the shape is checked before the value.

`timeClockTransition` now reads these bounds instead of carrying its own copies.
