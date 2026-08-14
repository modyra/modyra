/**
 * What a draft brings back when the form it describes has structure.
 *
 * `PER-001` promises a restore reconstructs the declared structure without resurrecting removed
 * rows, and it had only ever been attacked on a flat keyed collection. A draft is a snapshot of a
 * whole tree: rows inside rows, a row that left after the last save, and a branch that was closed
 * when the snapshot was taken.
 *
 * The closed branch is the case nothing had reached. A conditional section keeps its value while it
 * is inactive and contributes nothing to a submit — so a draft has to decide whether to carry that
 * retained value, and a restore has to put it back where the branch can find it again if the
 * condition reopens. Carrying it and losing it are both defensible; silently doing one while the
 * form is read as if it did the other is not.
 */

import { createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { buildSchema, CONDITIONAL_ROWS_SPEC, NESTED_ORDERS_SPEC } from "../../models/schemas.mjs";

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

/** The draft manager saves on its own debounce; this is longer than it and drives no clock. */
const saved = () => new Promise((resolve) => setTimeout(resolve, 700));
const restored = () => new Promise((resolve) => setTimeout(resolve, 50));

function openWithDraft(spec, storage, key) {
  return createForm(buildSchema(spec).schema, { draft: { key, storage }, devWarnings: false });
}

battle(
  {
    claims: ["PER-001", "COL-001", "COL-005"],
    title: "a draft of a nested form restores the tree it saved and not the rows that left",
    environments: ["node"],
  },
  async (ctx) => {
    const storage = memoryStorage();

    const first = openWithDraft(NESTED_ORDERS_SPEC, storage, "orders");
    first.f.orders.upsert("o1", {
      ref: "R1",
      lines: [
        { sku: "S1", allocations: [{ bin: "A", qty: "1" }] },
        { sku: "S2", allocations: [{ bin: "B", qty: "2" }, { bin: "C", qty: "3" }] },
      ],
    });
    first.f.orders.upsert("o2", { ref: "R2", lines: [] });
    await saved();

    // Both a keyed row and a positional one leave after that save, at two different depths.
    first.f.orders.remove("o2");
    first.f.orders.row("o1").lines.remove(0);
    await saved();

    const before = first.getValue();
    ctx.log.note("a nested draft written after two removals", { bytes: storage.written.get("orders")?.length ?? 0 });

    expectClaim((storage.written.get("orders")?.length ?? 0) > 0, {
      claimIds: ["PER-001"],
      what: "the draft was written at all",
      detail: `${storage.written.size} key(s) in storage`,
    });
    first.destroy();

    const second = openWithDraft(NESTED_ORDERS_SPEC, storage, "orders");
    await restored();
    const after = second.getValue();

    expectEqual(after, before, {
      claimIds: ["PER-001", "COL-001"],
      what: "the restored form differs from the one the draft was taken of",
    });

    // Stated on its own, because a comparison that matched two forms which had both lost the rows
    // would say nothing: the removals must have survived the round trip in the right direction.
    expectEqual([...second.f.orders.keys()], ["o1"], {
      claimIds: ["COL-005", "PER-001"],
      what: "a row removed before the save came back with the restore",
    });

    expectEqual(second.f.orders.row("o1").lines.length(), 1, {
      claimIds: ["COL-005", "PER-001"],
      what: "a line removed before the save came back with the restore",
    });

    // And the surviving line kept its own descendants rather than the removed one's.
    expectEqual(after.orders.o1.lines[0], { sku: "S2", allocations: [{ bin: "B", qty: "2" }, { bin: "C", qty: "3" }] }, {
      claimIds: ["PER-001", "COL-001"],
      what: "the restored line carries the allocations that belong to it",
    });

    second.destroy();
  },
);

battle(
  {
    claims: ["PER-001", "VAL-003"],
    title: "a draft taken while a branch was closed restores a form that behaves the same",
    environments: ["node"],
  },
  async (ctx) => {
    const storage = memoryStorage();

    const first = openWithDraft(CONDITIONAL_ROWS_SPEC, storage, "conditional");
    first.f.rows.upsert("a", { tier: "full" });
    first.f.rows.cell("a", "extras.reference").set("R1");
    // The branch closes with a value inside it: retained in edit state, absent from a submit.
    first.f.rows.cell("a", "tier").set("basic");
    await saved();

    const beforeSubmit = first.submitValue();
    const beforeValue = first.getValue();
    ctx.log.note("a draft taken with the branch closed over a filled cell", {});

    expectClaim(!("extras" in beforeSubmit.rows.a), {
      claimIds: ["VAL-003"],
      what: "the closed branch contributes nothing to the submit the draft was taken beside",
      detail: JSON.stringify(beforeSubmit.rows.a),
    });
    first.destroy();

    const second = openWithDraft(CONDITIONAL_ROWS_SPEC, storage, "conditional");
    await restored();

    expectEqual(second.getValue(), beforeValue, {
      claimIds: ["PER-001"],
      what: "the restored form holds something different from the one that was saved",
    });

    expectEqual(second.submitValue(), beforeSubmit, {
      claimIds: ["PER-001", "VAL-003"],
      what: "the restored form would submit something different",
    });

    // The branch has to still work after a restore, which is the half a value comparison cannot
    // see: reopening it must produce the same form as reopening it before the draft was taken.
    second.f.rows.cell("a", "tier").set("full");
    const reopened = second.submitValue().rows.a;

    expectClaim("extras" in reopened, {
      claimIds: ["VAL-003", "PER-001"],
      what: "reopening the branch after a restore brings its cells back",
      detail: JSON.stringify(reopened),
    });

    second.destroy();
  },
);
