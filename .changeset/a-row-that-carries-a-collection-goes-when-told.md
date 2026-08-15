---
"@modyra/core": patch
---

A row that carries a collection ends when its declaration is replaced

Re-declaring a row replaces what is there — an `upsert` on a key that already names a row is not a
patch. It held for a row of plain cells and not for a row carrying a collection of its own:

```js
form.f.orders.upsert("a", { ref: "first",  lines: [] });
form.f.orders.row("a").lines.push({ sku: "S1", allocations: [] });
form.f.orders.upsert("a", { ref: "second", lines: [] });
// lines: [{ allocations: [], sku: null }]   — the line survived, its cell nulled
```

A collection registers a field at its own path so that errors attributed to the collection have
somewhere to surface. That field is not a leaf, so tearing a replaced subtree down by its leaves left
it behind, and a field under a row is a row as far as the reconciliation is concerned: it declared
the row again, holding nothing. One level deeper the form could not be read at all — `getValue()`
threw `Flat value does not match schema shape`.

Both managers now end the collections below a subtree they replace, at any depth, and
`MdyNestedCollection` gained `collectionPathsNow()` to answer for them. Measured on five shapes: a
list or a map inside a row, a map of rows, three positional levels, and the row of plain cells that
was already correct.

Found by `battle-tests/regressions/a-row-that-would-not-go.battle.test.mjs`; it also closes the
keyed-nested and history generative campaigns, which had been reporting this class through a longer
sequence.
