---
"@modyra/vue": patch
---

This renderer is measured against the canonical observation

It was the one adapter drawing widgets with no equivalence suite: the canonical tables in
`@modyra/widgets/testing` say what every renderer must produce in five states, and nothing asked this
one. Its defects were being found by hand, one at a time.

The suite mounts through a state fixture published in the shape the harness declares, so the same
actions mean the same actions. Its first run produced 46 divergences from 101 rows, and two causes
account for 34 of them: this renderer reflects `invalid` without `touched`, and disabling a field
moves focus onto the widget's own root. They are recorded, not repaired — the table asserts in both
directions, so a new divergence fails and so does an entry left behind after its fix.
