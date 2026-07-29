---
"@modyra/widgets": minor
"@modyra/plain": minor
---

The clock is the timepicker's picker, in every renderer

The dial was Angular's alone: the other renderers showed two number fields, and the framework-free
one had no container either, so its popup had no width of its own and stretched to fill the viewport.
The catalog now names the whole anatomy — `container`, `content`, `dialFace`, `dialHand`,
`dialNumber`, `modeToggle`, `action` — and the foundation places a number from the `--index` it
carries, so a renderer draws the clock rather than inventing one.

`MdyTimepickerFieldState.viewMode` is part of the state, with a `set-view-mode` intent: which face
the popup shows decides what it contains and how tall it is, so a renderer keeping it privately would
be deciding the widget's anatomy. Every opening starts on the clock, on the hours.
`timepickerDialNumbers` gives the numbers on the face — the hours, or the minutes in fives with 0 at
the top — and `timepickerSelectedDialValue` marks the nearest five, so a draft of 07 highlights 05
rather than nothing.

The framework-free renderer draws the clock and picks from it: it reports where the pointer is, and
the angle becomes a time through the contract's `set-from-angle`, the same snapping Angular's clock
uses. Picking an hour hands over to the minutes, so one gesture sets a whole time. The numbers are
labels, not controls — the foundation makes them `pointer-events: none`, and the face owns the
gesture.
