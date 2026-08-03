---
"@modyra/styles": patch
---

An icon has a size wherever it is drawn.

Two rules were scoped to `.mdy-renderer`, and a portalled popup is not a descendant of one — it
renders at the document root. So nothing sized what was inside a popup, and an `<svg>` carrying only
a `viewBox` has no intrinsic size: the size a replaced element takes without one is not specified.
`.mdy-popup` and `.mdy-overlay-panel` are now named beside `.mdy-renderer`.

The second half is the same shape one level down. A button inherits neither its font family nor its
font size, and a user-agent default is not part of any specification — so every control that sizes
something from its own font was unspecified until the size was stated. Eight of the nine controls in
this sheet that reset the family already reset the size; the reset is now stated once for all of
them, at zero specificity so it loses to any button that names a size deliberately.

Measured across the demo, every icon on the page: sizes were unequal between rendering engines
before, and identical after.
