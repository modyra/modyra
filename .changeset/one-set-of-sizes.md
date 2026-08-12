---
"@modyra/core": patch
"@modyra/widgets": patch
---

One set of layout sizes, not four spellings of it

`base | sm | md | lg` was written four times: once as the document's type, twice
as inline arrays validating that document, and once more as the keys of the
widget contract's breakpoint table — whose comment said it was mirroring the
other, by hand.

The set is declared once, in the layer both reach, and derived from there.
`MdyLayoutBreakpoint` and `MdyLayoutSlotPlacement` are now aliases of the
document's types rather than restatements of them; they resolve to exactly what
they resolved to before, so no consumer changes.

Adding a size is now a compile error until every table carries it, and removing
one is a compile error at the declaration. The constraint sits inside
`Object.freeze` rather than on the binding: a literal handed to a call is no
longer fresh, and an annotation there would accept a key the union had dropped —
which caught the addition and missed the removal.
