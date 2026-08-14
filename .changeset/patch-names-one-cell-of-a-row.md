---
"@modyra/core": patch
---

`MdyFormPatch` lets a patch name one cell of one row

`patch()` merges what it carries into a keyed collection and leaves the cells it does not name
alone — that is what the record manager does and what the type's own description ("deep partial of
the schema value") says. The record branch of `MdyFormPatch<S>` nevertheless required the complete
row, so `form.patch({ rows: { a: { sku: "A" } } })` did not compile against a row that also declares
`qty`, and a consumer had to cast to write the documented call.

The branch is now a deep partial of the row. Positional collections are unchanged: a whole-array
write states which rows there are, so it still takes complete item values.

Found by typechecking a consumer installed from a packed tarball under `strict`.
