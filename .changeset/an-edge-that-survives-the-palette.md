---
"@modyra/styles": patch
---

A field keeps its edge when the system supplies the palette

`.mdy-input-wrapper` draws its edge with an inset `box-shadow`, and a forced palette drops shadows
outright — along with the wrapper's background, which is repainted the surface colour. So the box a
person uses to see *where* the input is had no edge at all, in the one mode chosen by people who need
edges most.

What survives is a border, which is the answer the slider's track already needed one rule below. Only
on the block end, because that is the edge this shape has: a filled field is a surface with a line
under it, not a box. Focus and refusal keep their heavier weight.

**It was reported against the wrong part, and the reason is worth keeping.** The sweep named
`email.errors` — 5.6% of its pixels painted, then nothing. But the fields in that sweep are mounted
with no rules and never touched, so no kind has an error message at all: what it photographed was not
the error text. `.mdy-control__errors` is transparent and absolutely placed at the bottom of the
renderer, directly over the wrapper's underline, so the crop caught the edge *behind* it. And
`inputWrapper`'s own crop starts at its top and stops short of a 56px-tall field's bottom line, so the
only part that could see that edge was the one it does not belong to.

Not `email` either: it was the one kind whose error box happened to overlap an edge.
