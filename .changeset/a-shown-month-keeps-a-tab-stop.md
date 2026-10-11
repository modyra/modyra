---
"@modyra/widgets": patch
---

A calendar's day grid keeps its tab stop whatever month it shows

The datepicker and daterange controllers changed the shown month when paging, choosing a month or
choosing a year, but left `focusedDate` behind. The tab stop is the cell holding `focusedDate`, so
the grid shown afterwards had no cell reachable by Tab. `focusedDate` now follows the shown month.
It lands on the selected day (the range's start, then its end) when that day is in the shown month.
Otherwise it keeps its day number, clamped to the month's length, so the 31st paged into February
becomes the 28th.

`contract:diff` classifies this as patch, because parts, relations and keys are unchanged. A host
that reads `state().focusedDate` sees it move on those three intents where it used to stay. No
value is committed and no migration is needed.
