---
"@modyra/core": minor
---

History crosses structural changes.

`undo()` and `redo()` now act on the value as it is at the moment of the call:
a row declared, removed or renamed — at any depth, nested collections included —
is undoable immediately, not only after the reactivity's scheduler has run.
A removed subtree comes back whole; a rename is one step. The boundary is
unchanged: only the value is restored — touched, dirty and verdicts are not,
and a restored row revalidates as a fresh declaration (ADR 0041).
