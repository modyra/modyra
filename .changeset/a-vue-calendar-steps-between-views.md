---
"@modyra/vue": patch
---

In `MdyDatepickerField` and `MdyDaterangeField`, Ctrl+ArrowUp (Cmd+ArrowUp on Apple platforms) now steps out from the days to the months and then to the years, and Ctrl+ArrowDown (Cmd+ArrowDown) steps back in, as the other renderers already did. The step works from whichever view has the keyboard, stops at the years and at the days, and moves focus onto the chosen month or year of the view reached, or back to the day the calendar is on.

Migration: none.
