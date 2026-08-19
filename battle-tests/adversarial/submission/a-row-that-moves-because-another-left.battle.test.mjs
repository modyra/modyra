/**
 * What a positional collection means to whoever receives it when a row is out of play.
 *
 * A disabled value is not submitted, and for a leaf that means its key is absent. The two collection
 * kinds answer that differently, and the difference is the identity each of them uses:
 *
 *     positional   a row that sends nothing is sent as `{}` at the index it holds
 *     keyed        a row that sends nothing is absent, and the other keys are where they were
 *
 * In a positional collection the index **is** the identity: a correlated list beside it, a server
 * reading row three as row three. Dropping the row would move every row after it to a position that
 * is not theirs, so a reader correlating by index would attribute one person's answers to another.
 * `{}` is not a hole and not a value nobody entered — it is an empty row at the place its row holds.
 *
 * In a keyed collection the name is the identity and the order carries nothing, so absence is only
 * absence and nothing else moves.
 *
 * This battle is green and exists to record the pair, not to object to either half. It is the kind of
 * thing discovered in production by somebody correlating by index, and a change to it is a change to
 * what a payload means without any type moving.
 */

import { array, createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 60));

async function submittedBy(form) {
  let payload = null;
  await form.submit((value) => {
    payload = value;
  });
  return payload;
}

battle(
  {
    claims: ["VAL-002", "SUB-002", "COL-002"],
    title: "a disabled row keeps its position, and a disabled key leaves none",
    environments: ["node"],
  },
  async (ctx) => {
    const positional = () => createForm(
      { list: array(group({ tag: field("t") }), { initial: [{ tag: "first" }, { tag: "second" }, { tag: "third" }] }) },
      { devWarnings: false },
    );
    const keyed = () => createForm(
      {
        rows: record(group({ tag: field("t") }), {
          initial: { a: { tag: "first" }, b: { tag: "second" }, c: { tag: "third" } },
        }),
      },
      { devWarnings: false },
    );

    // The control: with nothing disabled, both carry what they hold.
    const untouched = positional();
    await settled();
    expectEqual(await submittedBy(untouched), { list: [{ tag: "first" }, { tag: "second" }, { tag: "third" }] }, {
      claimIds: ["SUB-002"],
      what: "a positional collection did not submit the rows it holds",
    });
    untouched.destroy();

    // A positional collection: the row sends nothing and stays where it is, so what the person saw
    // as the second row is still `list[1]`.
    const shifted = positional();
    shifted.setDisabled("list.0.tag", () => true);
    await settled();
    const afterShift = await submittedBy(shifted);
    ctx.log.note("what a server receives when the first row is out of play", afterShift);

    expectEqual(afterShift, { list: [{}, { tag: "second" }, { tag: "third" }] }, {
      claimIds: ["VAL-002", "SUB-002"],
      what: "a disabled row left the payload, or took the rows after it with it",
    });
    shifted.destroy();

    // The last row, because a collection that truncated a trailing empty row would keep every index
    // below it correct and still change the length a receiver reads.
    const trailing = positional();
    trailing.setDisabled("list.2.tag", () => true);
    await settled();
    const afterTrailing = await submittedBy(trailing);
    expectEqual(afterTrailing, { list: [{ tag: "first" }, { tag: "second" }, {} ] }, {
      claimIds: ["SUB-002"],
      what: "a disabled last row shortened the list instead of holding its place",
    });
    trailing.destroy();

    // And the keyed collection, where absence is only absence.
    const named = keyed();
    named.setDisabled("rows.a.tag", () => true);
    await settled();
    const afterNamed = await submittedBy(named);
    ctx.log.note("the same change to a keyed collection", afterNamed);

    expectEqual(afterNamed, { rows: { b: { tag: "second" }, c: { tag: "third" } } }, {
      claimIds: ["COL-002"],
      what: "a disabled row changed where the other rows are in a keyed collection",
    });
    named.destroy();

    // The two together are the point: the same change, one collection kind holds the position and
    // sends nothing in it, the other drops the name. A reader of either has to know which they have.
    expectEqual(
      [afterShift.list.map((row) => row.tag ?? null), Object.keys(afterNamed.rows)],
      [[null, "second", "third"], ["b", "c"]],
      {
        claimIds: ["SUB-002", "COL-002"],
        what: "the two collection kinds no longer differ in what a disabled row does to the others",
      },
    );
  },
);
