/**
 * What undo does with a change that touched more than one row.
 *
 * A bulk write is one thing a person did: they pasted a table, imported a file, applied a template.
 * Undo is how they take one thing back. These are the two sentences the rest of this rests on, and
 * neither is stated in the contract — which is why the positional list and the keyed map answer
 * differently and nothing catches it.
 *
 * The list is the precedent and it is right: `array.setAll` writing three rows is one step, and one
 * undo returns the form to what it held. The keyed map charges a step per row. Undoing a three-row
 * write means pressing undo three times, and each press in between shows a table that never existed —
 * some rows updated, some not.
 *
 * Then the rows come back in the order they were removed, which is backwards. After enough presses
 * every row and every value is restored and the collection is in reverse order, so the state the
 * person was in is not on the path at all. It shares a cause with a rename sending its row to the end:
 * a row re-declared is a row appended.
 *
 * `form.setValue` is the same, plus a state nobody produced: its undo path passes through a row whose
 * text cell holds `null`, where a text cell holds `""` everywhere else.
 *
 * `record.patch` and `form.patch` are one step each, so this is not "bulk writes are hard" — it is two
 * methods on one handle disagreeing.
 *
 * Found by surveying past the first divergence: this class first appears around run 60 of the history
 * campaign, which stops at run 9 on another one.
 */

import { array, createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Three rows a person entered, in a keyed map. */
function keyedRows() {
  const form = createForm({ rows: record(group({ code: field("") })) }, { devWarnings: false, history: true });
  for (const key of ["a", "b", "c"]) form.f.rows.upsert(key, { code: "start" });
  return form;
}

/** Three rows a person entered, in a list. */
function listRows() {
  const form = createForm({ rows: array(group({ code: field("") })) }, { devWarnings: false, history: true });
  for (let index = 0; index < 3; index += 1) form.f.rows.push({ code: "start" });
  return form;
}

/** Undo until the form holds `target` again, or until there is nothing left to undo. */
function undoUntil(form, target, limit = 20) {
  const path = [];
  let steps = 0;
  while (form.canUndo() && steps < limit) {
    form.undo();
    steps += 1;
    const now = JSON.stringify(form.getValue());
    path.push(now);
    if (now === target) return { steps, path, returned: true };
  }
  return { steps, path, returned: false };
}

battle(
  {
    claims: ["PER-002", "COL-001"],
    title: "one bulk write is one thing to undo",
    environments: ["node"],
  },
  async (ctx) => {
    // The precedent, in the engine: a list writes three rows in one step.
    const list = listRows();
    const listBefore = JSON.stringify(list.getValue());
    list.f.rows.setAll([{ code: "x" }, { code: "y" }, { code: "z" }]);
    const listUndo = undoUntil(list, listBefore);
    ctx.log.note("a list written whole", { steps: listUndo.steps, returned: listUndo.returned });
    list.destroy();

    expectEqual([listUndo.steps, listUndo.returned], [1, true], {
      claimIds: ["PER-002"],
      what: "a list written whole did not come back in one undo, so there is no precedent to hold the map to",
    });

    // And the same handle's other bulk method, which is also one step.
    const patched = keyedRows();
    const patchedBefore = JSON.stringify(patched.getValue());
    patched.f.rows.patch({ a: { code: "x" }, b: { code: "y" }, c: { code: "z" } });
    const patchUndo = undoUntil(patched, patchedBefore);
    patched.destroy();

    expectEqual([patchUndo.steps, patchUndo.returned], [1, true], {
      claimIds: ["PER-002"],
      what: "patching three rows of a map did not come back in one undo either, so the two methods agree and this battle is about something else",
    });

    // The map, written whole.
    const keyed = keyedRows();
    const before = JSON.stringify(keyed.getValue());
    keyed.f.rows.setAll({ a: { code: "x" }, b: { code: "y" }, c: { code: "z" } });
    const undone = undoUntil(keyed, before);
    ctx.log.note("a map written whole", { steps: undone.steps, returned: undone.returned, path: undone.path });
    keyed.destroy();

    expectEqual(undone.steps, 1, {
      claimIds: ["PER-002", "COL-001"],
      what: `writing three rows of a map in one call took ${undone.steps} undo(s) to take back, so every press in between shows a table that never existed`,
      detail: JSON.stringify(undone.path),
    });
  },
);

battle(
  {
    claims: ["PER-002", "COL-004"],
    title: "undoing a bulk write returns the form to a state it was in",
    environments: ["node"],
  },
  async (ctx) => {
    // Clearing a map and taking it back. However many presses it costs, one of the states along the
    // way has to be the one the person was in — otherwise undo cannot reach it at all.
    const form = keyedRows();
    const before = JSON.stringify(form.getValue());
    form.f.rows.setAll({});
    const undone = undoUntil(form, before);
    ctx.log.note("clearing a map, and undoing it", { steps: undone.steps, returned: undone.returned, path: undone.path });

    const rowsAlongTheWay = undone.path.map((state) => Object.keys(JSON.parse(state).rows));
    const everyRowBack = rowsAlongTheWay.some((keys) => keys.length === 3);
    form.destroy();

    // The rows do all come back, which is what makes the failure precise: it is the order.
    expectClaim(everyRowBack, {
      claimIds: ["PER-002"],
      what: "undoing a cleared map never brought all three rows back, which is a larger failure than the one this battle is about",
      detail: JSON.stringify(rowsAlongTheWay),
    });

    expectClaim(undone.returned, {
      claimIds: ["PER-002", "COL-004"],
      what: "no state on the undo path is the one the person was in — every row and value returns, in reverse order",
      detail: JSON.stringify(rowsAlongTheWay),
    });
  },
);

battle(
  {
    claims: ["PER-002", "VAL-004"],
    title: "no state on an undo path is one the form could not have held",
    environments: ["node"],
  },
  async (ctx) => {
    // A text cell holds `""`. Anything on the undo path holding `null` there is a state the form never
    // produced and no validator ever saw, being shown to a person as something they had.
    const form = keyedRows();
    const before = JSON.stringify(form.getValue());
    form.setValue({ rows: { a: { code: "x" }, b: { code: "y" }, c: { code: "z" } } });
    const undone = undoUntil(form, before);

    const impossible = undone.path.filter((state) =>
      Object.values(JSON.parse(state).rows).some((row) => row.code === null),
    );
    ctx.log.note("states along the undo path", { steps: undone.steps, impossible });
    form.destroy();

    expectEqual(impossible, [], {
      claimIds: ["PER-002", "VAL-004"],
      what: "an undo step showed a text cell holding null, which is not a value the form can produce",
    });
  },
);
