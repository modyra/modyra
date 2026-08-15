# ADR 0058: A rename moves a key, not a row

Status: Accepted

## Context

`rename` is defined against the operation it is not: *"`remove` followed by `upsert` reaches the same
value; what only this can keep is the state the user produced — a field they visited stays visited."*
It kept that. It also did something nobody wrote down — it carried the move out *as* a remove and an
upsert, so the row arrived last:

```js
form.f.orders.upsert("b", { ref: "A1" });
form.f.orders.upsert("c", { ref: "A1" });
form.f.orders.rename("b", "a");
// keys(): ["c", "a"]
```

On the one axis a person looking at a table can see, the operation and the operation it is defined
against were the same operation. A user renaming the second row of five watches it jump to the
bottom, and the case that would teach a consumer this — renaming the last row — is the one where
nothing appears to happen.

Worse, the two answers disagreed with each other. A keyed collection kept **two** orders: the key
list behind `keys()`, and the order the row's fields sat in, which is what the flat value is read
out of. Nothing else diverged them, because nothing else re-registered a row's fields in place:
`upsert` on an existing key, `remove`, and remove-then-upsert all had both answers agreeing.

`COL-002` — *record identity is the domain key, not presentation order* — says identity does not come
from position. It does not say position is free to move on its own, and the published comparison
already promises a key *"renamed in place"*.

## Decision

**A rename leaves the row where it is.** The key changes; the row's place among its siblings does
not. Remove-then-upsert still appends, which is the difference the two operations exist to have.

**One order, answered by the collection.** `keysNow()` reads the key list rather than the membership
set, so every reader that composes it — the leaf paths, the values, an enclosing collection — follows
the same order the handle answers. Where a rename has re-registered a row's fields,
`MdyCollectionHost.orderRowsUnder` places them back in the collection's order, so the value and the
handle cannot answer differently about the same list at the same moment.

## Consequences

`getValue()`, `submitValue()` and `getChanges()` emit a renamed row's key where the row is, not where
it was re-registered. A consumer diffing serialized output across a rename sees the key change and
nothing else move — which is the point, and is a visible change from what shipped.

`MdyCollectionHost` gains a method, so anything implementing that interface — a test double, a host
that is not the engine — implements it too. The interface exists to be substitutable, and this is
what that costs. It is not on any entry point's export map, so that cost falls inside this repository
rather than on a consumer; `MdyFormEngine.orderRowsUnder` is public, and the type-surface audit
classifies it as minor.

Re-placing fields is O(fields under the collection) per rename, on an operation a user performs one
row at a time. It does not run for any other collection operation.

A positional collection is unaffected: an index *is* the position, and `move` is the operation that
changes it.

## Alternatives rejected

**Document that a rename reorders.** It closes the finding as cheaply, and after the value/handle
split was measured it would have had to say that a rename reorders *one* of the two readings and not
the other. That sentence describes an accident rather than a decision.

**Normalise the order at every read** — sort keys, or read the value through the key list at the top.
It hides the divergence rather than removing it, and it makes a collection's order a property of the
reader instead of a property of the collection.

**Rebuild the engine's field map on every collection change.** Broader, slower, and it would move the
authority over order from the collection to the engine, which does not know what a row is.

## Verification

- `battle-tests/adversarial/collections/a-renamed-row-changes-places.battle.test.mjs` — the row's
  place at the top level and one level down, and the value and the handle agreeing.
- `packages/core/test/collection-host.test.mjs` — a record manager driving a host that is not the
  engine, which is what keeps the new method on the contract rather than on the class.
- The generative record campaigns compare against reference models that encode the old rule; they
  report this decision as a divergence until those models follow it.

## Security and privacy

None. Order is presentation, no value crosses a boundary it did not cross before, and no message
carries a row's contents.
