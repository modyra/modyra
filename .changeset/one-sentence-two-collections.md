---
"@modyra/core": patch
---

An empty array in a patch says so while it is still recoverable

`form.patch({ rows: {} })` changes nothing and `form.patch({ list: [] })` empties the list. Both are
their kind's reading — a keyed collection merges by key, so an empty object names none; a positional
one is carried whole, because an index *is* a row's identity and a partial list would be an ambiguous
PATCH rather than a partial one — and the difference is invisible until a consumer who learned the
first writes the second and loses their rows.

The behaviour is unchanged, deliberately: the array branch of `MdyFormPatch` is already declared
whole-list, and making `[]` a no-op would leave no spelling for "this list is now empty" in a patch.
What changes is that the destructive reading is no longer silent — in development, emptying a
non-empty positional collection through `patch` names the collection, the number of rows, and the
reason the two kinds differ. The guide's operation table and its collections section say the same.
