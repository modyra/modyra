---
"@modyra/styles": patch
---

A checkbox's label is sized to its words again

The shell's label rule, `.mdy-renderer .mdy-label`, sets `display: block`, and a checkbox's label
carries that class. It outranked the checkbox's own `display: inline-flex` rule, so the label filled
the full width of the row. Because a native label forwards a press from anywhere inside it, the empty
part of the row was clickable as if it were the box and its text.

The checkbox rule now names the class as well, so the label stays inline-flex and sized to the box and
the text. Other labels are unchanged, and toggles are unaffected because their label does not carry
the shell's class.
