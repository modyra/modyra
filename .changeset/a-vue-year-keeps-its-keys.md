---
"@modyra/vue": patch
---

In `MdyDatepickerField` and `MdyDaterangeField`, Enter and Space on a month or a year now choose it. Before, the calendar took those keys as if they were meant for the hidden day under them, so the press did nothing visible. A key pressed on a month or year no longer reaches the day grid, Escape still closes the panel, and focus stays on the month or year button instead of moving to a hidden day.

Only the view on screen contains its month or year buttons. While the days are showing, the months and years views are present but empty, so a test or a script that looks for year buttons has to open the years view first.

Migration: none.
