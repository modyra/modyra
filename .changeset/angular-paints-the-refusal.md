---
"@modyra/angular": patch
---

A field the form refuses now looks refused, and a locked field looks locked.

Every renderer wrote `mdy-input-wrapper` by hand and bound only `--disabled` beside it, so the two
other states the contract lists for that part — `--error` and `--readonly` — reached the page in one
renderer of thirteen. A form rejecting what a person typed rendered the message and set
`aria-invalid`, and nothing on the field itself changed. The label had the same shape: its
`--has-error` class followed whether the message was drawn *inline*, so a field showing its errors in
a list below never marked its label at all.

The wrapper's classes are now composed from `MDY_FIELD_STATE_CLASSES` in one place, and the error
state follows the same answer `aria-invalid` takes, so what a theme paints and what a screen reader
is told cannot disagree.
