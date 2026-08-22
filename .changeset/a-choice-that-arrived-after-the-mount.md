---
"@modyra/lit": patch
---

A choice that arrived after the mount, and a segment that says what it holds

**lit's select presented the first option as the current choice while the form held something else.**
It asked the adapter for the list it was built with, so a value arriving *after* the mount — a draft,
a server, a scripted write — was exactly the one no option carried, and the control looked like a
choice somebody had made. The list is asked of the value every time now: the widget does not erase a
value to make itself consistent, so it has to show it.

**And the timepicker's hour and minute boxes announced as edit boxes with nothing in them.** They take
the projection's part — `role="spinbutton"`, the bounds and the number held — which is where those
have always been. The bounds matter: an hour's range is the clock's, so a 24-hour face whose reader
is told the maximum is 12 states one of two ranges falsely, and a reader has no way to see which.
