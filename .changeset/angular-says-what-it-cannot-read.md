---
"@modyra/angular": patch
---

The calendars are named, and a date field says when it cannot read what it holds.

Three things a person is told by the other renderers and was not told here:

- **The day grid and the month and year views had no accessible name.** A `grid` is one of the roles
  ARIA requires to be named, and the name a calendar takes is the field's own label. The month and
  year views carried neither the name nor their id, so the header pointing at one by id pointed at no
  element at all.
- **Text a date field could not read was discarded.** The renderer parsed the entry itself and
  dropped what did not parse, so the widget's controller never learned there was an outstanding
  entry: the form was told the field was empty while the person was looking at their own text, the
  message explaining it never appeared, and leaving the field replaced what they typed with the value
  they had not chosen. Parsing is the controller's now, through `parseEntry`, and the entry is
  reported to the form so it is one of the field's errors like any other.
- **The timepicker erased an unreadable time on the way out**, for the same reason and with the same
  effect.
