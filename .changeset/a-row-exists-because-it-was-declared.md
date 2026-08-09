---
"@modyra/core": major
"@modyra/standard-schema": patch
---

`record()` — a third structural node, for a collection whose keys are data.

`group()` keys rows at compile time and `array()` keys them by position. `record()` keys them by a
value the domain owns, so a row survives sorting and filtering, carries the id the server gave it,
and — the case an array cannot serve — lets **the controls of one row be mounted apart**, as a table
rendering column by column does.

```ts
const schema = { rows: record(group({ name: field(""), qty: field(0) })) };

form.f.rows.upsert("a3f9", { name: "Espresso", qty: 2 });
form.f.rows.cell("a3f9", "name").set("Ristretto");   // one control of one row
form.value().rows; // { a3f9: { name: "Ristretto", qty: 2 } }
```

A row exists because `upsert` declared it, never because a control mounted: a control on an
undeclared key waits and renders empty, unmounting one keeps the value, and validity belongs to the
declared row — so sorting or filtering a table cannot turn an invalid row valid. `remove(key)` is the
only way a row's value goes away. ADR 0026 records why.

**Breaking:** `MdySchemaPaths` gained a required `recordPaths`. Reading the result of
`collectSchemaPaths` is unaffected; implementing the interface yourself means adding the member
(`recordPaths: new Set()` preserves today's behaviour). `walkSchema`, `flattenPatch` and
`numericKeysToArrays` take new optional parameters and are unchanged when omitted.

Also fixed, found while building this: `MdyFormEngine.getValue()` did not depend on *which* fields
exist, so a form value read while a collection was empty stayed empty after rows arrived.
