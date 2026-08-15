# ADR 0044: A binding belongs to the row

Status: Accepted

## Context

`setDisabled` and `setReadonly` are how a control states what a user may do with a field. The engine
held them on the field record, keyed by path — and a row's path is not its identity. Two measurements
made that visible, both reachable from ordinary code:

- **A keyed row renamed** from `a` to `b` arrived without the binding. The cell the consumer had
  excluded was submitted again. Everything else the row carries — value, touched, dirty, verdicts —
  crossed the rename; only what a control had said about the cell did not.
- **A positional row moved** from index 0 to index 1 left the binding at index 0, where it then
  suppressed the *other* row's cell. The payload lost a value nobody had disabled and gained one that
  had been.

Both change what a submit carries, which makes them integrity findings rather than ergonomics.

The engine already treats a binding as row state in one direction: `setDisabled` on a path whose row
does not exist yet waits, and applies when the row arrives. A binding that waits for a row is a
statement about the row, not a subscription to a spelling.

## Decision

**What a binder said about a cell travels with the row.** A collection that changes a row's identity
carries its bindings: `rename` in a keyed collection, and `insert`, `remove` and `move` in a
positional one, through `MdyCollectionHost.carryBindings`.

**The value is carried, not the signal.** The signal belongs to a control bound to the old path, and
a control stays where it is while rows move under it: carrying the signal itself would let that
control keep speaking for a row it no longer shows. The engine snapshots the binding's current value
into a signal of its own; a control that follows its row says so again on its next render, replacing
the snapshot.

A binding is released when the row that held it ends and nothing is bound there — a claim, or a claim
waiting for its row, keeps it alive for the row that arrives next.

**Amendment.** A binding made before its row exists is *taken by the first row that arrives*, and
belongs to that row from then on. It is a statement about a row that has not arrived yet, not a
standing rule about an index or a key, so the row that takes it carries it and ends it. That makes
one sentence answer differently depending on what happened in between, which reads as an
inconsistency and is not one:

```js
setDisabled("items.0.note"); reset(); insert(0, …)                  // the row arrives disabled
setDisabled("items.0.note"); setAll([…]); reset(); insert(0, …)     // the row arrives enabled
```

In the second, `setAll` declared a row that took the binding; the reset ended that row and the
binding with it, and the row inserted afterwards is a different row about which nothing was said. The
first never had a row to take it. Measured rather than reasoned: the binding a `setAll` row takes
follows that row through a later `insert`, which is what says it was taken rather than merely
matched by path.

## Consequences

A structural change now moves state the engine did not previously track as row state, so a collection
has to know which row went where. `insert`, `remove` and `move` compute that ordering; `setAll` does
not, because a whole-value write states which rows there are rather than moving the ones that were.

The snapshot decouples a carried binding from its original control for one render. A consumer whose
control does not re-bind after a reorder — one that sets `disabled` once, outside the render path —
keeps the value it last stated, which is the same answer it would have had without the move.

This is a behaviour change with no type change, so `contract:diff` cannot classify it: the
classification lives here and in the changeset.

## Alternatives rejected

**Leave the binding at the path.** Defensible for a positional collection, where a control is
arguably bound to a position — and wrong for the payload: the exclusion then applies to whichever row
arrives, which is a value silently absent from a submit and another silently present.

**Carry the signal rather than its value.** Simpler, and it makes a control at the old path keep
speaking for a row it no longer shows. The generated campaign found exactly that: an `enable` at
index 0 re-enabled a cell of the row that had moved to index 1.

**Say a binding is not row state and document it.** Consistent only if a binding made before a row
exists were also refused; it is not, and refusing it would break the waiting-control pattern the
collection is built around.

## Verification

- `battle-tests/regressions/disabled-across-identity.battle.test.mjs` — a renamed row carries the
  exclusion; a moved row keeps it and the row left behind does not gain one.
- `battle-tests/generative/properties/records.property.test.mjs` and `arrays.property.test.mjs` —
  both campaigns compare the disabled paths a consumer can read, so a binding that stays behind or
  travels too far diverges from the model.
- `packages/core/test/collection-host.test.mjs` — a manager runs against a host double that
  implements `carryBindings` and `clearBindings`, so neither manager reaches for anything else.

## Security and privacy

The finding is a payload-integrity one: before this, a form could submit a value the consumer had
excluded, and omit one it had not. Nothing here touches storage, transport or trust boundaries; the
snapshot holds a boolean the consumer already stated.
