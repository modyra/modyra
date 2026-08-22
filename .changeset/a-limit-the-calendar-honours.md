---
"@modyra/lit": minor
---

The calendars read the bounds the contract names

A document declares `minDate` and `maxDate` (`MdyDynamicCalendarOptions`), and plain and Angular read
them under those names. Lit's two calendars declared `min` and `max` only, so a host forwarding what
the document said set properties the elements do not have: the limit was declared, kept by the parser,
handed to the component — and the calendar offered every day as an ordinary choice, took one before
its minimum, and held it.

Both elements now take `minDate`/`maxDate` (attributes `min-date`/`max-date`), and every reader inside
them goes through one accessor rather than four reads of a name something else was set under. `min`
and `max` still work: a consumer writing Lit by hand has been using them.
