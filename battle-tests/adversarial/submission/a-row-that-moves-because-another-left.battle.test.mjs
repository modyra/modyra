/**
 * What a positional collection means to whoever receives it when a row is out of play.
 *
 * A disabled value is not submitted, and for a leaf that means its key is absent. For a row of a
 * *positional* collection it means something a key cannot mean: the rows after it move up. A server
 * reading `list[0]` after the first row was disabled is reading what the person saw as the second.
 *
 * It is the only thing the engine could do — an array cannot carry a hole, and sending `null` in the
 * gap would put a value in the payload that nobody entered. But it is the one interactivity change
 * that alters the *meaning of a position* rather than only the set of values, and a keyed collection
 * has no equivalent: a key that is absent is absent, and the others are where they were.
 *
 * This battle is green and exists to record that, not to object to it. It is written down because it
 * is the kind of thing that is discovered in production by somebody correlating by index, and because
 * a change to it would be a change to what a payload means without any type moving.
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
    title: "a disabled row moves the rows after it, and a disabled key moves nothing",
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

    // A positional collection: the row is gone from the payload and the rest have moved up. What was
    // second is now `list[0]`.
    const shifted = positional();
    shifted.setDisabled("list.0.tag", () => true);
    await settled();
    const afterShift = await submittedBy(shifted);
    ctx.log.note("what a server receives when the first row is out of play", afterShift);

    expectEqual(afterShift, { list: [{ tag: "second" }, { tag: "third" }] }, {
      claimIds: ["VAL-002", "SUB-002"],
      what: "a disabled row did not leave the payload, or left a hole in it",
    });
    shifted.destroy();

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

    // The two together are the point: the same change, one collection kind moves the survivors and
    // the other does not. A reader correlating a positional payload by index has to know that.
    expectEqual(
      [afterShift.list.map((row) => row.tag), Object.keys(afterNamed.rows)],
      [["second", "third"], ["b", "c"]],
      {
        claimIds: ["SUB-002", "COL-002"],
        what: "the two collection kinds no longer differ in what a disabled row does to the others",
      },
    );
  },
);
