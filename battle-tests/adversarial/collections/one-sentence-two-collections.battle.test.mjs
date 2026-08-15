/**
 * The same patch, written for a map and for a list.
 *
 * `patch` is documented as "a deeply-typed variant of `patchValue` for nested groups" and says nothing
 * about what it does to a collection. The two kinds do opposite things, and the sentence that
 * separates them is one a consumer writes without thinking:
 *
 *   form.patch({ rows: {} })   → nothing changes
 *   form.patch({ list: [] })   → the list is emptied
 *
 * Both readings are defensible for their own kind. A keyed map has keys to merge by, so `{}` names no
 * key and changes nothing; a list has positions rather than names, so the only thing `[]` can mean is
 * the list it describes. That is not the problem. The problem is that they are the same sentence — *this
 * collection, holding nothing* — and a consumer who learns one from a map and writes it for a list
 * deletes their rows.
 *
 * What the two do when a collection is **omitted** is the same, and that is asserted first: leaving a
 * collection out of a patch leaves it alone, in both. So the divergence is about naming a collection
 * with an empty value, not about patching at all.
 *
 * Either resolution closes this: the contract says which kind does which, or an empty value means the
 * same thing in both. The battle asserts the second because it is the one a reader would guess, and a
 * documented difference would make this battle wrong on purpose — which is a better outcome than a
 * consumer finding out from their data.
 */

import { array, createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A form with one of each kind of collection, each holding two rows. */
function filled() {
  const form = createForm(
    {
      note: field("n"),
      rows: record(group({ code: field("") })),
      list: array(group({ sku: field("") })),
    },
    { devWarnings: false },
  );
  form.f.rows.upsert("a", { code: "A" });
  form.f.rows.upsert("b", { code: "B" });
  form.f.list.push({ sku: "s1" });
  form.f.list.push({ sku: "s2" });
  return form;
}

const held = (form) => ({ rows: Object.keys(form.getValue().rows), list: form.getValue().list.length });

battle(
  {
    claims: ["COL-002", "SUB-001"],
    title: "a collection a patch does not name is a collection a patch does not touch",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, and it is the same for both kinds: omission changes nothing.
    const form = filled();
    try {
      const before = held(form);
      form.patch({ note: "changed" });
      ctx.log.note("a patch that names neither collection", { before, after: held(form), note: form.getValue().note });

      expectEqual(held(form), before, {
        claimIds: ["COL-002"],
        what: "a patch that named neither collection changed one of them",
      });

      expectEqual(form.getValue().note, "changed", {
        claimIds: ["SUB-001"],
        what: "the patch did not write the one field it named, so nothing above was tested",
      });
    } finally {
      form.destroy();
    }

    // And naming a collection with something in it means the same in both: a map merges by key, a
    // list is the list it describes. Both are what the kind can mean.
    const merged = filled();
    try {
      merged.patch({ rows: { a: { code: "A2" } } });
      expectEqual(merged.getValue().rows, { a: { code: "A2" }, b: { code: "B" } }, {
        claimIds: ["COL-002"],
        what: "patching one row of a map did not merge into it",
      });
    } finally {
      merged.destroy();
    }
  },
);

battle(
  {
    claims: ["COL-002", "SUB-001"],
    title: "naming a collection with nothing in it means the same for both kinds",
    environments: ["node"],
  },
  async (ctx) => {
    const outcomes = [];

    const map = filled();
    const mapBefore = held(map);
    map.patch({ rows: {} });
    outcomes.push({ kind: "a keyed map, patched with {}", before: mapBefore, after: held(map) });
    map.destroy();

    const list = filled();
    const listBefore = held(list);
    list.patch({ list: [] });
    outcomes.push({ kind: "a list, patched with []", before: listBefore, after: held(list) });
    list.destroy();

    ctx.log.note("the same sentence, in two type systems", { outcomes });

    // The premise: both started holding two rows, so a difference below is what the patch did.
    expectClaim(outcomes.every((each) => each.before.rows.length === 2 && each.before.list === 2), {
      claimIds: ["COL-002"],
      what: "the forms did not start with rows in both collections",
      detail: JSON.stringify(outcomes),
    });

    const mapKept = outcomes[0].after.rows.length === outcomes[0].before.rows.length;
    const listKept = outcomes[1].after.list === outcomes[1].before.list;
    expectEqual(listKept, mapKept, {
      claimIds: ["COL-002", "SUB-001"],
      what: "naming a collection with nothing in it leaves a map alone and empties a list, and the contract says which for neither",
      detail: JSON.stringify(outcomes),
    });
  },
);
