# ADR 0103: A patch names cells, in a list too

Status: Accepted

## Context

ADR 0102 made `getChanges()` withhold what a submit withholds, so a change set no longer carries a
disabled cell. That made a positional row *partial* — and revealed what a partial positional row
meant on the way back in:

    held          { list: [ { tag: "a", note: "EDIT0" }, … ] }   tag disabled
    getChanges    { list: [ {           note: "EDIT0" }, … ] }
    after patch   { list: [ { tag: "t", note: "EDIT0" }, … ] }

`"t"` is neither what the person typed nor what the row started as: it is the **field
declaration's** initial, which is what a row built from nothing gets. A form could not read the
change set its own door produced. A server merging the same body leaves the column where it is.

The keyed collection was already right on the same operation — `{rows: {a: {note: "EDIT"}}}` comes
back and `tag` survives — because `patch` on a record writes the cells a row names and leaves the
rest. The positional branch replaced the row instead, so every cell the row did not name was rebuilt
from the schema.

This was invisible while `getChanges` carried rows out of `getValue()`: the rows it produced were
always complete, so replacing them was indistinguishable from merging them.

## Decision

A patch names cells, in a positional collection as in a keyed one. A row a patch carries is written
over the row that is there: the cells it names are written, the cells it does not name stay as they
are. A row past the end is new, so there is nothing to keep and it is taken as it came.

What the *list* means is unchanged: its length states which rows there are, because an index is a
row's identity, and a row the list omits is gone. Only the reading of a row's own object changes.

The merge is driven by the schema and not by the value: an object-valued **leaf** — a range, a
colour — is one value and is replaced, where a group of cells is merged cell by cell.

This holds at every depth. A collection reached through a patched keyed row is patched, not
replaced, which is the same sentence one level down.

## Consequences

`patch({ list: [row] })` no longer resets the cells `row` omits. A caller who used a partial row to
mean "and clear the rest" loses that spelling and must name the cells it wants cleared — which is
what the keyed collection has always required.

`getChanges()` output fed back into `patch()` now reconstructs the form it came from, disabled cells
included, which is what "ready for an API PATCH request" claimed.

A patch and a whole-value write now differ in one more place, so `setValue` and `patch` are further
apart in behaviour than their signatures suggest. That difference is the point of having both, but
it is one more thing a reader has to hold.

`MdyNestedCollection` gains `patchFrom`, beside `setAllFrom`, so the two readings are named rather
than decided by the caller.

## Alternatives rejected

**Make the array branch of `MdyFormPatch` deep-partial and leave the runtime replacing.** Describes
the shape and keeps the defect: the type would say a partial row is accepted while the write still
rebuilt the cells it omitted.

**Have `getChanges()` name the whole row and say which cells it withholds.** Puts the withheld cells
back on the wire in some form, which is what ADR 0102 exists to stop, and invents a payload shape no
server reads.

**Leave it, and document that a change set is not a patch.** The method is documented as *"ready for
an API PATCH request"*, and the keyed half already behaves as documented. Two collection kinds
answering the same call differently is the defect, not the fix.

## Verification

- `battle-tests/adversarial/submission/a-change-set-its-own-door-cannot-read.battle.test.mjs` — feeds
  a change set back through `patch` and asserts the cells it did not name survived, with the keyed
  branch beside it as the control.
- `packages/core/test/core.test.mjs` — the existing patch and whole-value write cases, which pin the
  half of the meaning this does not move.

## Security and privacy

This closes the return leg of ADR 0102's finding rather than opening one: a disabled cell now stays
out of the change set *and* survives the round trip, where before it was replaced by a value the
form invented. No new data leaves the process and no trust boundary moves.
