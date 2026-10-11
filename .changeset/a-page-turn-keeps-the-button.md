---
"@modyra/plain": patch
"@modyra/vue": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

Turning a calendar's page leaves the keyboard on the button that turned it

Next and Previous now move the day that holds the grid's tab stop. A renderer that followed that day
by focusing its cell took the keyboard off the button, so a second press landed in the grid. The day
view's focus now follows the focused day only when no visible control of the calendar outside the
grid holds the keyboard. Returning to the days from the months or years lands where it did before.
No API changes and no migration is needed.
