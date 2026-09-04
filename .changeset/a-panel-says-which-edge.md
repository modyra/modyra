---
"@modyra/plain": patch
"@modyra/widgets": minor
---

The reference renderer places its panels through the contract's own door, and a panel now says which
edge it hangs from.

`@modyra/plain` wrote the four placing writes itself and reflected only the vertical half: a popup
that flipped to hang off the other inline edge carried no class saying so, and closing took the
vertical class off while leaving the horizontal one on — so a popup that had once hung right kept
saying so while shut. Both halves are now `applyAnchoredOverlay` and `clearAnchoredOverlay`.

`@modyra/widgets` gains `clearAnchoredOverlay`: the half of the placing door a renderer needs on its
own when its panel stays in the document while shut. A renderer whose panel is removed or rebuilt on
each opening never needs it, which is why it took one that keeps a panel to notice that the clearing
written locally covered placement and forgot alignment.

Nothing in this repository paints the alignment class, by decision rather than by omission — see
DESIGN.md, "The anchoring state classes are hooks, and emitting one is not painting it". A class
earns a rule where the popup has an asymmetry to answer: the select and multiselect flip their filter
box when they open upward, a calendar has nothing to flip, and no kind yet looks different for
hanging off the other edge. Emitting is the contract's half and painting is the theme's, so a
renderer that omits a state class is wrong even where no stylesheet matches it — a theme outside this
repository may match it today.
