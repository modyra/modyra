---
"@modyra/vue": patch
---

`MdyDatepickerField` and `MdyDaterangeField` now draw the calendar's months and years views. Pressing the month heading used to change the view internally while the panel kept showing the days. It now goes out to the years, a year leads to that year's months, and a month leads to its days, as `calendarViewOnToggle` and `calendarViewAfterPick` describe. Both views are `role="grid"` elements named the way the contract names them. Cells say which period is chosen, and the months and years outside `minDate`/`maxDate` are disabled. The previous and next month arrows are hidden outside the days view, and the chosen year is scrolled into sight when the years open.

Migration: none. The new elements carry the catalogue's `monthPicker`/`yearPicker` and `monthCell`/`yearCell` classes, so a theme that already styles the other renderers' views styles these too.
