---
"@modyra/core": minor
---

`MdyDynamicCollection` now carries `item`, one row's shape flattened with names relative to the row,
and `buildFlatFormSchema` builds rows from it where the flat fields say nothing. A collection a
document declares with no rows contributed no fields, so a form rebuilt from the flat pair had no
template: it accepted `upsert` or `push` and held an empty object, reporting the row as present in
`keys()` and absent in `getValue()`. Pairs stored before this keep building — `item` is optional, and
a collection whose rows exist is still described by its rows. See ADR 0095.
