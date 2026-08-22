---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
---

A reference worth following

A bare field with nothing to say still pointed `aria-describedby` at its supporting-text element — an
empty one. A reader is told there is more to hear, goes, and hears silence, which costs them the move
and teaches them not to follow the next reference.

The reference is made only where there is something at the other end. The renderer is the one who
knows — the text may be a host's supporting line, a slot, or a sentence the kind adds for itself — so
the text controller takes `describes`, and lit's elements answer it with `hasDescription()`. Angular
already asked the question this way.

**And the DOM checker was demanding the opposite.** It required the relation whenever the target part
was rendered, and a supporting-text element stays in the document while empty so its id keeps its
place. It now asks whether the target is *on screen* — `hidden` and `aria-hidden="true"` are how a
renderer says it is not — which is the criterion the check states in its own comment: a relation is
required exactly when both ends are on screen.
