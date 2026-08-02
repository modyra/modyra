---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

`anchorOverlay` takes the writing direction, so a popup hangs from an inline edge.

`overlayAnchoringFor(kind)` states which edge of the control a popup attaches to — the end where the
trigger sits, the arrow, the calendar button. That is an **inline** idea, and it was being applied
physically: in a right-to-left field every popup still hung from the right, which is the wrong end of
the control.

The declared alignment now mirrors under `direction: "rtl"`, and all three renderers pass the
direction they are actually laid out in, read from the element rather than assumed.

**Only the declared edge mirrors, deliberately.** How much room remains before the window's right
edge, and where the user's pointer landed, are facts about the screen; they do not flip, and a popup
that mirrored them would place itself off the side of the viewport. A test holds that line — a wide
popup on a control near the right edge stays on screen in either direction.

This is one change in the contract rather than three in the renderers, which is what the shared
anchoring is for.
