---
"@modyra/widgets": patch
"@modyra/styles": patch
"@modyra/angular": patch
---

The popup surface split reaches the themes, and the time popup stops being wrapped twice.

Splitting `.mdy-popup` into position and surface stopped at the foundation. **Modern painted
`.mdy-popup` itself, unlayered**, so the theme most people see still dressed the primitive and
outranked the surface it was supposed to move to. It paints `.mdy-popup--surface` now, and keeps the
typeface on the popup so a theme that declines the surface does not lose its face with it.

**The time popup carried a card inside a card.** The foundation already said its shell must be
transparent — "visual chrome lives entirely in `.mdy-timepicker-container`" — and Modern overrode it
on a reason that had expired: *"plain's time popup holds two number inputs and three buttons rather
than the themed dial"*. It renders the dial and its container now, so the surface arrived twice: a
bordered box around a bordered box. The timepicker's popup no longer carries the surface class at
all, because that kind declares a `container` and the container is the card.

**And the shell had a scrollbar it was told not to have.** `.mdy-popup { overflow: auto }` is declared
after `.mdy-timepicker__popup { overflow: visible }` at equal specificity, so the primitive won the
tie — putting a scroll context and its scrollbar around a dial that already has one, and clipping the
container's shadow. The exception now names both classes, so it holds wherever either rule moves.

Measured after: the shell paints nothing, sizes exactly to its container, and its scroll height equals
its height.
