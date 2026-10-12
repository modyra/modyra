---
"@modyra/plain": patch
"@modyra/vue": patch
"@modyra/angular": patch
---

The calendar title that brings the days back puts the keyboard on the day

In a calendar's month or year view, pressing the header title to return to the days left the keyboard
on the title in Vue, Angular and the Plain date-range field. It now lands on the day, like choosing a
month or pressing Escape, and like Lit and the Plain date field already did. Pressing the title from
the days to open the years still leaves the keyboard on the title. No API changes and no migration is
needed.
