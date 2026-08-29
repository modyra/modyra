---
"@modyra/styles": minor
"@modyra/angular": patch
---

The field's height joins the control scale, and one document is one date

`--mdy-control-4: max(3.5rem, 56px)` is the height a single-row field takes. It was the literal
`3.5rem` inside two `calc`s whose other term was a token, so a theme moving the scale moved everything
around a fixed 56 — part system and part number. `DESIGN.md` recorded that as the open question about
what the row system is: a kind is in it when its height comes from the control scale, and no kind's
did, because the height they all share was not on it. It is now, and the record says so.

Separately: Angular read a typed date only in the canonical spelling when the field displayed dates
that way, so `01/02/2026` was refused where the other two renderers read it. How a control *writes* a
date is its own choice; what a person may *type* is not one — they are looking at one document. All
three now take the canonical form first and the locale's order after it.
