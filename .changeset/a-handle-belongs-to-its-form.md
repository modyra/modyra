---
"@modyra/core": minor
---

A handle belongs to its form, not to the computation that asked for it

On `@modyra/solid` a nested collection's cell read `null` for the life of the form while the value
was correct, and a handle taken from a positional collection kept reporting the row it held before a
`move`:

```js
form.f.orders.upsert("o1", { customer: "Ada" });
form.f.orders.row("o1").lines.push({ sku: "S-1", qty: 3 });
form.f.orders.row("o1").lines.at(0).sku.value();   // null — getValue() has "S-1"
```

A handle is made of computations and outlives the read that asked for it: a row handle is built
inside its collection's `rows` computation, a cell handle inside whatever the consumer was computing
when it called `cell()`. Solid owns a computation by the computation that created it, so the owner
re-running disposed the handle, and a disposed computation keeps answering with the value it last
held — `null` when the row's fields were not registered yet.

`MdyFormEngine.runOwned(build)` builds such an object under the form's own scope, and row and cell
handles use it. A runtime that does not own computations has no scope and calls the builder directly,
so nothing changes for it.

Every headless adapter now declares a nested collection in its own suite, which is what caught this.
