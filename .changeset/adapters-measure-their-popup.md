---
"@modyra/angular": patch
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/core": minor
---

Every renderer measures its popup before placing it

Angular, Lit and the framework-free renderer now hand `anchorOverlay` the popup's own size, so the
contract can put it where the content shows whole instead of falling back to the minimum-space rule.
Each measures once — when the popup opens, with `scrollHeight`/`scrollWidth`, which report what the
content wants whatever the box is currently clamped to — and holds that size while it stays open:
re-measuring during scroll would feed the clamped box back into the decision that clamped it. The
panel is not in the DOM on the frame the popup opens, so each renderer takes the measurement as soon
as it is and places it again, still within the opening.

`ComputedPosition["coords"]` carries `maxWidth`, and `getOverlayStyles` emits
`--mdy-overlay-max-width`, so Angular's panel applies the same width ceiling the other two get from
the foundation.

`computeOverlayPosition` and `computeCoordsForAnchor` are deprecated. They are a second placement
policy that no renderer calls: they know nothing of the popup's size, so they pick a side with
enough room rather than the side where the content fits.
