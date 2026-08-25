---
"@modyra/styles": patch
---

Pressing the mark that says "this opens" no longer empties the field.

Reported by a person, reproduced in all three renderers. Scanning what answers a press across the
caret, at its own height:

```
before   1144 clear-all   ← the caret starts here
         1160 clear-all   ← clear-all starts here
after    1144 trigger     ← the caret's press opens the list
         1160 clear-all
```

**A 44px target on a 28px control has sixteen pixels to put somewhere, and at a multiselect's trailing
edge both directions are taken**: outwards is whatever the form draws next — a press three pixels past
the border once activated the colour toggle, which is why it was grown inwards — and inwards is the
caret, which is exactly sixteen pixels wide. Grown inwards it covered the caret whole: the value went,
the list did not open, and nothing said why.

No choice of direction resolves that. What does is that the overlay is not needed: the floor is 24×24
(WCAG 2.5.8, the exception `DESIGN.md` already records for stacked steppers) and both controls are a
control step wide and the row's full height. **The box is already the target.** The overlay was left
from when it was not.

`a-target-too-small-to-hit` is green, so nothing fell under the floor with it.
