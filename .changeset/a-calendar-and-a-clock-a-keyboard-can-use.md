---
"@modyra/plain": patch
"@modyra/lit": patch
---

A clock that commits and a range a keyboard can pick

`MDY_WIDGET_KEYBOARD` declares `Enter` on an open timepicker as `commit`, and neither renderer
answered it: the dialog could be filled from the keyboard and only confirmed with a pointer. Enter
now confirms from anywhere in the dialog except a focused button, which the platform already turns
into a click.

Plain's date range took focus into its grid when it opened and then answered no key at all — the
arrows moved a cursor the grid never painted and focus never followed. The grid now sends the
calendar's keys to the controller that owns the month, paints the cursor it answers with, and keeps
focus on it. Its day cells also carry the id the contract names for them, as the single-date
calendar's do.
