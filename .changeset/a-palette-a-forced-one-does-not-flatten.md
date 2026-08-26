---
"@modyra/styles": patch
---

A colour panel keeps its colours under an imposed palette

Where a person imposes their own colours, the system repaints backgrounds — and six swatches became
two. The question "which colour do you want" was asked over a row of near-identical squares, and every
contrast check passed the whole time, because each forced tint contrasts well with the surface and
nothing measures whether they differ from *each other*.

This is the one control in the library whose colour is its content rather than its decoration, so it
is the one place a forced palette is refused. Only the fill: the border, the selected ring and every
word in the panel obey the imposed palette as before, and the swatches carry a name, so they stay
distinguishable without their colour at all.
