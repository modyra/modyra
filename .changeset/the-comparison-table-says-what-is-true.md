---
"@modyra/core": patch
---

The library comparison stops claiming a feature no competitor has.

`docs/guides/comparison-form-libraries.md` marked "keyed collections" ✗ for every other library,
Angular included. Angular has `FormRecord`: a collection with dynamic keys, added and removed at
runtime. The row now reads `~` for Angular and says what is actually different — `FormRecord` has no
way to rename a key while keeping the control's value and state — with the API cited.

A row was added for the property that matters in a long table and is easy to miss in a feature list:
who decides that a row exists. react-hook-form's own documentation says `useFieldArray` "relies on
inputs being mounted and unmounted to manage its internal state"; in Modyra a row exists because it
was declared, so a row scrolled off screen keeps its value and still counts against validity.

A comparison table is a claim about other people's work. This one was wrong in our favour, which is
the worse direction.
