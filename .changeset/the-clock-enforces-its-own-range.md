---
"@modyra/plain": patch
---

The clock's hour and minute boxes enforce the range the contract states for them.

Typed entry went through `Number.isFinite`, which accepts `25` and `61` happily. The impossible time
was dropped somewhere downstream with nothing on screen to say the entry was wrong, so the box sat
there looking accepted.

Now both segments consume `acceptTimeField` / `stepTimeField` / `timeFieldBounds`:

- An hour over 12 (or over 23 on a 24-hour clock) and a minute over 59 mark the box `aria-invalid`
  and show the range they expected. Clearing a box is not an error — it is being cleared, not
  asserted.
- **Arrow keys wrap**: 12 → 1, 1 → 12, 59 → 0. And a step on an already-invalid segment brings it
  back inside the range, because stepping is how a user leaves a bad value rather than the one
  operation that refuses to move while the field is wrong.
- Each segment advertises its own `min`/`max`.

A declared contract nothing consumes is the failure this repo has recorded three times, so the tests
assert the wiring rather than the arithmetic: removing the invalid marking fails four of them, and
clamping instead of wrapping fails another.
