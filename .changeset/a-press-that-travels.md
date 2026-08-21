---
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A chip's own controls keep working once it can be dragged

Adding the drag took the tap path away, in all three renderers at once, and the cause is worth
stating because it is not obvious from either side of it.

`setPointerCapture` on the press does exactly what it is for — it follows the gesture anywhere — and
it **retargets every later pointer event to the capturing element**, including the one the browser
turns into a `click`. So the chip's own buttons stopped receiving their clicks: the control was drawn,
it was found, the press landed, and nothing happened.

The gesture is tracked on the document instead. It follows the pointer just as far and leaves the
buttons alone.

The first repair traded one door for the other: refusing to start a drag from the chip's own controls
made the tap work and the drag stop, because those controls **cover most of the chip** — a chip
draggable only by its bare edges is a chip nobody can drag. What separates a press from a drag is
travel, not where it landed, so a drag may begin anywhere on the chip and the click it would otherwise
produce is swallowed once, in the capture phase, when the gesture turned out to travel.

All three doors agree again: a keystroke, a tap on the move controls and a drag of the same chip land
on the same order in all three renderers.
