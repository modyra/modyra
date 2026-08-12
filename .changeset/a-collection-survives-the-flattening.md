---
"@modyra/core": minor
"@modyra/plain": minor
---

A document's collections survive the flattening: an array reads back as a list.

The dynamic contract carries a nested form as fields named by path, and ADR 0031 left one limit open
in writing: a path cannot say whether `lines.0` was an array row or the record key `"0"`, so only
groups were reconstructed and a document's array came back as an object keyed `"0"`, `"1"`.

It is not recoverable from a path, and it never needed to be — the document knows.
`parseDynamicForm` now reports the collections it walked, `{ path, kind }` per array and record,
beside the fields it flattened. `@modyra/plain`'s `buildFormSchema` and `mountMdyForm` accept them and
build real `array()` / `record()` nodes: a document's array reads back as a list, a record keyed
`"0"` stays a record, and each row keeps its own values.

`flattenDynamicForm(schema)` is the walk that reports both; `flattenDynamicSchema` keeps its
signature and returns the fields alone. `collections` is optional on `MdyDynamicFormParseResult` and
always present at runtime, so a consumer's stand-in keeps compiling and a caller that ignores it gets
exactly the previous behaviour.

`@modyra/react`'s dynamic form still reconstructs groups from the field list alone — the same change
against a different builder, left for a batch of its own.

See ADR 0031, amendment "a collection survives the flattening".
