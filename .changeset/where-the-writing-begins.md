---
"@modyra/styles": patch
---

Where the writing begins

A field's inner inset was declared twice. The inliner carries it as an asymmetric logical pair, and
the control inside carries its own symmetric padding — so where the inliner is drawn both applied and
the writing began at their sum: 28px in the renderer that draws it against 16 in the two that do not,
from one document.

The inset is declared in one place now and applied once. Where the inliner is drawn it is the
declaration and the control carries no inline padding; where it is not, the control's padding is the
inset. The number is `1rem` either way, so the two spellings put the writing in the same place.

Every page screenshot moves, in every theme and every renderer, because the text moved in every
field. See ADR 0182.

Two things the rule had to be written around, both properties of the cascade rather than of this
change: a zeroing rule beside the inliner sits in `mdy.base` and loses to the control's component
rule whatever its specificity, and inside the winning layer a one-class selector loses to the
two-class one that states the control's padding. A rule that loses is correct, ineffective, and looks
applied.
