---
"@modyra/core": major
---

A collection nests without a limit

An array may now hold another array, and a form may nest as deep as it needs — in a typed schema and
in a parsed document alike. The one-positional-level rule and the eight-level cap are gone, together
with the node-count cap on documents; the document validator's schema walk is an explicit stack, so a
deep document is answered on its own merits rather than overflowing while being read. See ADR 0043.

**Breaking, for consumers that read a descriptor's `item`.** These properties widen:

| Type | `item` was | `item` is |
| --- | --- | --- |
| `MdyAnyArrayDescriptor` | field or group | `MdyAnyRowDescriptor` |
| `MdyAnyRecordDescriptor` | field or group | `MdyAnyRowDescriptor` |
| `MdyDynamicArrayNode` | field, group or record | `MdyDynamicNode` |
| `MdyDynamicRecordNode` | field, group, record or array | `MdyDynamicNode` |

A `switch` over `item.kind` that handled `"field"` and `"group"` exhaustively now has cases it does
not: a row may be a collection of either kind. Building descriptors through `array()`, `record()`,
`group()` and `field()` is unaffected — those calls accept everything they accepted before.

Also fixed, and the reason the campaigns went red on this shape: replacing a nested collection in
place left the fields of the subtree it replaced behind, so a reorder above a nested list duplicated
that list into the row that moved and the row that arrived.
