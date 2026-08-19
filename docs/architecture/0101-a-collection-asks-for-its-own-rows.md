# ADR 0101: A collection asks for its own rows

Status: Accepted

## Context

Declaring rows into a collection cost more per row the more rows there were. Measured on a form of
orders each holding ten lines, one bulk write per level, the cost per order was:

    25 orders    1.12 ms      100 orders   1.63 ms      200 orders   3.56 ms

Reads did not do this and width did not do this — a form of thousands of plain fields builds and
reads linearly. The growth was in the two places that answer a question about a *path* by walking
something whose size is the form:

- `_gatesOver(name)` scanned every registered gate to find the ones covering a path. A collection
  registers a gate, so a form with a collection per row has a gate per row, and every path
  registered paid for all of them.
- An array's reconciliation effect read `fieldNames()` — every field the form holds — and kept the
  names under its own path. One collection per row again: each pays the width of the whole form.

Both are the same mistake in two shapes: a question scoped to a path answered by a scan of the
whole.

## Decision

A question about what lies under a path is answered from an index keyed by path, not by filtering
what lies under every path.

- The gates covering a path are the gates registered at its own ancestors, so they are looked up —
  `ancestorsOf(name)` in `path-utils`, one map lookup per segment — rather than searched for. Depth,
  not population.
- The engine keeps, per dotted prefix, the segments its children occupy, and exposes them as
  `childSegmentsUnder(prefix)`. A collection asking which rows the form holds reads its own prefix.
  The method reads the structure signal, so a caller inside an effect still re-runs when the shape
  changes, exactly as `fieldNames()` does.

`MdyCollectionHost.childSegmentsUnder` is **optional**: a host that does not implement it is asked
`fieldNames()` and filtered, as before. The contract gains a faster answer without requiring one.

## Consequences

Per order, after: 0.55 / 0.41 / 0.58 ms at 25 / 100 / 200 orders — flat within the noise of a loaded
machine, against 3.2× growth before.

The engine now maintains a map of maps where it maintained a map of counts: one entry per distinct
prefix, each holding one entry per distinct child segment. That is the shape of the form, so it is
bounded by the fields themselves, but it is a second structure to keep correct — a field created or
destroyed without going through `_indexPrefixes` leaves a row visible to a collection that no longer
has it.

The optional member is a fork in the contract: two paths that must agree, and only one of them is
exercised by the engine's own tests. The fallback is covered directly for that reason.

## Alternatives rejected

**Cache `fieldNames()` per collection and diff it.** Keeps the whole-form read and adds staleness:
the effect exists because fields appear by routes the collection does not see.

**Make `childSegmentsUnder` required.** It is the faster answer to a question the interface already
asks in a slower form, and requiring it breaks every host implemented against the published
interface for no capability gained.

**Index gates by depth instead of by prefix.** Answers "which gates could cover this" with a smaller
scan rather than with a lookup, and still grows with the number of gates at that depth — which, for
a collection per row, is the number of rows.

## Verification

- `battle-tests/adversarial/collections/a-list-that-does-not-scale.battle.test.mjs` — asserts a batch
  of orders costs what its orders cost, as a ratio between two sizes measured in one process.
- `packages/core/test/collection-host.test.mjs` — a collection reconciles against a host that
  implements `childSegmentsUnder` and against one that does not, so the fork cannot rot on one side.

## Security and privacy

No trust boundary moves and no data is stored that the engine did not already hold: the index holds
path segments, which are field names, not values. The cost this removes is a denial-of-service
surface in the weak sense — a document declaring many rows made a form quadratically expensive to
build — so a host rendering an attacker-supplied dynamic form pays less for the same document.
