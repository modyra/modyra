/**
 * A disabled cell stops being disabled when its row changes identity.
 *
 * `setDisabled` binds a cell out of the submitted payload while keeping its value in edit state.
 * The binding is row state, not a subscription to a spelling: it is made before a row exists and
 * takes effect when the row arrives. So a row that changes identity has to carry it, the way it
 * carries the cell's value and the cell's touched flag.
 *
 * Two ways it did not:
 *
 *   - a keyed row renamed from `a` to `b` arrived without it, and the cell the consumer had taken
 *     out of the payload was submitted again;
 *   - a positional row moved from 0 to 1 left it at index 0, where it suppressed whichever row
 *     moved into that position — a different row's value, silently absent.
 *
 * Both change what a submit carries, which is what makes them integrity findings rather than
 * ergonomics: the consumer disabled one cell and the server receives another shape entirely.
 *
 * Found by the keyed campaign once its comparison included the interaction state the generator had
 * been drawing all along.
 */

import { battle } from "../harness/battle.mjs";
import { expectClaim, expectEqual } from "../harness/assertions.mjs";
import { KEYED_ROWS_SPEC, POSITIONAL_ROWS_SPEC } from "../models/schemas.mjs";

battle(
  {
    claims: ["VAL-002", "COL-007"],
    title: "a renamed row carries the cell its consumer disabled",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const context = ctx.open(KEYED_ROWS_SPEC);

    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "A" } });
    await context.execute({ type: "field.touch", path: "rows.a.note" });
    await context.execute({ type: "field.disable", path: "rows.a.code" });

    const before = context.form.submitValue().rows.a;
    expectClaim(!("code" in before), {
      claimIds: ["VAL-002"],
      what: "the disabled cell is excluded before the rename",
      detail: JSON.stringify(before),
    });

    await context.execute({ type: "record.rename", path: "rows", from: "a", to: "b" });

    const after = context.form.submitValue().rows.b;

    // The row's other state is carried, which is what makes the omission a defect rather than a
    // policy: value and touched move with the row, and only the exclusion did not.
    expectClaim(context.form.getField("rows.b.note")?.().touched() === true, {
      claimIds: ["COL-007"],
      what: "the renamed row still carries its touched cell",
      detail: JSON.stringify(after),
    });

    expectEqual(after, before, {
      claimIds: ["VAL-002", "COL-007"],
      what: "the renamed row submits what the row submitted before it was renamed",
    });
  },
);

battle(
  {
    claims: ["VAL-002", "COL-002"],
    title: "a moved row keeps the exclusion, and the row left behind does not gain one",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const context = ctx.open(POSITIONAL_ROWS_SPEC);

    await context.execute({
      type: "array.setAll",
      path: "items",
      value: [{ code: "A" }, { code: "B" }],
    });
    await context.execute({ type: "field.disable", path: "items.0.code" });
    await context.execute({ type: "array.move", path: "items", from: 0, to: 1 });

    const submitted = context.form.submitValue().items;

    // The exclusion belongs to the row that was disabled, so it travels to index 1 with it.
    expectClaim(!("code" in submitted[1]), {
      claimIds: ["VAL-002"],
      what: "the moved row still excludes the cell its consumer disabled",
      detail: JSON.stringify(submitted),
    });

    // And the row that took its place is untouched: an exclusion that stayed behind at index 0
    // suppresses a value nobody disabled.
    expectEqual(submitted[0].code, "B", {
      claimIds: ["VAL-002", "COL-002"],
      what: "the row moved into index 0 submits its own value",
    });
  },
);
