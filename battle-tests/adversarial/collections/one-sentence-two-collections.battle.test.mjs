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
 * The difference was kept and documented, for a reason this battle had not weighed: an index *is* a
 * positional row's identity, so a partial list is not a partial patch but an ambiguous one. Making
 * `[]` a no-op would leave a patch with **no spelling at all** for "this list is now empty", while a
 * map keeps one in `setAll({})` — symmetry bought by removing a capability from one side.
 *
 * So what the second battle asserts now is the difference as declared, and the guard that makes it
 * survivable: the destructive reading **says so**, in development, while the rows are still
 * recoverable. The silence of the other two is asserted beside it, because a warning that fired on
 * every patch would satisfy the first assertion and mean nothing.
 */

import { array, createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/**
 * A form with one of each kind of collection, each holding two rows.
 *
 * `devWarnings` is a parameter because the warning that makes the destructive reading survivable is
 * dev-gated: a battle asking whether it speaks has to build a form that is listening.
 */
function filled({ devWarnings = false } = {}) {
  const form = createForm(
    {
      note: field("n"),
      rows: record(group({ code: field("") })),
      list: array(group({ sku: field("") })),
    },
    { devWarnings },
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
    title: "the patch that empties a list says that it did",
    environments: ["node"],
  },
  async (ctx) => {
    /** Run something with the console captured, and give back what it said. */
    const whileListening = (run) => {
      const said = [];
      const realWarn = console.warn;
      console.warn = (...parts) => said.push(parts.join(" "));
      try {
        run();
      } finally {
        console.warn = realWarn;
      }
      return said;
    };

    // A map named with nothing in it: no key to merge, so nothing changes — and nothing to warn about.
    const map = filled({ devWarnings: true });
    const mapBefore = held(map);
    const aboutTheMap = whileListening(() => map.patch({ rows: {} }));
    const mapAfter = held(map);
    map.destroy();

    // A list named with nothing in it: the whole list, because an index is a row's identity.
    const list = filled({ devWarnings: true });
    const listBefore = held(list);
    const aboutTheList = whileListening(() => list.patch({ list: [] }));
    const listAfter = held(list);
    list.destroy();

    // And a patch that leaves both out.
    const untouched = filled({ devWarnings: true });
    const untouchedBefore = held(untouched);
    const aboutNothing = whileListening(() => untouched.patch({ note: "changed" }));
    const untouchedAfter = held(untouched);
    untouched.destroy();

    ctx.log.note("the same sentence, in two type systems", {
      map: { before: mapBefore, after: mapAfter, said: aboutTheMap.length },
      list: { before: listBefore, after: listAfter, said: aboutTheList.length },
      neither: { before: untouchedBefore, after: untouchedAfter, said: aboutNothing.length },
    });

    // The premise: both started holding two rows, so what follows is what each patch did.
    expectClaim(mapBefore.rows.length === 2 && listBefore.list === 2, {
      claimIds: ["COL-002"],
      what: "the forms did not start with rows in both collections",
      detail: () => JSON.stringify({ mapBefore, listBefore }),
    });

    // The difference, as declared.
    expectEqual(mapAfter.rows, mapBefore.rows, {
      claimIds: ["COL-002"],
      what: "a keyed collection named with `{}` in a patch lost rows",
    });

    expectEqual(listAfter.list, 0, {
      claimIds: ["COL-002"],
      what: "a list named with `[]` in a patch was not emptied, so the sentence means something new",
    });

    // The guard that makes the difference survivable: the destructive reading is the one that
    // speaks, and it names the collection and how much it took.
    expectClaim(aboutTheList.some((line) => line.includes('"list"') && line.includes("2 row")), {
      claimIds: ["COL-002", "SUB-001"],
      what: "emptying a list through a patch said nothing, or said nothing about which list and how many rows",
      detail: () => JSON.stringify(aboutTheList),
    });

    // And the control: the readings that take nothing say nothing.
    expectEqual([aboutTheMap.length, aboutNothing.length], [0, 0], {
      claimIds: ["COL-002"],
      what: "a patch that took no rows warned as though it had",
    });
  },
);
