---
"@modyra/core": minor
---

A patch names cells in a positional collection too

`patch({ list: [row] })` replaced the row: every cell `row` did not name was rebuilt from the field
declaration's initial — not what the person typed, not what the row started as, but what a row
created from nothing gets. The keyed collection was already right on the same call, so a change set
fed back through `patch` restored a keyed row and overwrote a positional one.

A row a patch carries is now written over the row that is there, cell by cell, driven by the schema
so an object-valued leaf is still replaced whole. The list itself is unchanged in meaning: its length
states which rows there are. A row past the end is new and taken as it came. The same holds for a
collection reached through a patched keyed row.

A caller who used a partial row to mean "and clear the rest" must now name the cells to clear, which
is what the keyed collection has always required. `MdyNestedCollection` gains `patchFrom`. See ADR
0103.
