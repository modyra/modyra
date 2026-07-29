---
"@modyra/styles": minor
---

Every control that reads as a field is the same height

The height was stated for a list of input types — text, number, date, email — so a password box, a
select's trigger and a picker's input each stood a dozen pixels shorter than the field beside them,
from the same `--mdy-input-height`. It is now stated for what a control *is*, and the audit fails a
height stated per input type: an enumeration is only ever as complete as the day it was written.

`box-sizing: border-box` goes with it. Without it the token meant two things — a text input laid out
as `content-box` added its padding on top — which is where most of the difference came from.

Two structural rules a theme had taken over came back to the foundation: a picker's own box is a row
(Material declared it a block, and a date range's two inputs and its toggle stacked three fields
tall), and the colour field no longer sets its own height. The audit now fails a theme that sets
`display` on a control's box.

Measured across all five themes: every field-like control is one height — 38px in Modern, 56px in
the others — where before a single theme ranged from 38 to 205.
