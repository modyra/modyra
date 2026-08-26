---
"@modyra/styles": patch
---

A multiselect fits a 320px screen, as ADR 0137 decided it would

The record chose one line at comfortable widths and several below a breakpoint, on the ground that a
page which scrolls down must not also make a person drag sideways to read a value. The rule was
written, and it applied to the wrong element: `flex-wrap` sat on the strip while the chips are held by
the row inside it, and a flex container with one child wraps nothing however it is told to.

The row was inserted between the two by a later decision, which left the rule addressing a tree that
no longer existed — visible in the sheet, satisfied by nobody. Wrapping is now stated on the element
that holds the chips, and the chips are allowed to give way so one long label cannot make the row wide
on its own.
