/**
 * What a control says about itself must survive the row arriving.
 *
 * A keyed collection lets a control bind before its row exists — that is the whole point of a cell
 * handle that is inert until the row is declared. A control that binds `disabled` in that window has
 * stated something about the field: the user may not edit it, and its value is not submitted. If the
 * statement is dropped when the row arrives, the payload carries a value the binder said it would
 * not, and nobody is told.
 *
 * The same window opens a second time, on the other side: a row removed and re-declared while its
 * control never moved.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const SPEC = Object.freeze({
  version: 1,
  fields: Object.freeze({
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({
        code: Object.freeze({ kind: "text" }),
        note: Object.freeze({ kind: "text" }),
      }),
    }),
  }),
});

battle(
  {
    claims: ["VAL-002", "COL-006"],
    title: "a disabled binding made before the row survives its declaration",
    environments: ["node"],
    requires: ["structural", "mountedPhases", "observations"],
  },
  async (ctx) => {
    const context = ctx.open(SPEC);

    // A control mounts on a row that does not exist yet, and states that the user may not edit it.
    await context.execute({ type: "mount", paths: ["rows.14.code"] });
    await context.execute({ type: "field.disable", path: "rows.14.code" });

    // The row arrives.
    await context.execute({
      type: "record.upsert",
      path: "rows",
      key: "14",
      value: { code: "typed", note: "n" },
    });

    const declared = context.observe("row declared under a waiting disabled binding");
    expectClaim(declared.disabledPaths.includes("rows.14.code"), {
      claimIds: ["VAL-002", "COL-006"],
      what: "the binding made before the row still holds after it",
      detail: declared.disabledPaths.join(",") || "nothing is disabled",
    });
    expectClaim(!JSON.stringify(declared.submittedValue).includes("typed"), {
      claimIds: ["VAL-002"],
      what: "a disabled cell's value is not submitted",
      detail: JSON.stringify(declared.submittedValue),
    });

    // The row is removed and comes back. The control never moved, and neither did what it said.
    await context.execute({ type: "record.remove", path: "rows", key: "14" });
    await context.execute({
      type: "record.upsert",
      path: "rows",
      key: "14",
      value: { code: "again", note: "n" },
    });

    const redeclared = context.observe("row re-declared under the same control");
    expectClaim(redeclared.disabledPaths.includes("rows.14.code"), {
      claimIds: ["VAL-002", "COL-006"],
      what: "the binding survives the row being removed and re-declared",
      detail: redeclared.disabledPaths.join(",") || "nothing is disabled",
    });

    // And it is releasable: a control that says the field is editable again is heard.
    await context.execute({ type: "field.enable", path: "rows.14.code" });
    const enabled = context.observe("binding released");
    expectClaim(!enabled.disabledPaths.includes("rows.14.code"), {
      claimIds: ["VAL-002"],
      what: "releasing the binding re-enables the field",
      detail: enabled.disabledPaths.join(","),
    });
    expectClaim(JSON.stringify(enabled.submittedValue).includes("again"), {
      claimIds: ["VAL-002"],
      what: "an enabled cell is submitted again",
      detail: JSON.stringify(enabled.submittedValue),
    });
  },
);
