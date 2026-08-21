---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

Focus is placed when a chip is taken off, rather than left where it falls

Removing a chip left focus on the document in two renderers and on the next remove button in the
third — which looked deliberate until the *last* chip was removed, and then that one dropped it too.
That is the tell: focus was landing on whatever now occupied that position rather than being placed,
so it worked while a next chip existed and failed at the end of the strip. Somebody clearing a strip
from the right lost their place on the first press.

`chipFocusAfterRemoval` states the rule once: the next chip, or the previous one when the last was
removed, or the control itself when nothing is left. All three renderers ask it and answer the same.

Lit needed a second `updateComplete`. The first can settle for a render that was already scheduled
when the value changed, so the strip is still the old one and focus lands on whatever sat at that
index before — the chip after the one you removed rather than the one that took its place.
