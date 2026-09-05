---
"@modyra/core": patch
"@modyra/widgets": patch
---

A colour is judged the same whichever door it came through, and a range door keeps its own name

**The verdict no longer depends on the path.** A colour field's own control refuses text it cannot
read — typing `banana` leaves the value as it was — while the same string arriving through
`patchValue` was taken whole: the model held `banana`, the swatch fell back to black, the field
called itself valid, and the form sent what the page never showed. The readability rule lived on the
typed path alone, and `{shape: "string"}` cannot object, because every string is a string.

`colors` now states its form where the other formatted kinds state theirs, beside the ISO date and
the `HH:mm` time. The control asks the engine through the door it already publishes rather than
keeping a second copy of the pattern: stated twice, the two drift the moment one learns a spelling
the other refuses — which is the defect, one level down.

**A range's opener stops being named by the field's caption.** Its projection pointed
`aria-labelledby` at the label, and that wins the name computation, so a renderer that gave the door
its action name had the caption announced over it: "T, button" — the label repeated, saying nothing
about what pressing it does. The two inputs beside it are what the caption names.
