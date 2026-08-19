---
"@modyra/core": minor
---

A masked row in `mdyFormSnapshot` says why it is masked: `"declared"` when the schema calls the
field sensitive, `"guessed"` when only its name looks like a secret, `"caller"` when the panel's own
predicate decided. The panel printed the same bullets for both, and they mean different things — a
declared secret is kept out of drafts and copies, a guessed one is protected in the panel and nowhere
else, so a draft writes it to storage in clear. The devtools panel carries the reason as the title on
the value cell. Nothing about what is masked changed, and the draft still withholds only what was
declared: guessing what to keep out of storage is the defect from the other direction.
