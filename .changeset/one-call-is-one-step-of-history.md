---
"@modyra/core": minor
---

One call is one step of history, and a restored row comes back where it was

Undo is a promise about states: every step on the way back is somewhere the person was. A collection
on the path broke it twice.

A write that changed several rows cost one press per row. `record.setAll` with three rows took three
undos to return, and each press in between showed a table with some rows written and some not —
while `record.patch` on the same handle, `array.setAll` and `form.patch` all cost one. `reset`,
`setValue`, `record.setAll({})` and a restored draft never returned at all: the rows came back one at
a time, reversed. All of them now record one entry, and `MdyCollectionHost` gains `mutate` so a
collection tells its host that a bulk write is one change.

A row a restore brought back arrived last, because restoring declares it again and a row declared
again is a new row:

```js
upsert("a"); upsert("b"); upsert("c");
remove("a");
undo();
// keys(): ["b", "c", "a"]   — was
// keys(): ["a", "b", "c"]   — is
```

A whole-value write now carries the order it holds, through an undo, a redo and a draft alike.

Undo counts change: a consumer pressing undo three times after a three-row `setAll` now goes three
steps further back. Nothing published stated the old count, and the intermediate states are no longer
reachable — which is the point.

Recorded as [ADR 0059](../docs/architecture/0059-a-step-of-history-is-a-state-the-form-was-in.md).
