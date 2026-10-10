---
"@modyra/vue": patch
---

The colours field's opener says what it opens

`MdyColorsField` wrote `aria-expanded` and `aria-controls` on the swatch button by hand and left out
`aria-haspopup`, so a screen reader announced a plain button where every other renderer announces
"has popup listbox". The opener now takes all three from `projectOverlayOpenerA11y("colors", …)`,
the same projection the other renderers bind. No migration.
