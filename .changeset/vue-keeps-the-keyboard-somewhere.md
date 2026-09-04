---
"@modyra/vue": patch
---

A `@modyra/vue` field taken out of play no longer leaves the keyboard nowhere.

Disabling a focused element blurs it — that is the platform, and every renderer here disables for
real: the property, the attribute and `aria-disabled`, none of them pretending. What follows is this
library's decision, and `keepKeyboardInPlay` already makes it: the keyboard walks forward to the next
thing that can hold it. Vue was the only adapter not asking, so a document rule that took a field out
of play mid-word left the person on `<body>` with their next Tab starting at the top of the page.

It could not be measured before: while these components never re-rendered, no node was ever replaced
and nobody's place was ever taken with it. Repairing the render is what made this reachable, which is
the ordinary shape of a structural fix rather than a regression.

Every kind asks, not just the one that was reported — and the asking is done through the runtime that
owns the handle rather than through a Vue watcher, because whether a field is in play is the handle's
signal. Written with a `watch`, it reintroduced in the file that repairs it exactly the defect these
components were just repaired of, and the bench caught it.
