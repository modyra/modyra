---
"@modyra/lit": patch
---

Three states lit had nothing reading

- **A read-only field looked exactly like an editable one.** `MDY_FIELD_STATE_CLASSES` declares
  `readonly` beside `disabled` and `error`, and lit's wrapper read the other two: a form locked for
  review looked like one waiting to be filled in, and the only way to find out was to try.
- **A value chip carried the option chip's classes.** `mdy-chip--centered` where the contract says
  `mdy-chip--value`, so a theme keying on the value chip styled the renderers that emit it and
  silently skipped this one.
- **The filter box was named only by its placeholder**, which stops naming it the moment somebody
  types, and pointed at nothing. It takes the name and the `aria-controls` the projection has always
  given it.
