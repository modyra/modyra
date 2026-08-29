---
"@modyra/widgets": minor
---

`aria-checked` is the switch's, not the box's

`role="switch"` has no host-language state to read, so the attribute is the only thing that says
whether it is on. A native `<input type="checkbox">` maps its own `checked` into the accessibility
tree, and writing `aria-checked` beside it is a second source for one fact — when the two disagree
the ARIA one wins and is the one that went stale.

The boolean projection emitted it for both, and the three renderers disagreed about applying it,
which is what a redundant attribute invites. It is emitted for the switch alone now; the box still
says it is ticked, in the way HTML says it.
