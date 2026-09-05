---
"@modyra/core": patch
"@modyra/widgets": patch
"@modyra/angular": patch
---

A value of the wrong shape leaves the control on the page

The engine holds what a document puts in the model and reports the field invalid rather than refusing
the write, and the control is what shows that verdict. Four published readers assumed the kind's
declared shape instead and threw while the widget was being drawn, so the field a person needed to
read the problem from was the one thing missing from the page — in every renderer at once.

A file field's prompt read the value as a list of files, `parse24Time` trimmed it, the timepicker
handed it on as its display text unconverted, and `colorValueEquals` lower-cased it. Each now answers
a shape it did not expect: `null`, an empty list, the value as text, a comparison as the values stand.
`parse24Time` answers a non-string with `null`, as its sibling `parseTime` always has; neither
function narrows what it accepted before.

The file field's state now answers a list *of files* rather than the value as it stands, so a renderer
walking it can read a name off every entry. Angular read the model a second time in four places — the
date text, the datepicker's display, the multiselect chip strip and the file strip — and each of those
now reads what the contract answers, or holds the value to the shape it needs.

The decision and its cost are ADR 0208.
