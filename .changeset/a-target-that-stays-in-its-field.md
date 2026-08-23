---
"@modyra/styles": patch
"@modyra/plain": patch
"@modyra/lit": patch
---

A tap target stays inside the field it acts on, and a chip's steppers draw their marks.

**The target.** The datepicker, timepicker and colours toggles carry a 44px hit area as an `::after`,
centred on a control that is smaller than it — so the target hung over both sides, and these controls
sit at the field's trailing edge. Half of it lay **outside the field**, in the space belonging to
whatever the form draws next: a press three pixels past the border opened the colour palette. Anchored
to the control's inner edge and grown inwards now, so the whole target is over the field it acts on.
The target keeps its size; only the direction it grows in changes.

**The marks.** A counter chip's two steppers were 32×24 of nothing in `@modyra/plain` and
`@modyra/lit` — they took their space, answered a press, and showed a person nothing, so the only way
to find one was to press the blank and watch the number change. Both renderers draw the minus and plus
from the icon set, which is what their own option chips already did and what `@modyra/angular` does.
