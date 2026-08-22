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
  version: 2,
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

    // The premise, asserted rather than assumed: declaring a row is an undoable change. Left as the
    // antecedent of an implication, an undo that silently stopped working would satisfy this battle
    // by doing nothing — the regression it exists to catch would read as a pass.
    expectClaim(undoDidSomething, {
      claimIds: ["PER-002"],
      what: "undo in the same task reverses the row that was just declared",
      detail: `value ${JSON.stringify(declared.value.of.rows.keys)} became ${JSON.stringify(afterUndo.value.of.rows.keys)}`,
    });

    expectClaim(offered, {
      claimIds: ["PER-002"],
      what: "canUndo offered the undo that the same task then performed",
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
    expectClaim(changedLater, {
      claimIds: ["PER-002"],
      what: "one tick later, undo still reverses the row that was declared",
      detail: `${JSON.stringify(before.value.of.rows.keys)} became ${JSON.stringify(after.value.of.rows.keys)}`,
    });

    expectClaim(offeredLater, {
      claimIds: ["PER-002"],
      what: "one tick later, canUndo still offers the undo that then performs",
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

    // Both halves stated positively. As an implication, a redo that resurrected the discarded row
    // would satisfy the battle by making the antecedent false — the stack-invalidation semantics
    // under attack would go unchecked in exactly the case that breaks them.
    expectClaim(redoDidNothing, {
      claimIds: ["PER-002"],
      what: "an edit after an undo invalidates the redo stack, so redo does nothing",
      detail: `keys ${JSON.stringify(beforeRedo.value.of.rows.keys)} became ${JSON.stringify(afterRedo.value.of.rows.keys)}`,
    });

    expectClaim(!redoOffered, {
      claimIds: ["PER-002"],
      what: "canRedo does not offer the redo that the invalidated stack cannot perform",
      detail: `canRedo=${redoOffered}, keys ${JSON.stringify(beforeRedo.value.of.rows.keys)} stayed ${JSON.stringify(afterRedo.value.of.rows.keys)}`,
    });
  },
);
