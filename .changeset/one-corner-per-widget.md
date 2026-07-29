---
"@modyra/widgets": minor
"@modyra/angular": patch
"@modyra/plain": patch
"@modyra/lit": patch
---

A popup opens from the end of its control where the trigger is

Which corner an overlay opened from used to depend on the pointer against the middle of the
*viewport*, so the same calendar opened from the left corner on a form in one column and the right
corner on another, and clicking a different part of the same field changed it again. Each widget now
declares the edge its popup hangs from in `capabilities.anchoring.alignment` — every trigger in the
catalog sits at the end of its control, so every popup opens from that end and stays there. Only a
content width that will not fit that side can overrule it. Where no widget declares an edge, the
pointer picks the half of *the control* it landed in, which is the comparison that was wrong before.

`overlayAnchoringFor(kind)` returns a widget's anchoring as `anchorOverlay` options. Angular, Lit and
the framework-free renderer all take their popup's room, width and edge from it, so a renderer no
longer holds numbers of its own — Angular's controls were flipping sides at 128px where the contract
says 180 for a list and 240 for a calendar.
