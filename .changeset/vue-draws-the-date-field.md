---
"@modyra/vue": minor
---

`@modyra/vue` draws the date field: a control you can type into, a button that opens a calendar, and
the calendar.

The keyboard is not interpreted in the component. The controller takes a `keydown` intent carrying
the key and whether the platform's accelerator was held, and answers it — so a press means the same
thing in every adapter, and the accelerator is forwarded rather than dropped, because a calendar
that reads `Cmd`+ArrowDown as a bare arrow moves a date under a hand that was aiming at the end of
the document. Typed text is handed over unparsed for the same reason: a renderer that parses a date
is a second answer to a question the contract already answers.

Focus follows the reading position, not only the opening. Answering an arrow moves which cell is the
tab stop, and that is all a contract can do — moving the focus is the renderer's half of the same
act. Without it the `tabindex` walks and the focus does not: the markup reads correctly and a person
using a screen reader is told nothing, because focus never left the day they started on.

The calendar's first column is the day the locale's week starts on, and the weekday labels are
turned to match. `firstDayOfWeek` is one value with two readers — the grid the controller lays out
and the headers drawn over it — because the labels Intl returns are Sunday-first whatever the
locale, so reading them straight through is right in English and a day out almost everywhere else.
