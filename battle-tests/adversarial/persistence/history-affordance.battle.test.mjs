/**
 * The button and the operation must agree.
 *
 * `canUndo` exists so a consumer can offer undo exactly when undo does something: it is what an
 * Undo button is bound to. A window where `undo()` changes the value while `canUndo()` reads false
 * is a window where the capability exists and nobody can reach it — and structural changes are
 * promised to be undoable the moment they are made, which is precisely that window.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const SPEC = Object.freeze({
  version: 1,
  fields: Object.freeze({
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({ code: Object.freeze({ kind: "text" }) }),
    }),
  }),
});

battle(
  {
    claims: ["PER-002"],
    title: "canUndo answers for the change that was just made",
    environments: ["node"],
    requires: ["structural", "observations"],
  },
  async (ctx) => {
    const context = ctx.open(SPEC, { history: true });

    // A row is declared and undo is offered in the same task — a click handler that adds a line and
    // a toolbar that re-reads its own state. Nothing is awaited here on purpose: an await would let
    // the history effect run and close the window under attack.
    context.executeNow({ type: "record.upsert", path: "rows", key: "a", value: { code: "A1" } });

    const declared = context.observe("row declared, same task");
    const offered = context.form.canUndo();

    context.executeNow({ type: "undo" });
    const afterUndo = context.observe("undo in the same task");

    const undoDidSomething = JSON.stringify(afterUndo.value) !== JSON.stringify(declared.value);

    expectClaim(!undoDidSomething || offered, {
      claimIds: ["PER-002"],
      what: "undo changed the value while canUndo said there was nothing to undo",
      detail: `canUndo=${offered}, value ${JSON.stringify(declared.value.of.rows.keys)} became ${JSON.stringify(afterUndo.value.of.rows.keys)}`,
    });

    // The same question one tick later, where the history effect has run: the affordance and the
    // operation must still agree, so that the answer does not depend on when it is asked.
    const settled = ctx.open(SPEC, { history: true });
    await settled.execute({ type: "record.upsert", path: "rows", key: "b", value: { code: "B1" } });
    await settled.scheduler.flush();

    const before = settled.observe("row declared, next tick");
    const offeredLater = settled.form.canUndo();
    await settled.execute({ type: "undo" });
    await settled.scheduler.flush();
    const after = settled.observe("undo, next tick");

    const changedLater = JSON.stringify(after.value) !== JSON.stringify(before.value);
    expectClaim(!changedLater || offeredLater, {
      claimIds: ["PER-002"],
      what: "one tick later, canUndo still agrees with what undo does",
      detail: `canUndo=${offeredLater}`,
    });
  },
);

/**
 * The mirror: an edit made after an undo invalidates the redo stack, which is the semantics every
 * editor ships. A Redo button still lit after that edit offers an operation that will do nothing.
 */
battle(
  {
    claims: ["PER-002"],
    title: "canRedo answers for the edit that just invalidated the redo stack",
    environments: ["node"],
    requires: ["structural", "observations"],
  },
  async (ctx) => {
    const redo = ctx.open(SPEC, { history: true });
    await redo.execute({ type: "record.upsert", path: "rows", key: "r1", value: { code: "R1" } });
    await redo.scheduler.flush();
    await redo.execute({ type: "undo" });
    await redo.scheduler.flush();

    redo.executeNow({ type: "record.upsert", path: "rows", key: "r2", value: { code: "R2" } });
    const beforeRedo = redo.observe("edited after undo, same task");
    const redoOffered = redo.form.canRedo();
    redo.executeNow({ type: "redo" });
    const afterRedo = redo.observe("redo after that edit");

    const redoDidNothing = JSON.stringify(afterRedo.value) === JSON.stringify(beforeRedo.value);
    expectClaim(!redoDidNothing || !redoOffered, {
      claimIds: ["PER-002"],
      what: "canRedo said there was something to redo and redo did nothing",
      detail: `canRedo=${redoOffered}, keys ${JSON.stringify(beforeRedo.value.of.rows.keys)} stayed ${JSON.stringify(afterRedo.value.of.rows.keys)}`,
    });
  },
);
