---
"@modyra/core": minor
---

A tree document's malformed child is refused alone, and the counts count declarations

`parseDynamicForm` on a tree document (ADR 0230):

- **A group's child that is not a node** is refused alone. This covers a bare value such as
  `"v": "x"` and an object such as `{ "node": "nope" }`. The child is reported as
  `MDY_DYNAMIC_INVALID_NODE` at its own path and counted as one rejection. Lenient mode keeps its
  siblings. It used to return no fields, as if the whole tree were unreadable. Strict mode still
  refuses the document. A non-node schema, and a collection whose `item` is not a node, still refuse
  it whole.
- **`rejectedCount` counts declarations refused.** A field kept with a finding, such as a select
  that dropped a duplicate option, used to be counted as rejected. A bare value used to count as
  nothing, so a document holding only one reported nothing entered and nothing refused.
- **A refused tree field is reported once**, at its declaration and under its own name. A second
  copy used to follow it, naming the field `"leaf"` at `/fields/0` or `/schema`.
- **A node is named by a string.** `node: ["field"]` converted to `"field"` and was read as a node,
  walked as whichever branch its other members fitted. It is now a malformed child like any other.
- **A row value its cell cannot hold** is reported at the cell's declaration under
  `…/item/field`, naming the row, for example `"items.0"`.

Migration: a host that read "lenient returned no fields" as the sign of a broken tree should read
`ok` or the diagnostics instead. `ok` is `false` in both the old and the new behaviour.

`contract:diff` classifies this as `patch`, because it covers the widget contract only. It is
released as `minor` because a lenient read of the same document now returns fields it used to
withhold.
