---
"@modyra/styles": patch
"@modyra/angular": patch
---

A placeholder the theme can reach

Angular dimmed its native select with an inline `opacity: 0.6` while nothing was chosen. Two things
were wrong with it beyond the duplication: it dimmed the whole control, arrow included, where the
other shape dims only the placeholder's own text — and an inline style is the one thing a theme
cannot override, so a design system had no way to change it.

The foundation states it instead, and asks the element about its own state rather than requiring a
renderer to say: the entry for "nothing chosen" is the option standing in a native chooser, so the
control is showing a placeholder and takes the placeholder's colour. Both renderers of that shape get
it without either of them knowing.
