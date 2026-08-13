---
"@modyra/core": major
---

A document may nest a collection, in every SDK

`MdyDynamicRecordNode.item` now accepts a record or an array, and `MdyDynamicArrayNode.item`
accepts a record: the document contract expresses what the runtime already runs. One rule is
enforced everywhere — a path crosses **one** positional level, so an array below another array is
refused where it is written, as `MDY_DYNAMIC_INVALID_ARRAY` or `MDY_DYNAMIC_INVALID_RECORD`
depending on which collection found it.

**Migration.** Both `item` types are unions with two more members, so an exhaustive `switch` over
`node.item.node` stops compiling until it answers for `"record"` and `"array"`. A reader that only
descends recursively needs no change. Documents already valid stay valid; nothing that parsed
before is refused now.

The JSON Schemas (`spec/dynamic-form-v2.schema.json`, `v3`), the Rust SDK (a `DynamicNode::Record`
variant) and the Java SDK (`"record"` among the schema node kinds, with its rows named by key in
the flat view) accept the same documents and refuse the same shape with the same codes.
