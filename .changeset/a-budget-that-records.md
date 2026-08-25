---
"@modyra/widgets": patch
---

The renderer budget records what moved instead of failing on it.

`overrun` was a ratchet — may shrink, may not grow — and the property was right in principle and wrong
in practice: **every legitimate edit moves the number**, so it fired on correct work and the only way
past it was to re-record. It fired twice in one afternoon over a single line and its removal.

That is the diagnosis `check-bundle.mjs` already wrote down about the bundle size, in this repository,
after reaching it the same way: *a threshold that is raised whenever it is crossed is a record of past
sizes rather than a limit.* This applies that reasoning where it was found a second time.

**What replaces the gate is a history.** Each re-record appends what moved, from what to what, at which
commit — so four lines and four hundred stop looking alike, which is what the ratchet was protecting
and the one thing it could not show:

```
multiselect/multiselect-renderer.component.ts: 113 → 116 (+3)
  moved 2 time(s) since 2026-08-25, 0 in total
```

Only movement is appended: a re-record that changes nothing writes nothing, or the series fills with
entries saying "still 113" and stops being readable. A dirty tree is recorded as such rather than
naming a commit whose content is not what was measured.
