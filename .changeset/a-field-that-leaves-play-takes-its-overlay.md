---
"@modyra/widgets": patch
---

A field that leaves play takes its overlay with it

A field can leave play while its popup is open without anybody clicking anything — a document's rule
takes it out when another field changes — and nothing happened: the calendar stayed on screen, the
opener kept reporting `aria-expanded="true"`, and every cell in it still looked like a date somebody
could pick. Clicking one correctly did nothing, which is what made it a control that looks live and
answers nothing.

The overlay-bearing controllers now watch their own handle and close when the field is disabled.
Read-only is untouched: a value you may read is one whose popup may stay open. ADR 0093.
