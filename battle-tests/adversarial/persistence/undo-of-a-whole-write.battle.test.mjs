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
 * A restored draft is the third route to the same place, and the one a user meets without asking
 * for it: opening a form that had a draft leaves `canUndo` true, and one undo takes back one row of
 * the restore. Three rows restored are four undos, each landing on a form nobody ever had.
 *
 * The controls are in the same battle on purpose. Undo is not broken, and neither is writing many
 * rows at once: `form.patch` and `form.patchValue` change two rows and undo as one step, which is
 * the behaviour the collection handle's own whole-value write does not have. A fix that made either
 * control red would be trading one defect for another.
 */

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const SPEC = Object.freeze({
  version: 2,
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

/** Storage a battle owns, so nothing depends on an environment having one. */
function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

const saved = () => new Promise((resolve) => setTimeout(resolve, 60));

battle(
  {
    claims: ["PER-002", "PER-001", "COL-001"],
    title: "a restored draft is one step of history or none, not one per row",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const storage = memoryStorage();
    const draft = { key: "rows", storage, debounceMs: 5 };

    const filling = ctx.open(SPEC, { draft, history: true });
    for (const key of ["a", "b", "c"]) {
      await filling.execute({ type: "record.upsert", path: "rows", key, value: { code: key.toUpperCase() } });
    }
    await saved();
    const written = [...filling.collections.rows.keys()];
    filling.form.destroy();

    // The control: the draft holds what the user left, so what follows is about the restoring rather
    // than about a draft that never carried the rows.
    expectEqual(written, ["a", "b", "c"], {
      claimIds: ["PER-001"],
      what: "the form that wrote the draft did not hold the rows this battle is about",
    });

    const reopened = ctx.open(SPEC, { draft, history: true });
    await saved();
    const restored = [...reopened.collections.rows.keys()];

    expectEqual(restored, ["a", "b", "c"], {
      claimIds: ["PER-001"],
      what: "the draft did not come back",
    });

    // The whole value, not the keys: a restore undone a row at a time keeps every key and empties
    // one row's cells, so a check that counted keys would pass over exactly the defect.
    const restoredValue = JSON.stringify(reopened.form.getValue().rows);
    reopened.form.undo();
    const afterUndo = JSON.stringify(reopened.form.getValue().rows);
    ctx.log.note("one undo on a form that had just been restored", { restoredValue, afterUndo });

    // Either the restore was not a step the user can undo — they did nothing — or it was one step
    // and undoing it leaves the form as it opens without a draft. A row at a time is neither.
    const acceptable = afterUndo === restoredValue || afterUndo === "{}";
    expectEqual(acceptable, true, {
      claimIds: ["PER-002", "PER-001", "COL-001"],
      what:
        `one undo after a restore left ${afterUndo} — neither the restored form nor the empty one, ` +
        `so it is a form the user never had`,
    });
  },
);

battle(
  {
    claims: ["PER-002", "COL-001"],
    title: "a patch that writes two rows undoes as the one thing it was",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    // The precedent inside the same engine: a form-level write that touches two rows is one step of
    // history, and one undo returns both. Whatever groups these writes is what the collection
    // handle's whole-value write does not do.
    for (const [name, write] of [
      ["patch", (form) => form.patch({ rows: { a: { code: "A2" }, b: { code: "B2" } } })],
      ["patchValue", (form) => form.patchValue({ rows: { a: { code: "A3" }, b: { code: "B3" } } })],
    ]) {
      const context = ctx.open(SPEC, { history: true });
      for (const key of ["a", "b"]) {
        await context.execute({ type: "record.upsert", path: "rows", key, value: { code: key.toUpperCase() } });
      }
      const before = JSON.stringify(context.form.getValue().rows);

      write(context.form);
      const written = JSON.stringify(context.form.getValue().rows);

      context.form.undo();
      const afterUndo = JSON.stringify(context.form.getValue().rows);
      ctx.log.note("two rows written by one call, then one undo", { name, before, written, afterUndo });

      expectEqual(written !== before, true, {
        claimIds: ["COL-001"],
        what: `${name} changed nothing, so the undo below is not about undoing it`,
      });

      expectEqual(afterUndo, before, {
        claimIds: ["PER-002", "COL-001"],
        what: `one undo of a two-row ${name} left ${afterUndo}`,
      });
    }
  },
);
