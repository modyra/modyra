---
"@modyra/core": minor
---

A renamed row stays where it is, and the value agrees with the handle

`rename` is defined against `remove` followed by `upsert` — what only it can keep is the state the
user produced. It also did what that pair does and appended the row:

```js
form.f.orders.upsert("b", { ref: "A1" });
form.f.orders.upsert("c", { ref: "A1" });
form.f.orders.rename("b", "a");
// keys(): ["c", "a"]   — the row a user renamed jumps to the bottom of their table
```

A keyed collection was keeping two orders: the key list `keys()` answers, and the order a row's
fields sit in, which is what the flat value is read out of. Nothing else diverged them — `upsert` on
an existing key, `remove` and remove-then-upsert all had both answers agreeing.

A rename now leaves the row where it is, and `getValue()`, `submitValue()` and `getChanges()` say so
too. Remove-then-upsert still appends, which is the difference the two operations exist to have.
`MdyCollectionHost` gains `orderRowsUnder` so a collection, rather than the engine, decides the order
of the rows under its path. Anything implementing that interface — a host that is not the engine, a
test double — implements the new method too; the type-surface audit classifies the added method on
`MdyFormEngine` as minor and does not see the interface member, which for an implementer is a
breaking change.

A consumer diffing serialized output across a rename now sees the key change and nothing else move.
Recorded as [ADR 0058](../docs/architecture/0058-a-rename-moves-a-key-not-a-row.md).
