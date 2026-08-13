---
"@modyra/lit": minor
---

The Lit date picker consumes its controller, and the two calendars share what they share

It kept the month on screen, the focused cell, the view and a vestigial draft in
five reactive properties, and decided each of them itself — while the range
picker beside it had already given all of that to the controller for its kind.
Two components in one package answering the same question two ways is the
divergence a shared contract exists to make impossible.

It repaints through `subscribeController`, and its keyboard is one intent rather
than three writes.

`calendarRows` and `calendarGridKey` join the shared calendar module. Chunking a
month into weeks of seven, and what `Escape` means in each of the three views,
were identical in both once they stopped keeping their own state.
