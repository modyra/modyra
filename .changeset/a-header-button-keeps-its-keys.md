---
"@modyra/vue": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

Enter and Space on a calendar's Next and Previous turn the page

The calendar's key listener covered its header as well as its days, so Enter or Space on Next or
Previous was read as choosing the focused day. The page did not turn and the popup closed. The day
keys now apply only inside the day grid, and a header button's keys keep their native meaning.
Escape and Tab are unchanged. An arrow pressed on a header button no longer moves the focused day.
No API changes and no migration is needed.
