---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/angular": patch
"@modyra/lit": patch
---

A calendar has three views, and the contract now says so

Two renderers had grown a month picker and a year picker; one had not, and nobody
had decided that. The seven class names they used were identical and in no
catalogue, so they agreed by copying rather than by contract, and neither picker
carried a role, an `aria-selected` or anything else a screen reader could read —
the day grid is a `grid` of `gridcell`s and the views that replace it were a run
of bare buttons.

`MdyCalendarViewMode` (`days | months | years`) joins the state of both calendar
controllers, with `set-view-mode`, `select-month` and `select-year`, and
`calendarViewAfterPick` states where choosing lands: a year narrows to its months
and a month to its days. Every opening starts on the days, which is what the
timepicker's own view mode already did.

Eight parts join the catalogue — `monthPicker`, `monthCell`, `yearPicker`,
`yearCell` for each kind — carrying the classes the renderers already used, and
`projectCalendarViewA11y` / `projectCalendarPeriodCellA11y` project them.

**The framework-free renderer gains the views.** Paging a month at a time put a
birth date thirty clicks away.

Two things the gates caught rather than review: a `grid` with no accessible name,
which the conformance kit rejected — the label is a default now rather than an
option a renderer can forget — and four state classes no theme paints, so a cell
declares only `selected` and a refused period carries the native `disabled`.
