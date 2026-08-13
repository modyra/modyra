/**
 * A row exists because it was declared — not because something rendered it.
 *
 * The attack takes the one order a renderer produces constantly and a unit test rarely does: a
 * control claims a cell of a row that does not exist yet, the row arrives later, the control leaves
 * while the row stays, and the row leaves while the control's handle is still held.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectSameObservation } from "../../harness/assertions.mjs";
import { RENDERER_ONLY_FIELDS } from "../../harness/canonical-snapshot.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

battle(
  {
    claims: ["COL-001", "COL-003", "COL-006", "LIF-001"],
    title: "a claimed cell neither creates its row nor loses it",
    environments: ["node"],
    requires: ["structural", "mountedPhases", "unmountedPhases", "observations"],
  },
  async (ctx) => {
    const context = ctx.open(KEYED_ROWS_SPEC);
    const rows = context.collections.rows;

    // The handle a control binds to exists before the row does, and stays the same object
    // throughout — a control that had to re-bind on every structural change would re-claim too.
    const waiting = rows.cell("a", "code");

    await context.execute({ type: "mount", paths: ["rows.a.code"] });

    const beforeDeclaration = context.observe("cell claimed, row undeclared");
    expectClaim(!rows.has("a"), {
      claimIds: ["COL-001"],
      what: "claiming a cell does not declare its row",
    });
    expectClaim(!beforeDeclaration.fieldNames.includes("rows.a.code"), {
      claimIds: ["COL-001"],
      what: "an undeclared row registers no field",
      detail: beforeDeclaration.fieldNames.join(", "),
    });
    expectClaim(beforeDeclaration.collections[0].keys.length === 0, {
      claimIds: ["COL-001"],
      what: "the collection declares no key",
    });

    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "", note: "n" } });

    expectClaim(rows.cell("a", "code") === waiting, {
      claimIds: ["COL-006"],
      what: "the cell handle held before declaration is the one the row arrives on",
    });
    expectClaim(rows.has("a") && !rows.validOf("a"), {
      claimIds: ["COL-001", "COL-003"],
      what: "the declared row exists and its required cell is invalid",
    });

    await context.execute({ type: "field.set", path: "rows.a.code", value: "X1" });

    const mountedAndValid = context.observe("row declared, cell mounted");
    expectClaim(mountedAndValid.valid, {
      claimIds: ["COL-003"],
      what: "a row whose required cell is filled is valid",
    });

    // Unmounting is a rendering decision. Nothing about the declared data may follow it.
    await context.execute({ type: "unmount", paths: ["rows.a.code"] });

    const unmounted = context.observe("row declared, nothing mounted");
    expectSameObservation(unmounted, mountedAndValid, {
      claimIds: ["COL-003"],
      ignore: RENDERER_ONLY_FIELDS,
      what: "unmounting the only cell changed the declared state",
    });

    await context.execute({ type: "record.remove", path: "rows", key: "a" });

    const removed = context.observe("row removed");
    expectClaim(!removed.fieldNames.includes("rows.a.code"), {
      claimIds: ["COL-001"],
      what: "removing the row removes its fields",
      detail: removed.fieldNames.join(", "),
    });
    expectClaim(rows.cell("a", "code") === waiting, {
      claimIds: ["COL-006"],
      what: "the cell handle survives removal and waits again",
    });
    expectClaim(removed.collections[0].keys.length === 0, {
      claimIds: ["COL-001"],
      what: "no key survives the removal",
    });

    // Teardown: work scheduled before destroy must not run afterwards.
    await context.execute({ type: "destroy" });
    await context.execute({ type: "flush", ms: 1000 });

    expectClaim(context.form.destroyed, {
      claimIds: ["LIF-001"],
      what: "the form reports itself destroyed",
    });
    expectClaim(context.asyncValidators.survivors().length === 0, {
      claimIds: ["LIF-001"],
      what: "no async validator run survives destroy",
      detail: JSON.stringify(context.asyncValidators.survivors()),
    });
  },
);
