---
"@modyra/core": patch
---

A change set no longer carries a cell the form disabled

`getChanges()` carries a positional collection whole, so that a server applying the patch by index
knows which row is which. It read those rows from `getValue()`, which holds every cell disabled or
not — so a value something had decided must not travel left through the change set while
`submitValue()` correctly withheld it. The flat and keyed halves were already right, which is what
kept this looking like a detail.

The carried rows now come from the form's submittable fields and go through the same
position-keeping walk a submit uses, so the two doors agree cell for cell. A change set may
therefore contain a partial row, or `{}` where every cell of a row is out of play — the shape a
submit already produced. See ADR 0102.
