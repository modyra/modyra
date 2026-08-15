# ADR 0059: A step of history is a state the form was in

Status: Accepted

## Context

Undo is a promise about states, not about writes: every step on the path back is somewhere the person
was. Two things broke that promise, and both were invisible until a collection was on the path.

**A bulk write cost one step per row.** Measured, one call affecting three rows:

| call | presses to return |
| --- | --- |
| `array.setAll`, `record.patch`, `form.patch`, one cell | 1 |
| `record.setAll` | 3 |
| `record.setAll({})`, `reset`, a restored draft, `setValue` | never returned |

Each press in between showed a table with some rows written and some not — a state the collection was
never in. Two methods on one handle disagreed, which is what makes it a defect rather than a cost:
`patch` grouped and `setAll` did not.

"Never returned" was about order rather than values. Clearing three rows and undoing brought them all
back, one at a time, reversed.

**A row a restore brought back arrived last.** A snapshot restores through the same doors a consumer
writes through, so a row missing from the current form was declared again — and a row declared again
is a new row at the end:

```js
upsert("a"); upsert("b"); upsert("c");
remove("a");
undo();
// keys(): ["b", "c", "a"]
```

The three roads to a restored state — an undo, a redo, a draft coming back — all did it.

## Decision

**A call is a step.** A write that changes several rows records one history entry, whatever it
touches: `record.setAll`, `reset`, `setValue` and a restored draft group the same way `form.patch`
always has. `MdyCollectionHost` gains `mutate`, so a collection says "this is one change" to its host
rather than the host inferring it from the writes it happens to see.

**A snapshot restores the order it holds.** A whole-value write says which rows there are *and* what
order they are in; a keyed collection places its rows in that order, and the fields under it follow,
so the value and the handle agree about a restored state as they do about a live one.

**Putting a snapshot back is not a change.** `recordNow()` is a no-op while the history manager is
restoring — the snapshot effect had always skipped for that reason, and grouping the restore made the
gap reachable: a snapshot taken at the end of a restore recorded the state being restored *to* and
emptied the redo stack, so a redo after an undo had nothing left to apply.

## Consequences

Undo counts change. A consumer who called `record.setAll` with three rows and pressed undo three
times now returns three steps further back than before. Nothing published stated the old count, and a
step per row was not a cost anyone chose.

Grouping means the intermediate states are no longer reachable at all — there is no way to undo half
of a bulk write. That is the intent, and it is a capability removed from anyone who was relying on
the accident.

`MdyCollectionHost` gains a member, so anything implementing it implements one more. The interface
exists to be substitutable and this is what that costs. It reaches no entry point — neither it nor
the two managers that consume it is exported — so the cost falls inside this repository, and the
type-surface audit is silent because there is nothing public to classify rather than because it
cannot see it: a required member added to a *public* interface is reported, and classified major.

Restoring an order means a keyed collection's order is now a property a snapshot carries. A
positional collection is unaffected: an index is the order.

## Alternatives rejected

**Group in the handles rather than in the managers.** Smaller, no contract change — and it makes "one
call is one change" a property of the wrapper a consumer happens to hold rather than of the
operation. A manager driven directly would keep the old cost.

**Record a history entry per structural change and coalesce on read.** It keeps the writes honest and
moves the problem to undo, which would have to know how many entries to pop, and any answer to that
is the grouping decision made later and with less information.

**Leave the restore appending and document it.** The row's place is what a rendered table shows; a
snapshot that restores every value but not the order is not the state it claims to be, and after
[ADR 0058](0058-a-rename-moves-a-key-not-a-row.md) it would mean a live rename keeps a row's place
while an undone one does not.

## Verification

- `battle-tests/adversarial/persistence/undo-of-a-whole-write.battle.test.mjs` and
  `battle-tests/adversarial/collections/one-edit-one-undo.battle.test.mjs` — the presses each call
  costs, with a single-row removal and `form.patch` as the controls that were already right.
- `battle-tests/regressions/undo-puts-the-row-back-last.battle.test.mjs` — the row's place across an
  undo, a rename undone, and a rename redone.
- `packages/core/test/nested-collections.test.mjs` — redo after an undone rename applies it again,
  which is the check that caught the `recordNow()` gap.
- The `records`, `keyed-nested` and `history` generative campaigns, green at 300 runs on a fixed seed.

## Security and privacy

None. History is in memory and holds values the form already holds; grouping changes how many
snapshots exist, not what they contain, and a restore reads the same snapshot it read before.
