---
"@modyra/widgets": minor
"@modyra/styles": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

Reordering has a pointer path that is not a drag

WCAG 2.5.7 asks for a single-pointer alternative to any dragging movement, **independently** of a
keyboard path — a keyboard alternative does not discharge it. Somebody using a pointer who cannot hold
and drag, because of a tremor or a head pointer or a switch, has no way to reorder otherwise.

A reorderable chip gains two move controls: one press, one place, no drag. They are the same
`move-selected` intent the keys use, so the two doors cannot come to disagree about what an order is,
and they announce the same sentence.

Not focusable, like every other control on a chip. ADR 0128 settled that a chip is one operable thing
and its controls are reached through it — adopting `role="grid"` would have put them back in the tab
order and then supplied `Enter`/`F2` as the way to reach them again, which is scaffolding for a problem
the roving index already removed.

Drawn only where the field asked to be reorderable, so a set of filters gains no furniture. Their
marks are drawn in CSS rather than written as text, for the reason the remove control's is: a
character in a button is picked up by an accessible name composed from contents.

Fixes a live-region defect found while measuring it: a render describing no change wrote `""` over the
sentence just spoken, taking it back before a reader could reach it. A second pass over the same state
is an ordinary thing for a renderer to do, so the region is now left alone when there is nothing new
to say.
