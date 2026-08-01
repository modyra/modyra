---
"@modyra/widgets": minor
---

The contract has one class vocabulary, not two

The catalogue declared a part's classes and the runtime a11y projections wrote their own literals for
the same elements — `mdy-select__listbox` where the catalogue said `mdy-select__list`,
`mdy-datepicker__trigger` where it said `mdy-datepicker__input`, plus a whole field- and control-state
vocabulary (`mdy-field--invalid`, `mdy-control--open`) the catalogue never mentioned. Anything built
from the catalogue therefore treated classes the contract itself produced as inventions.

The projections now read the catalogue instead of naming classes themselves, and the shared field and
control state classes are declared once in `MDY_FIELD_STATE_CLASSES`. Twenty-four class names that
belonged to no declared vocabulary now belong to exactly one.

A test fails if any projection names a class the catalogue cannot account for, so the two cannot
drift apart again.

`mdy-timepicker__dialog` is a declared part, and `select`'s trigger and listbox declare the states
their projections were already emitting modifiers for.
