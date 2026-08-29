---
"@modyra/plain": patch
---

A panel measured before it exists

The calendar was positioned in the same pass that filled it, and before it: measured with no cells
in it, the panel is 54px against a content height of 276, so the placement policy was asked whether
a box a fifth of the real size fits under the field. It does — and the panel was then drawn at full
height, clipped, in a window where the policy answers "above" on the same rect.

The wrong number did not correct itself either. The measurement is held for the whole opening, so
nothing later in the panel's life re-asked, and the panel a person saw was placed against a panel
that never existed. The positioning now happens after the month is in, in both the date picker and
the range picker.

The policy was right throughout, which is why this is a browser check rather than a unit one:
reading the policy would have agreed with itself.
