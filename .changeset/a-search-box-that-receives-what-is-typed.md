---
"@modyra/lit": patch
---

A search box that receives what is typed, and a list that answers it

Three faults in one path, each hiding the next.

The box was drawn and never focused, so the keys fell through to the trigger, where the type-ahead
answered them: a value still came out, which is why this looked like it worked while the box stayed
empty. The list now takes the keyboard when it opens — through `focusWhenShown`, because the panel is
portalled and the frame it opens in may be the one before it is drawn.

With the characters arriving, the list did not narrow: the query lives in the adapter, which is not
one of this element's reactive properties, so only opening asked for a repaint. A filter nobody can
see is a filter nobody has.

And with the list narrowed, `Enter` chose nothing: the key handler is bound to the trigger, and focus
was in the search box, which is not inside it. The box answers the same keys now, so the option a
query narrowed to is the option `Enter` takes.
