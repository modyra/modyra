---
"@modyra/lit": patch
"@modyra/angular": patch
---

Every clock enforces the range the contract states, not just Plain's.

Both renderers accepted a typed `25` or `61` through their own arithmetic and neither offered arrow
stepping, so an impossible time was corrected somewhere downstream with nothing on screen to say the
entry had been wrong.

Both now consume `acceptTimeField` / `stepTimeField` / `timeFieldBounds`: an out-of-range segment
carries `aria-invalid` and the range it expected, arrow keys wrap at both ends (12 → 1, 59 → 0), a
step rescues a segment that is already out of range, and each box advertises its own `min`/`max`.
Clearing a box is not an error — it is being cleared, not asserted.

The three renderers now answer this the same way, with the ranges stated once. Each adapter's tests
assert the *wiring* rather than the arithmetic, since a contract nothing consumes is the failure this
repo has recorded three times.
