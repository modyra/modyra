---
"@modyra/core": minor
---

A draft is a convenience: it can fail, expire and be discarded without taking the form with it

Four defects on one path, found together and repaired together.

**A storage that refuses to be read took `createForm` with it.** Safari in private browsing throws on
access, an enterprise policy throws, a blocked third-party context throws — and a draft is optional, so
failing to read one now means there is no draft, never that there is no form. The write side was
already swallowed for this reason; `clearDraft()` follows the same rule, and what it promises about
the *form* holds whether or not the entry could be deleted.

**`ttlMs` believed whatever `savedAt` said.** A stamp that is missing, is not a number, or sits further
ahead than a clock can explain is not an age — and an expiry a draft can opt out of by lying is not an
expiry. A stamp within five minutes of the future is a clock; beyond that it is a claim, and it is no
longer carried forward on later writes either, which is what made an impossible age permanent.

**`clearDraft()` did half of what it documents.** It removed the entry and left `getChanges()`
reporting every edited field, so a `PATCH` built from it sent exactly what the caller had decided to
discard. It re-baselines now, through `rebaselineToCurrentValue()` — published, because a consumer who
saves by another route wants the same thing.

**A restored draft was an undoable step.** A form opened on a draft offered, as the first thing to
undo, something the user had not done — and taking the offer wrote the empty form back over the draft,
because the draft follows the model. History now starts from the restored state. The restored edits
are still changes against the values the form was built with, so `getChanges()` is unaffected.
