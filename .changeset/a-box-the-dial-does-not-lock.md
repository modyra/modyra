---
"@modyra/lit": patch
"@modyra/angular": patch
---

The number boxes stay typeable while the dial is showing

Both renderers marked the hour and minute boxes `readonly` whenever the clock face was the view — so
the picker opened on the face, and the two controls a keyboard can use were locked in the state it
opened in.

The rule the user gave for the hand settles it: a hand that follows a half-typed number needs the box
and the hand usable at the same time. Locking the box while the hand is visible makes that rule
unstatable, and it removes the keyboard from the affordance that most needs one — a dial is the one
gesture a keyboard cannot make.

Typing is unchanged in both: neither had a defect there, and the reported case works in both as it
always did.
