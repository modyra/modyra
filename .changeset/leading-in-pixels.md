---
"@modyra/styles": patch
---

The field label has its own leading, so a form sits on the pixel grid.

`.mdy-label` carried a size token and a weight token and no line-height, so its height was whatever
the host page's `line-height` produced against the theme's font size. At a common `1.5` against a
13px label that is 19.5px — which made **every control in the column a half-pixel tall, in every
theme**. Measured across the catalogue: 81.5, 133.5, 105.5, 39.5, 113.5, 180.5. Nothing sat on the
grid, so every edge below a label rendered soft.

The label now takes its leading from the typescale in px, as the input, helper and error already did.
The same controls measure 82, 134, 106, 40, 114, 181.

A ratio cannot be relied on here: it multiplies a size the theme chose by a number the host chose, and
only some of those products are whole. A text role with a size token and no leading token is a gap the
host fills silently.

Baselines re-recorded: every widget moves by half a pixel.
