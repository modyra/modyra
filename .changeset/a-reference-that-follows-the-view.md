---
"@modyra/lit": patch
---

A date range's reference follows the grid on screen

A panel that changes what is under it changes what the opener is pointing at. This kind draws three
grids in turn — days, months, years — and `aria-controls` was pinned to the day grid, so choosing a
month left the reference naming an element that had gone with the view. The panel is still open, so
the mechanism that keeps the id alive while it is *shut* never applies: three states, and one of them
had nothing to point at.

The reference now names whichever grid is on screen. Both ids are derived rather than spelled — the
day grid's from the opener's own declaration, the other two from the projection that draws them.

This is the second short lifetime found under one change. Moving a reference onto a sub-region ties
it to that region's life, which can be shorter than the panel's in more than one way: once because
the panel closes, and again because the view beneath it changes.

The date picker answered the same question already, with the two view ids written out as literals.
Same answer; only one of the two derivations follows the projection if it moves.
