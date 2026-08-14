---
"@modyra/core": patch
---

A row's cells land as one change, so eager runtimes can declare a collection

`@modyra/solid` could not declare a collection row with more than one cell:

```js
createForm({ rows: record(group({ code: field(""), note: field("") })) }, { reactivity: solidReactivity() });
form.f.rows.upsert("a", { code: "A" });
// [modyra] Flat value does not match schema shape
```

A row registers its cells one at a time. Solid's computations run eagerly, so one of them re-read the
form between two cells and found a row holding some of them — a shape the schema does not describe,
and a read that raises. One cell worked, which is why it survived: the adapter's suite runs under
`--conditions=browser`, and nothing in it declared a collection.

Both managers now register a row, and a whole-value rebuild, inside `batch()` where the runtime
reports it. A runtime without batching behaves exactly as before, and the rollback added alongside
still restores if reading the value raises.

This was every Solid consumer with a collection. The other eager runtimes were not affected in
measurement, but the change protects them by construction rather than by their scheduling.
