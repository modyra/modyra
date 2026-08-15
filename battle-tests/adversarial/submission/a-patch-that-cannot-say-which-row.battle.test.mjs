/**
 * A change set ready for a PATCH request, that cannot say which row it patches.
 *
 * `getChanges()` is documented in those words: *minimal nested patch — only the fields whose value
 * differs from the schema's initial values, **ready for an API PATCH request***. And the collections
 * guide adds the rule that makes it minimal: it reports *changed values, not structure*, so a removal,
 * a move and an insertion leave it empty.
 *
 * For a keyed collection that composes into something a server can act on: the change set is keyed
 * too, so `{"rows":{"c":{"t":"EDITED"}}}` says which row.
 *
 * For a positional one it does not. The change set is a **compacted list** of the rows that changed,
 * with nothing saying where they were. Editing the first item, the second or the third all produce
 * the same body — one element, indistinguishable — and a server applying it positionally writes it to
 * index 0, which is the wrong row in two cases out of three.
 *
 * The keyed collection is the control and the shape that avoids it: the engine already answers this
 * question where the collection can be addressed.
 */

import { array, createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 60));

const openArray = () =>
  createForm(
    { list: array(group({ t: field("it") }), { initial: [{ t: "one" }, { t: "two" }, { t: "three" }] }) },
    { devWarnings: false },
  );

const openRecord = () =>
  createForm(
    { rows: record(group({ t: field("it") }), { initial: { a: { t: "one" }, b: { t: "two" }, c: { t: "three" } } }) },
    { devWarnings: false },
  );

battle(
  {
    claims: ["SUB-001", "COL-002"],
    title: "a change set says which row of a collection changed",
    environments: ["node"],
  },
  async (ctx) => {
    // The first control: a keyed collection's change set is addressable, so a server can act on it.
    // This is the shape the positional one is measured against, and it is one call away.
    const keyed = openRecord();
    await settled();
    keyed.f.rows.row("c").t.set("EDITED");
    await settled();
    const keyedChanges = keyed.getChanges();
    keyed.destroy();
    ctx.log.note("a keyed collection's change set", keyedChanges);

    expectEqual(keyedChanges, { rows: { c: { t: "EDITED" } } }, {
      claimIds: ["COL-002"],
      what: "a keyed collection's change set did not name the row that changed",
    });

    // The second control: a positional collection does report a change, so what follows is about
    // which row rather than about arrays being left out.
    const edited = openArray();
    await settled();
    edited.f.list.at(1).t.set("EDITED");
    await settled();
    const someChange = edited.getChanges();
    edited.destroy();

    expectClaim(JSON.stringify(someChange).includes("EDITED"), {
      claimIds: ["SUB-001"],
      what: "editing an array item produced no change at all, so there is nothing to address",
      detail: JSON.stringify(someChange),
    });

    // And the three that have to differ. A body that is the same whichever row was edited cannot be
    // applied to the row that was edited.
    const bodies = [];
    for (const index of [0, 1, 2]) {
      const form = openArray();
      await settled();
      form.f.list.at(index).t.set("EDITED");
      await settled();
      bodies.push({ index, body: JSON.stringify(form.getChanges()) });
      form.destroy();
    }
    ctx.log.note("the same edit at three positions", bodies);

    const distinct = new Set(bodies.map((each) => each.body));
    expectEqual(distinct.size, 3, {
      claimIds: ["SUB-001", "COL-002"],
      what: "editing the first, second or third item of an array produced the same patch body, so it cannot say which row it patches",
      detail: JSON.stringify(bodies),
    });
  },
);
