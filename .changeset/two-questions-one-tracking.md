---
"@modyra/widgets": major
"@modyra/angular": minor
"@modyra/lit": patch
---

Scrolling and resizing are not the same question

`trackAnchoredOverlay` took one callback and two renderers could not use it.
Both had drawn the distinction it was missing: a page that scrolls moves the
anchor, so the popup follows keeping the side and height it opened with —
re-deciding on every scroll frame is what makes a popup flip sides under the
pointer — while a viewport that changes size changes what fits, so there the
placement is decided again. A function written to end three copies was the one
thing none of the three could adopt.

It now takes `{ reposition, reflow?, isOpen, followsScroll? }`. `reflow` defaults
to `reposition`, which is what the framework-free renderer passes because it
re-decides on every reposition anyway. `followsScroll` exists because an overlay
covering the viewport hangs off no control, and binding a capture-phase scroll
listener for it is cost with no effect.

Migration: `trackAnchoredOverlay(reposition, isOpen)` becomes
`trackAnchoredOverlay({ reposition, isOpen })`.

The Lit select stops answering its own keyboard. Its local switch differed in
ways nobody chose: an arrow on a closed list moved an active option no one could
see instead of opening it, `Tab` left the list floating over a form the user had
already left, and a focused search field did not change what `Home` meant.

A multiselect whose field has never been set reads as empty rather than throwing.
A registry-backed control starts at null, and the controller assumed a list.
