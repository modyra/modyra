---
"@modyra/studio-model": minor
"@modyra/studio-contract": minor
"@modyra/studio-codegen": minor
"@modyra/studio-ui": minor
---

Studio can author a keyed collection

`RecordNode` joins `ArrayNode` in the project model, and a collection's row may itself be a
collection. The compiler emits the contract's `record` node, codegen emits `record(...)` with the
rows the author declared as `initial`, the index walks a row template of either kind, and the
preview draws a keyed collection from the keys its handle reports rather than from a row count.

One rule holds across the pipeline: a path crosses **one** positional level. An array below another
array is refused at compile with `UNSUPPORTED_NESTING`, naming the node that declared it, and
nothing unaddressable is emitted.
