---
"@modyra/vue": patch
---

The calendar panel says what it is

A `dialog` is one of the three roles the contract says must be named, and this renderer's calendar
carried no name: it opened and announced "dialog", which is the first thing somebody using a screen
reader meets. The other three name it after the field it belongs to, through `fieldAccessibleName`;
this one now asks the same door.

Found by a reader that computes the name the way a platform does rather than reconstructing it from
attributes. The older check could be wrong in both directions at once — it missed a name that comes
from an element's own text or a wrapping caption, and counted an `aria-label` written on a role that
forbids naming, which the platform discards — so a renderer could be red while correct and green
while silent.
