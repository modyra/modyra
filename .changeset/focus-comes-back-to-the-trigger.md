---
"@modyra/angular": patch
---

Leaving an open multiselect with `Tab` no longer lands on the control being left.

Closing an overlay places focus back in the field, and the element it chose was the first interactive
one in the wrapper. In a multiselect that is a chip: the strip of chosen values sits ahead of the
trigger and every chip is tabbable. `Tab` therefore closed the list, put focus on a chip, and let the
browser carry on from there — onto the trigger, the very control the person was leaving.

The multiselect now names its trigger as where focus comes back to, so the browser's next step goes
past it. `Escape`, which asks for the same restore, is unaffected: it wanted the trigger all along.
Hosts can override the same hook wherever their trigger is not the first interactive element.
