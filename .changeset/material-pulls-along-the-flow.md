---
"@modyra/styles": patch
---

Material's colour toggle pulls along the flow, not to the right.

`margin-right: -0.75rem` pulls the toggle back over the field's inline-end padding so it sits flush
with the edge. Written physically it kept pulling leftwards under `dir="rtl"`, where that toggle is
on the left — opening a gap at one end and overhanging the other.

Found by measuring, not by reading: the RTL fixture now runs every family against **all four
packaged themes**, and this was the one case where the default theme mirrored and a theme did not.
"Geometry is theme-independent" was an assumption, and it was wrong exactly once.
