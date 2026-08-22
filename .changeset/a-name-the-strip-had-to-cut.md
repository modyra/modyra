---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
"@modyra/styles": patch
---

A name the strip had to cut can be read without a pointer

A chip whose label does not fit is cut off, and the only way to read it was the `title` attribute —
which never appears for a keyboard or a touch user, who are exactly the people who cannot widen the
chip. WCAG 1.4.13 asks that content revealed on hover be reachable on focus as well.

Focusing or hovering a chip now reveals its full name in a `role="tooltip"` element the chip is
described by. The new optional part is `chipTooltip`, and it belongs to the **control**, not to the
chip: a child of the chip is part of the chip's own text, and the name a chip composes from its
contents said the label twice. One element per control, moved to whichever chip is being named.

`chipTooltipOffset` is exported — where the tooltip sits in the control's coordinates, taken against
the strip the chip scrolls in, so a chip scrolled halfway out is named where it is drawn.
