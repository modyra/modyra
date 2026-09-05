---
"@modyra/styles": patch
---

At the narrowest width a chip loses its words, never its controls

At 320px a multiselect holding a dozen values grew a horizontal axis of five pixels — small, and the
cost is not the distance: sideways dragging there is added to a page that already scrolls vertically,
which WCAG 1.4.10 asks a layout not to do.

The row already capped a chip at its own width. What it did not do was let anything *inside* the chip
shrink: a flex item's floor is its content, so the label sat at its text's width and the chip
overflowed the cap it had been given. The label now truncates.

**And the controls are pinned, because the first attempt got this wrong.** Left free to shrink they
took the squeeze first — measured at 10px, then at 0 — and a control with no width is a control
nobody can press, which is the defect the row floor was written to prevent one level up. The button
that removes a value and the handle that moves it keep their size: the handle is the pointer path
WCAG 2.5.7 asks for independently of any keyboard path, so it is not something a narrow screen may
take away.

Measured at 320px and 280px, in two renderers: no horizontal axis, controls at full size. Below the
width the rule promises, the row overflows rather than dissolving what a person presses — which is
the trade stated rather than hidden.
