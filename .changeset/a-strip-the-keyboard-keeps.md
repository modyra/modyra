---
"@modyra/plain": patch
"@modyra/lit": patch
---

A multiselect the keyboard does not lose

Plain re-appended every option to the popup grid on each pass to keep the order the controller's.
Moving a node takes focus off it, so choosing an option with the pointer sent the keyboard to the
document: the popup stayed open with nothing focused inside it, and `Escape` reached no listener.
Options are now moved only when they are not already where they belong.

Lit kept its own list of the keys that open a multiselect and answered three of the four the
catalogue declares — `ArrowUp` on a closed control did nothing. The keys come from
`MDY_WIDGET_KEYBOARD` now.

Lit also placed focus on the remove button inside the next chip after a removal, while the strip's
tab stop is the chip itself. Focus lands on the chip, as it does in plain.
