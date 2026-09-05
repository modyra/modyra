---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

The overflow mark counts the chip its own width covers

The mark at the end of a chip row is the only account a person has of the values they cannot see, and
it was short by one whenever the row was tight: the count is taken from the strip's box, the mark
shares that row, and drawing it narrows the strip — so the chip that width covered fell outside a box
that had already been measured. The row said "29 more" while thirty were cut.

The renderers knew the mark takes width from the strip: each compensates for it when returning a
focused chip to view. None compensated for it when counting.

`settleHiddenChipCount` measures, draws, and measures once more, applying the second count only when
it differs — two passes, never more, because the second measurement is the one taken with the mark on
the row. All three renderers that draw a chip strip now count through it.

It had been latent for as long as the mark existed and surfaced the moment a floor was put under the
opener beside it: the geometry moved, and the off-by-one moved into view with it.
