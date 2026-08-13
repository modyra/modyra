---
"@modyra/core": minor
---

A record's row may hold a record

The first nesting the runtime can execute, and the first ADR 0040 enables:

```ts
const form = createForm({
  orders: record(group({ customer: field(""), lines: record(group({ sku: field("") })) })),
});
form.f.orders.upsert("o1", { customer: "Ada", lines: {} });
form.f.orders.row("o1").lines.upsert("l1", { sku: "SKU-1" });
```

The row's collection is a collection, not a cell: it has `keys`, `upsert`,
`remove`, `rename` and rows of its own, and it is resolved on each read so a row
removed and declared again is answered by the manager it has now.

Removing the parent takes the whole subtree — values, fields and async runners —
and a descendant nobody mounted still decides the form's validity.

Everything else is still refused, and still when the form is built rather than
when a row arrives. The message says what a row may hold, so the supported set
is readable from the failure.
