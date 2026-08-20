---
"@modyra/angular": patch
---

The dial reports where the pointer is, and an arrow key stops fighting the binding

Two defects a person met and neither test suite could: conformance asks whether a part is there with
the right role, not whether clicking it does anything.

**The dial could only name twelve of twenty-four hours.** The clock handed the renderer a formatted
time, which it read back with `parseTime` — the *12-hour* parser, whatever the picker's format — so
every pointer landed on the outer ring by construction. It now reports the position it actually
knows: the angle and which ring, from `pointerAngle` and `timepickerDialRing`, dispatched as
`set-from-angle`. Dragging carries them too, so the hand follows a finger across both rings.

**The arrow keys were undone before the frame painted.** The segment's template binds
`[value]="value()"` and its arrow handler also assigned `input.value` and fired a synthetic `input`
event. One value with two owners: wherever the round trip did not return the stepped value, the
bound value was written back over it. The handler reports the value it asks for and the DOM follows
the model, the same way a typed character does.

The number fields and the period toggle also read their time with the picker's own format now, and
send the hour in it — `parseTime` could not read the `"15:30"` a 24-hour picker hands back.
