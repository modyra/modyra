---
"@modyra/vue": minor
---

`@modyra/vue`'s panels leave the field and are placed against the control that opens them.

Until now every panel here was a `hidden` div in the flow: anatomically conformant and behaviourally
inert. It drew the parts the contract names, and it appeared under the field rather than against it,
inherited the `overflow` and the stacking of every ancestor, and stayed where the document put it
while the page scrolled underneath. The jsdom sections could not see any of that — they inspect
structure with a panel open, not where the panel lands.

Nothing here decides where a panel goes. Which side it prefers, how much room it needs before it
flips, whether it matches the control's width, the gap, the class a placement wears — all of it is
the contract's, reached through `overlayAnchoringFor` and `anchorOverlay`, with the scroll and resize
loop the contract already owns. This package measures two rectangles and writes back what comes out,
which is the division the other renderers already make.

**Two things the move broke, and both were found by benches rather than by reading.** A teleported
panel bubbles its events through the document, not through the field it belongs to, so a key handler
sitting only on the field stopped hearing every key pressed inside the panel. And every lookup
scoped to the field's own element — the timepicker's tab ring, the colour swatches — found nothing
and read as "the control is not there".

The select and multiselect now take the held value from the controller's reconciled list rather than
the declared options: a value the options do not contain was showing as a placeholder, which is a
field holding something a person can neither see nor replace.
