# ADR 0041: History crosses structural changes

Status: Accepted

## Context

The undo history recorded only what the snapshot effect had seen, and the effect runs on the
reactivity's schedule — a microtask for the vanilla graph. A structural change — a row declared,
removed or renamed — followed synchronously by `undo()` found no entry and silently kept the
change. The characterization suite pinned that as a limitation: *history does not cross a
structural change*.

The limitation was mostly an accident of scheduling, not a design. The restore path already handled
structure: `undo` hands the engine a whole value, `onReplace` removes the keys the snapshot does not
name, and a refused write re-declares a row the snapshot carries. Post-tick, a removed subtree came
back whole — at any depth — with nothing claiming or verifying it. Enterprise tables built on
nested collections need the claim: removing an order and undoing it is a basic operation, and a
capability that works by accident regresses by accident.

## Decision

**Undo and redo act on the value as it is now, not as the scheduler last saw it.** Before popping,
each records any unseen change (`_recordCurrent` in `MdyHistoryManager`), so a structural change is
undoable the moment it is made. What restoration means is unchanged: the engine receives a whole
value; collections remove what it does not name and re-declare what it carries, at every depth.

A `rename` — synchronously a remove and an upsert — coalesces into one history entry, because one
snapshot separates the states before and after.

The boundary stays where it was for value edits: only the **value** is recorded. Touched, dirty,
validation verdicts and server errors are not restored by undo or redo. A restored row is a fresh
declaration — its async validators run again against the restored value; verdicts of the dead row
were aborted with it.

## Consequences

- A change made after an undo invalidates the redo stack — recording-before-popping is what
  enforces the editor semantics everywhere, including for structure.
- Undo restores structure but not row state: a restored row arrives untouched and revalidating.
  Consumers that need flags restored must keep them outside the form value.
- The synchronous window is closed at the cost of one extra value read per undo/redo call — O(fields),
  on an operation triggered by a user gesture.

## Amendment: the affordance answers the same question

`undo()` and `redo()` acting on the value as it is now is only half the decision. `canUndo` and
`canRedo` are what a consumer binds an Undo and a Redo button to, and they were stored flags updated
by the snapshot effect — so they answered for the last state the scheduler had seen. In the window
this record exists to close, `canUndo()` read `false` while `undo()` would have removed the row that
had just been declared, and `canRedo()` stayed true after an edit that had already invalidated the
redo stack.

**Both signals are derived from the current value**, not stored: `canUndo` is true when a stack entry
exists *or* the value has moved since the last snapshot; `canRedo` is true when a redo entry exists
*and* it has not. The affordance and the operation now answer the same question in the same task.

The cost is one shallow value comparison per read after a change — on signals a consumer reads to
paint a button, so the read is already tied to a render.

## Alternatives rejected

**Managers notify history on every structural change.** More moving parts — a notification path
through every collection manager, guards against recording during `mutate` and during restore, and
a coalescing rule for `rename` — to reach the same observable behavior the two-line
record-before-pop gives. Rejected as complexity without added capability.

**Claim post-tick behavior only.** Leaves a trap: `remove(); undo()` in one task silently keeps the
removal. An API whose correctness depends on a scheduler detail the caller cannot see is the kind
of defect this repository exists to not ship.

## Verification

- `packages/core/test/nested-collections.test.mjs` — structural undo/redo claims: synchronous undo
  of a declaration, a removed subtree restored whole at two depths, rename as one step, redo
  re-applying a rename, undo of a parent whose child had a verdict pending.
- `packages/core/test/nested-collections.test.mjs` — the amendment's claim: `canUndo` true in the
  task that declared a row, `canRedo` false once an unrecorded edit has invalidated the redo stack.
- `packages/core/test/async-validation.test.mjs` — a late async result for a removed row resurrects
  nothing.
- `npm run test:core` — the value-history suite and the collection host double pass unchanged,
  which is what says the closing of the window did not move value semantics.

## Security and privacy

No new surface. Snapshots hold the same form value the engine already holds, restored through the
same path-gated writes (`isSafeFieldPath` applies to every restored key); a hostile key cannot
enter through undo any more than through a direct write. History remains in memory only — nothing
here persists or transmits values.
