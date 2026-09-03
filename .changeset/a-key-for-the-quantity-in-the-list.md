---
"@modyra/widgets": minor
---

Declare a key for the quantity on an option in an open multiselect

The stepper drawn inside each option while the panel is open is a `tabindex="-1"` pointer affordance,
and no key named it — so a quantity was adjustable with a pointer and with nothing else, for the same
reason and in the same words as the chip's quantity was before its own two keys existed.

`ArrowRight` and `ArrowLeft`, declared `when: "open"` and `on: "option"`. A key rather than a tab
stop, because this is one action **per row**: a stop that named the row would be one stop per row and
`Tab` would become a scroll. That is why this kind keeps the `Tab` that dismisses rather than joining
the family that holds it. ADR 0198.

The keys were measured against what the kind already declares while open — `Escape`, `Tab`, `Enter`,
`Space` on an option, `ArrowUp`/`ArrowDown`/`Home`/`End`, and any printable character for type-ahead.
The vertical axis walks the list, so the horizontal one is free. `+` and `−` were the alternative and
are not available: they are printable, and type-ahead would take them first.

This release declares the binding; the renderers honour it in the next one. Until then the stepper is
still pointer-only — stated here so the declaration is not mistaken for the repair.
