---
"@modyra/widgets": minor
---

The kind that had no controller, and what it cost

`daterange` was declared in the catalogue and served by nothing, so each renderer built its range
picker by copying its own datepicker. The intra-package check measured the result: **21 duplicated
bodies across three packages, 17 byte-identical** — month navigation, year and month drill-down,
disabled-month tests, and the three questions a range cell has to answer.

Those three are the point. *Is this cell the start, is it the end, is it between them* — answered
three times, and one renderer answered the last by comparing ISO strings where the others compared
dates. They are answered here once, against the range being **previewed** rather than the one
committed, because that is what a person looks at while picking.

`createDaterangeFieldController` owns what a range adds over a date:

- **a draft.** The first pick opens a range and commits nothing; the second closes it and commits.
  Closing on half a range keeps what the form had, which is why the draft is separate from the value.
- **a preview.** While the end is open, the cell under the pointer stands in for it — and the
  keyboard previews the same way, or someone navigating with arrows picks the second end having never
  seen the range they are making. A preview is not a decision and never reaches the form.
- **ordering.** Picking right to left is the same five days, not an empty range.

`projectDaterangeFieldA11y` gives each end its own accessible name: two boxes under one label are two
boxes a screen-reader user cannot tell apart, and the field's own label twice does not answer "which
end am I in". The opener carries the combobox semantics, not the inputs — one overlay serves both.

No renderer consumes it yet. Adopting it changes what a renderer draws, which belongs to the batch
that verifies a visual change; the adoption gate now lists all three as offered and not consumed.
