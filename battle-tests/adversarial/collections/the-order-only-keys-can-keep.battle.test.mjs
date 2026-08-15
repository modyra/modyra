/**
 * The one place a record's order survives, and the place it cannot.
 *
 * The feature tour promises it in four words: `form.f.lines.keys()` gives *declared keys, in
 * declaration order*. That is a real promise and it is kept — including for the case that breaks it
 * everywhere else.
 *
 * A record's value is a plain object, and JavaScript orders an object's integer-like keys ascending
 * regardless of when they were inserted. So a record whose keys are `"10"`, `"2"`, `"1"` reports them
 * in that order from `keys()` and in `1, 2, 10` from `Object.keys(getValue().rows)` — and a server
 * receiving the JSON gets the second.
 *
 * That is not a defect: it is what a plain object is, and `COL-004` promises numeric keys stay keys
 * rather than becoming positions, which they do. It is a trap, because the two answers are both
 * correct and only one of them is the documented one. A consumer who iterates the value instead of
 * `keys()` gets a different order and nothing says so.
 *
 * Held here so the promise stays where it is: if `keys()` ever started agreeing with the object, the
 * documented order would be the one that was lost.
 */

import { createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 50));

const openRecord = () =>
  createForm({ rows: record(group({ c: field("") }), { initial: {} }) }, { devWarnings: false });

battle(
  {
    claims: ["COL-002", "COL-004"],
    title: "declaration order lives in keys(), and a record's value cannot carry it",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: with keys that are not numbers, both answers agree — which is why the trap is
    // invisible in every example anybody writes.
    const words = openRecord();
    for (const key of ["b", "a", "c"]) words.f.rows.upsert(key, { c: key });
    await settled();
    ctx.log.note("a record keyed by words", {
      keys: words.f.rows.keys(),
      value: Object.keys(words.getValue().rows),
    });

    expectEqual([[...words.f.rows.keys()], Object.keys(words.getValue().rows)], [["b", "a", "c"], ["b", "a", "c"]], {
      claimIds: ["COL-002"],
      what: "a record keyed by words did not keep declaration order in both places",
    });

    // What a row that leaves and comes back does, and what a rename does — both are order decisions
    // and neither is stated anywhere but here.
    words.f.rows.remove("a");
    await settled();
    expectEqual([...words.f.rows.keys()], ["b", "c"], {
      claimIds: ["COL-002"],
      what: "removing a row did not leave the others in the order they were declared",
    });

    words.f.rows.upsert("a", { c: "again" });
    await settled();
    expectEqual([...words.f.rows.keys()], ["b", "c", "a"], {
      claimIds: ["COL-002"],
      what: "a row declared again did not arrive at the end — a key that comes back is a new declaration",
    });

    words.f.rows.rename("b", "z");
    await settled();
    expectEqual([...words.f.rows.keys()], ["z", "c", "a"], {
      claimIds: ["COL-002"],
      what: "renaming a row moved it — a rename is a change of name, not of position",
    });
    words.destroy();

    // And the case that separates the two answers. Both are correct; only one is documented.
    const numbered = openRecord();
    for (const key of ["10", "2", "1"]) numbered.f.rows.upsert(key, { c: key });
    await settled();
    const declared = [...numbered.f.rows.keys()];
    const inTheValue = Object.keys(numbered.getValue().rows);
    ctx.log.note("a record keyed by numbers", { declared, inTheValue });

    expectEqual(declared, ["10", "2", "1"], {
      claimIds: ["COL-002"],
      what: "keys() lost declaration order for keys that look like numbers, which is the one promise made about order",
    });

    // The other half, asserted as it is rather than as it might be wished: a plain object cannot hold
    // this order, and the value is a plain object. Asserting the disagreement is what makes it
    // visible to whoever reads this next.
    expectEqual(inTheValue, ["1", "2", "10"], {
      claimIds: ["COL-004"],
      what: "the value's object no longer orders integer-like keys the way JavaScript does, so the trap this battle records has changed shape",
    });

    // And the promise `COL-004` does make: they are still keys, not positions.
    expectEqual(Array.isArray(numbered.getValue().rows), false, {
      claimIds: ["COL-004"],
      what: "a record keyed by numbers became a list",
    });
    numbered.destroy();
  },
);
