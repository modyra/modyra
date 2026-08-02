---
"@modyra/plain": patch
---

Opening a date range puts the keyboard in its calendar.

Its own datepicker sibling already did, and so did the other renderer's range picker — this one
opened a grid and left focus on the toggle behind it, so a keyboard user had a calendar on screen
and no way into it without tabbing. Focus now goes to the start endpoint when the range has one, and
to the first pickable day otherwise.

**Every renderer's divergence ledger is now empty**, across at rest, invalid, disabled and open, and
after the open-then-Escape sequence. This was the last recorded entry.
