---
"@modyra/widgets": minor
"@modyra/lit": patch
---

The day a calendar is always asked about

`today` has been a declared state on the day cell for as long as the part has existed, and the cell
had no projection: three renderers wrote its semantics by hand and one of the three marked today. A
person hearing the grid got thirty-one numbers and no anchor.

`projectCalendarDayCellA11y` is the door — classes, role, `aria-selected`, `aria-disabled`, the
roving tabindex and `aria-current="date"` on today. The datepicker controller and lit's calendar bind
it; Angular already said it and now has a declaration to say it from.

`date` rather than `true`, and absent on every other day: the token names what kind of current this
is, and thirty cells saying "not today" is noise.
