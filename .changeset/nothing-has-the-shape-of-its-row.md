---
"@modyra/core": minor
---

A row that sends nothing takes the shape of the row it stands for

A positional row that contributed no field is submitted at the place it occupies, and it was
submitted as `{}` whatever the row was. A collection of leaves — `array(field(""))`, a list of words
— then carried an object where a word goes, so a receiver validating a list of words rejected the
whole payload rather than the one position it could not read.

The placeholder is now the empty form of the row's own declaration, taken from the schema: `{}` for
a row of cells, a list of the same length for a row that is itself a list, and `undefined` for a row
that is a single value (`JSON.stringify` writes that as `null`, which is all an array can carry).
`undefined` rather than `null` so a withheld row is not mistaken for a field the person cleared.

`MdySubmittedValue` says this now: a positional row is `MdySubmittedItemValue<I> | undefined`, and a
row of cells is the partial of its own schema rather than the complete value. `MdySubmittedItemValue`
is newly exported. Code reading `submitValue()` on a form with a positional collection may need to
handle a missing row — which is the case that was silently misreported before. See ADR 0100.
