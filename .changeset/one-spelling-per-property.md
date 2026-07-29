---
"@modyra/widgets": minor
---

One spelling for every custom property the renderers write

`--mdy-overlay-left` was a string literal in four packages at once — widgets, core, angular and lit.
A custom property that is misspelled fails silently in the worst way: the class is still there, the
rule still matches, and the popup simply appears at the top-left of the page because the number never
arrived.

`MDY_CSS_PROPERTIES` names each one once, grouped by what writes it — the eight `--mdy-overlay-*` the
placement policy emits, the layout column count, and the three per-control numbers a theme cannot work
out for itself. `anchorOverlay`, `layoutNodeAttributes` and the segmented control's projection now
write through the vocabulary instead of literals.

`--index`, which positions a number on the clock face, is named here as the one property still outside
the namespace: every theme reads it under that name today, and a test records the exception so it
stays a known one rather than becoming a precedent.

Two findings recorded while wiring this up, neither fixed here: `--mdy-overlay-surface-color` is read
by the foundation and given a value by no tier, and `--mdy-segments-count` is read only by the iOS
theme, which `modyra-base.css` documents deliberately.
