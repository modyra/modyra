---
"@modyra/widgets": minor
"@modyra/lit": patch
"@modyra/angular": patch
---

A native radio carries its own state

Every renderer draws an option as a native `<input type="radio">` — a segmented button is one wearing
a styled label — and a native radio maps its own `checked` into the accessibility tree. `aria-checked`
beside it was a second source for one fact, applied by two renderers and dropped by the third, and
when two sources disagree the ARIA one wins and is the one that went stale.

The option projection says `null` for it; lit and Angular stop writing it. What is chosen is read
from the state, which is where the checks now read it too.

This is the same rule as `aria-checked` on a native checkbox, and the reason the two looked like
opposite cases was that nobody had checked which element a segmented button actually is.
