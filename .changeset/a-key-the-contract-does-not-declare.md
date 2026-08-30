---
"@modyra/angular": patch
---

A key the contract does not declare

The daterange's endpoint boxes opened the panel on ArrowDown. Nothing declares that: the keyboard
table gives this kind Enter and Space on its toggle and nothing at all on the endpoints while the
panel is shut, and no kind in the catalogue declares a closed-state arrow. So one renderer answered
a gesture the other two do not offer, and somebody who learned it there lost it by changing
renderer.

It also took a key away from the person using the control. An endpoint is a box a date is typed
into, and swallowing ArrowDown there sends the caret key to a panel instead of to the text.

The contract stays as short as the practice: the extra gesture goes rather than the other two
renderers gaining it. Same resolution as ADR 0112 took for Home and End on a radio group.
