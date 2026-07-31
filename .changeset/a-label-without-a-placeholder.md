---
"@modyra/styles": patch
---

A field with no placeholder stops floating its label

Material's floating label raised itself on `:has(input:not(:placeholder-shown))`. An input that
declares no `placeholder` attribute never matches `:placeholder-shown`, so the negation always
matched and the label sat permanently in its active position — shrunk to 0.75 and pinned 8px from
the top of a field that was empty, with the space its resting position should have occupied left
blank. Measured on the built demo, one field, empty and blurred, under `material.css`: with a
placeholder the label rests at `translateY(18px) scale(1)`; with the attribute removed it jumped to
`translateY(8px) scale(0.75)` and stayed there.

The selector is now scoped to `input[placeholder]`, so it can only speak about inputs that have a
placeholder to show. It is a fallback and nothing more: `.mdy-label--filled` is the renderer-owned
signal for value-present and it measured correct in every state, focused, filled and error alike.
What is left of the `:placeholder-shown` line catches a value the renderer never saw, a native
autofill being the case that matters.

No geometry moves for a field that does declare a placeholder — resting 18px, active 8px, before and
after.
