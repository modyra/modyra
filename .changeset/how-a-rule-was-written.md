---
"@modyra/zod": patch
---

How a rule was written does not decide where the field starts

A leaf's seed is the empty its own piece accepts, and the check for "accepts it" read only the
library's own length refusals. A `.refine()` — what an author reaches for whenever the rule is not
one of the built-ins: a consent to tick, a code with a checksum, a list that must contain a member —
answers `custom`, so `z.string().refine(…)` started at `null` where `z.string().min(2)` started at
`""`.

Two costs, and the second is the one a person meets: the seed moved with the *spelling* of the rule
rather than with what it says, and the author's own message never appeared, because a value of the
wrong type never reaches the predicate carrying it — `z.boolean().refine(v => v === true, "must
accept")` opened on *expected boolean, received null*.
