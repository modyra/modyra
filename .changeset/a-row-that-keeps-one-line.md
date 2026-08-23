---
"@modyra/styles": patch
---

A multiselect keeps one line, as its own decision record says it must.

With eight values the chips wrapped to a second line **outside the field's border**, painted over
whatever the form drew underneath, and pushed the count and the affordances below the box meant to
contain them. Three properties held at once: the row could wrap, the field could not grow, and nothing
clipped what did not fit. Any two of those are a design.

ADR 0127 already decided between them — *"the row keeps one line and scrolls horizontally… a wrapping
row grows with what is put in it, so wrapping and that rule cannot both hold"* — and `modyra-modern`
set `flex-wrap: wrap` twice anyway: on the chip strip, and on the widget's own box, where it let the
opener and the clear-all drop to a second line of their own.

Both removed. The foundation still wraps the strip below 320px and only there, where reflow is worth
more than equal heights, with the reasoning written beside the rule.

The two affordances at the end of the field take the row's height and carry their 44px pointer target
as an overlay, which is what every other trailing affordance already did.
