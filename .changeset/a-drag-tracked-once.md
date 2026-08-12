---
"@modyra/widgets": minor
---

A drag, tracked once

The dial of a clock is turned by dragging, and that gesture cannot be tracked on the element it
started on: the pointer leaves it immediately and the rest of the drag happens somewhere else. Every
renderer solved that itself, and two of them solved it identically — `setupDragListeners` and
`teardownDragListeners`, byte for byte.

`createPointerDrag({ onMove, onEnd })` is the sibling `createLightDismiss` and `createFocusCustodian`
already had: the plumbing of a gesture, not what the gesture means. What an angle becomes is still
the widget's business.

Two details in it are not cosmetic. `touchmove` is bound non-passive, because a dial that cannot call
`preventDefault` scrolls the page under the finger instead of turning. And `dragPointOf` returns
`null` for a touch event with no touches left — read as a point, the final `touchend` is the
top-left corner, and a dial would jump there on release.

Not yet adopted, and the reason is a finding rather than an omission: the third renderer listens on
the dial face rather than on the document, so a pointer that leaves the dial stops turning it there
and keeps turning it in the other two. That is a behaviour change, and it belongs to the batch that
verifies one.
