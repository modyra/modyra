---
"@modyra/studio-ui": minor
---

The size selector comes out of the floating toolbar

Choosing which screen size you are laying out for lived inside the dock — behind a FAB that is
collapsed by default and floats over the canvas. It is a constant action while arranging a form, and
the canvas underneath is already showing the answer, so it belongs where it can be seen.

There is now a permanent strip above the canvas holding **base / sm / md / lg**, the width that size
means, and a line saying what editing at that size does. The dock goes back to being what it was:
templates and project actions.

Same `data-breakpoint` attributes and `aria-pressed` state, so nothing addressing it had to change —
and several tests stop opening and closing the toolbar just to reach it.
