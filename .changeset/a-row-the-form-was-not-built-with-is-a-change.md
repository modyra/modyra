---
"@modyra/core": minor
---

`getChanges()` now reports a field the form's baseline never had, so a row a user added is in the
patch even when no cell of it was edited. A row's cells take the value the row arrived with as their
initial, so nothing about a new row differed from its own baseline: `reset()` threw the row away
while `getChanges()` said there was no change, and a `PATCH` built the documented way never carried
the rows a user made. A rename carries baseline membership with the row, and
`rebaselineToCurrentValue()` — or `setInitialValue` on the collection — makes rows already there the
form's own starting point. See ADR 0096.
