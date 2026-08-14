---
"@modyra/core": patch
---

A row is taken apart as one change, like it is declared

Declaring a row was made atomic; ending one was not, and they are the same hazard. On
`@modyra/solid`, taking a row apart raised:

```js
form.f.rows.upsert("r", { a: "A" });
form.f.rows.rename("r", "q");   // [modyra] Flat value does not match schema shape
form.f.rows.remove("r");        // the same
form.f.lines.remove(0);         // and the positional half, through setAll too
```

A row ends cell by cell, so a runtime whose computations run eagerly reads the form between two of
them and finds a shape the schema does not describe. A keyed collection's `remove` and `rename` are
now one change each, and a positional collection batches the whole rebuild — ending rows included —
rather than only the registration half.

Every headless adapter's suite now renames, removes and rebuilds a two-cell row on its own
reactivity. Found by `battle-tests/differential/runtimes/`, which could not even reach its handle
comparison on Solid because the scenario renames a row first.
