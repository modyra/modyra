---
"@modyra/styles": minor
---

Validation feedback no longer moves the form, and the selected segment shows its tick

Each renderer reserves one line for validation feedback and paints the error list into that band
instead of laying it out in flow: a message appearing on blur used to grow the field by ~24px and
push everything below it down, which moved the control the user was reaching for. Supporting text
stays in flow — it is present from the start, so it shifts nothing.

The segmented tick is keyed on the contract's selected class and its gutter is reserved on every
segment, so it appears and disappears without changing any segment's width. A renderer that ships
no icon set leaves the element empty and the theme draws the glyph.
