---
"@modyra/core": patch
---

A nested collection is read, written, renamed and restored with the row that owns it

The row readers still stopped at a collection, so the operations that read a
whole row and write it back could not see one: `rename` threw, and `setAll` and
`patch` would have dropped what they could not read.

They descend now, through the manager that owns the nested rows rather than
through the declaration, which names no keys:

- **rename** carries the whole subtree, and a child renamed inside one parent
  leaves the identically-named row under another parent alone;
- **setAll** replaces — a row it does not mention goes, subtree included;
- **patch** merges — a subtree it does not name stays where it was;
- a **restored draft** rebuilds both levels.

Recorded rather than fixed: undo does not cross a structural change. It does not
at one level either, so nesting neither introduced this nor worsened it, and the
test says so at both depths instead of leaving a skip that reads like a pass.
