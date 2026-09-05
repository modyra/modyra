---
"@modyra/vue": patch
---

A chip draws no handle for a move it cannot make, and says when a quantity is at its floor

The handles added with the chip's declared parts **could not act**, and that is measured rather than
suspected: pressing one, with the chip focused first, leaves the order exactly as it was. Two dead
buttons on every chip, which is the caret defect one layer in — a mark that says *this does
something* and does nothing.

Two reasons underneath, and both are worth stating. `chipMove` is gated on the field offering
`reorderable`, and this component takes no such prop, so it can never be told; and `move` is resolved
against the **active** chip, which only the keyboard's roving focus sets — `focus` as an intent
returns nothing — so a pointer has no path to reordering at all. The renderers that draw handles
drive them by dragging, which this one does not implement. Until it offers reordering it draws no
affordance for one.

**A quantity that reaches its floor says so.** That half of the sentence has its own words in the
message table and its own diagnostic in the register — *the quantity is at its floor and the control
says "" — nothing marks the boundary*. It is pinned against **both** states: a bench asserting only
the floor would pass a renderer that told a person at three they were at the limit.
