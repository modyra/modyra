/**
 * What a change set means to the call typed to accept it.
 *
 * `getChanges()` returns `MdyFormPatch<S>`, and `patch()` takes one. Two published doors, one type,
 * so a change set is a thing this library hands out and takes back. The two read an array branch
 * differently:
 *
 *     getChanges   a row may name only some of its cells — a disabled cell is not in it
 *     patch        a row is whole: a cell the row does not name goes back to its declared initial
 *
 * So a change set carrying a partial row, fed back, rewrites cells nobody touched:
 *
 *     held        { list: [ { tag: "a", note: "EDIT0" }, … ] }   tag "a" is disabled
 *     changes     { list: [ {           note: "EDIT0" }, … ] }
 *     after patch { list: [ { tag: "t", note: "EDIT0" }, … ] }   "t" is the field's declared initial
 *
 * A server merging the same body leaves the column alone. The library's own door does not, and the
 * value it writes is one nobody entered at any point.
 *
 * The keyed branch is the contrast, on the same operation: its rows are deep-partial, so the same
 * round trip keeps the cell the change set did not name.
 *
 * Green when a change set fed back into `patch` leaves every value it does not name as it was —
 * whichever kind of collection holds it. Two answers close it: an array branch that patches
 * deep-partially like the keyed one, or a change set that names a whole row and says which of its
 * cells are withheld.
 */

import { array, createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 60));

const positional = () => createForm(
  {
    list: array(group({ tag: field("t"), note: field("n") }), {
      initial: [{ tag: "a", note: "n1" }, { tag: "b", note: "n2" }],
    }),
  },
  { devWarnings: false },
);

const keyed = () => createForm(
  {
    rows: record(group({ tag: field("t"), note: field("n") }), {
      initial: { a: { tag: "A", note: "n1" }, b: { tag: "B", note: "n2" } },
    }),
  },
  { devWarnings: false },
);

/** Edit one cell, withhold another, and hand the change set to a form in the state the first started in. */
async function roundTrip(make, { edit, withhold }) {
  const from = make();
  await settled();
  from.cellHandle(edit).set("EDIT");
  await settled();
  from.setDisabled(withhold, () => true);
  await settled();
  const changes = from.getChanges();
  const held = from.getValue();
  from.destroy();

  const into = make();
  await settled();
  into.patch(changes);
  await settled();
  const after = into.getValue();
  into.destroy();

  return { changes, held, after };
}

battle(
  {
    claims: ["SUB-001", "COL-001", "COL-002"],
    title: "a change set fed back keeps what it did not name",
    environments: ["node"],
  },
  async (ctx) => {
    // The keyed half is the control and the contrast at once: a deep-partial row round-trips, so a
    // failure below is the array branch rather than change sets or `patch` at large.
    const named = await roundTrip(keyed, { edit: "rows.a.note", withhold: "rows.a.tag" });
    ctx.log.note("a keyed change set, out and back", named);
    expectEqual(named.after, named.held, {
      claimIds: ["SUB-001", "COL-002"],
      what: "a keyed change set fed back did not rebuild the value it came from",
    });

    const listed = await roundTrip(positional, { edit: "list.0.note", withhold: "list.0.tag" });
    ctx.log.note("a positional change set, out and back", listed);

    // The cell the change set did not name is the whole question: it was "a" and it must not become
    // something else because a row travelled without it.
    expectEqual(listed.after.list[0].tag, listed.held.list[0].tag, {
      claimIds: ["SUB-001", "COL-001"],
      what: "a cell a change set withheld was rewritten when the change set was fed back",
      detail: JSON.stringify(listed),
    });

    expectEqual(listed.after, listed.held, {
      claimIds: ["SUB-001", "COL-001"],
      what: "a positional change set fed back did not rebuild the value it came from",
    });
  },
);
