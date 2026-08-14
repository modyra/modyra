/**
 * A position computed from something that was not there.
 *
 * A positional collection is addressed by index, and an index is usually computed: from a route
 * parameter, a `data-` attribute, the result of a lookup. Each of those has a way of coming out
 * wrong that produces no number at all — `Number.parseInt` of a missing attribute is `NaN`, a lookup
 * that missed is `undefined`.
 *
 * The engine already knows what to do with a number that is not a position. `remove(-1)`,
 * `remove(99)` and `remove(Infinity)` change nothing, which is the whole answer: there is no row
 * there. What it does with a value that is not a number at all is remove the row at index 0.
 *
 *   remove(NaN)        ABC → BC
 *   remove(undefined)  ABC → BC
 *   remove(null)       ABC → BC
 *
 * So the one shape of mistake that produces no number — the parse that failed, the lookup that
 * missed — deletes the first row of the list rather than nothing, and the row's values go with it.
 * `insert` and `move` share the rule and put the row at the front instead, which is a wrong position
 * rather than a lost one.
 *
 * The assertion is the engine's own answer applied consistently: a value that cannot name a position
 * is treated the way `-1` already is.
 */

import { createForm, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";
import { buildSchema, POSITIONAL_ROWS_SPEC } from "../../models/schemas.mjs";

/** Values a computed index arrives as when the computation had nothing to work with. */
const NOT_POSITIONS = Object.freeze([
  ["NaN, from a parse that failed", Number.NaN],
  ["undefined, from a lookup that missed", undefined],
  ["null", null],
  ["an object", {}],
  ["an array", []],
  ["a string that is not a number", "x"],
]);

function threeRows() {
  const form = createForm(buildSchema(POSITIONAL_ROWS_SPEC).schema, {
    reactivity: vanillaReactivity(),
    devWarnings: false,
  });
  for (const code of ["A", "B", "C"]) form.f.items.push({ code, note: "" });
  return form;
}

const codes = (form) => form.getValue().items.map((row) => row.code).join("");

battle(
  {
    claims: ["COL-001", "COL-005"],
    title: "a value that cannot name a position does not name the first one",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, and the answer this battle asks for everywhere else: the engine already leaves
    // the collection alone for a number that is not a position.
    for (const [what, index] of [["before the start", -1], ["past the end", 99], ["Infinity", Number.POSITIVE_INFINITY]]) {
      const form = threeRows();
      form.f.items.remove(index);
      expectEqual(codes(form), "ABC", {
        claimIds: ["COL-001"],
        what: `remove(${what}) changed a collection that has no row there`,
      });
      form.destroy();
    }

    // And a position that is one is honoured, so a collection that never changes is not what makes
    // the assertions below pass.
    const working = threeRows();
    working.f.items.remove(1);
    expectEqual(codes(working), "AC", {
      claimIds: ["COL-001"],
      what: "remove did not remove the row it was given",
    });
    working.destroy();

    for (const [what, index] of NOT_POSITIONS) {
      const removing = threeRows();
      removing.f.items.remove(index);
      const afterRemove = codes(removing);
      ctx.log.note("remove given something that is not a position", { what, afterRemove });
      removing.destroy();

      // Losing a row is the one that cannot be taken back: the values went with it.
      expectEqual(afterRemove, "ABC", {
        claimIds: ["COL-001", "COL-005"],
        what: `remove(${what}) deleted a row, and the engine leaves the collection alone for -1`,
      });

      const inserting = threeRows();
      inserting.f.items.insert(index, { code: "X", note: "" });
      const afterInsert = codes(inserting);
      ctx.log.note("insert given something that is not a position", { what, afterInsert });
      inserting.destroy();

      // A row at the front instead of nowhere is a list the user did not build.
      expectEqual(afterInsert, "ABC", {
        claimIds: ["COL-001", "COL-005"],
        what: `insert(${what}) put a row at the front of the list`,
      });

      const moving = threeRows();
      moving.f.items.move(0, index);
      const afterMove = codes(moving);
      ctx.log.note("move given something that is not a position", { what, afterMove });
      moving.destroy();

      expectEqual(afterMove, "ABC", {
        claimIds: ["COL-001", "COL-005"],
        what: `move(0, ${what}) reordered the list`,
      });
    }
  },
);
