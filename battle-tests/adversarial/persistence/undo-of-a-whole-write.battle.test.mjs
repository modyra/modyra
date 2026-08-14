/**
 * One action, three undos, and two states in between that never happened.
 *
 * `undo()` is documented as restoring the previous snapshot, and for an operation that ends one row
 * it does: three rows, remove the third, undo, and all three are back exactly as they were.
 *
 * An operation that ends several rows at once does not. After `reset` — and after a whole-value
 * write, which is the same shape — the rows come back one per undo, in reverse declaration order.
 * The first undo of a reset that cleared three rows leaves one. That is not the previous snapshot;
 * it is a collection the form was never in, and a consumer who submits there sends one row where
 * the user had three.
 *
 * The single-row control is in the same battle on purpose. Undo is not broken: what is broken is
 * undoing an operation that ended more than one row, and a fix that made the control red would be
 * trading one defect for another.
 */

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const SPEC = Object.freeze({
  version: 1,
  fields: Object.freeze({
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({ code: Object.freeze({ kind: "text" }) }),
    }),
  }),
});

/** Declare three rows and hand back the context holding them. */
async function threeRows(ctx) {
  const context = ctx.open(SPEC, { history: true });
  for (const key of ["a", "b", "c"]) {
    await context.execute({ type: "record.upsert", path: "rows", key, value: { code: key.toUpperCase() } });
  }
  return context;
}

battle(
  {
    claims: ["PER-002", "COL-001", "SUB-001"],
    title: "undoing an operation that ended several rows brings them all back at once",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    for (const emptying of [
      { type: "reset" },
      { type: "record.setAll", path: "rows", value: {} },
    ]) {
      const context = await threeRows(ctx);
      const before = [...context.collections.rows.keys()];

      await context.execute(emptying);
      const emptied = [...context.collections.rows.keys()];

      context.form.undo();
      const afterUndo = [...context.collections.rows.keys()];
      ctx.log.note("one operation ended three rows, then one undo", {
        operation: emptying.type,
        before,
        emptied,
        afterUndo,
      });

      // The control: the operation did what it says, so the undo below is about the restoring rather
      // than about an emptying that never happened.
      expectEqual(emptied, [], {
        claimIds: ["COL-001"],
        what: `${emptying.type} did not empty the collection`,
      });

      expectEqual(afterUndo, before, {
        claimIds: ["PER-002", "COL-001", "SUB-001"],
        what:
          `one undo of ${emptying.type} left ${JSON.stringify(afterUndo)} where the previous ` +
          `snapshot was ${JSON.stringify(before)} — a collection the form was never in`,
      });
    }
  },
);

battle(
  {
    claims: ["PER-002", "COL-001"],
    title: "undoing an operation that ended one row brings that row back",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    // The control on the battle above, and the reason this is about ending several rows rather than
    // about undo. Same schema, same history, same shape of operation — one row instead of three.
    const context = await threeRows(ctx);
    const before = [...context.collections.rows.keys()];

    await context.execute({ type: "record.remove", path: "rows", key: "c" });
    const afterRemove = [...context.collections.rows.keys()];

    context.form.undo();
    const afterUndo = [...context.collections.rows.keys()];
    ctx.log.note("one row removed, then one undo", { before, afterRemove, afterUndo });

    expectEqual(afterRemove, ["a", "b"], {
      claimIds: ["COL-001"],
      what: "removing one row did not leave the other two",
    });

    expectEqual(afterUndo, before, {
      claimIds: ["PER-002", "COL-001"],
      what: "one undo of a single removal did not restore the collection it was made from",
    });
  },
);
