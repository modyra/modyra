/**
 * An exclusion made before its row existed, lost when the rows arrive and move.
 *
 * `setDisabled` takes a cell out of the submitted payload while keeping its value in edit state, and
 * the binding is row state rather than a subscription to a spelling — so it can be made before the
 * row exists and takes effect when the row arrives. `regressions/disabled-across-identity` pins the
 * two ways a row that already exists can move: renamed, and moved.
 *
 * This is the third shape, and none of its parts is unusual on its own:
 *
 *   - the exclusion is bound to `items.2.code` while the collection is still empty;
 *   - rows arrive by push and by insertion, which renumbers what is above them;
 *   - a later `enable` names `items.1.code` — a different cell, at an index the insertions moved.
 *
 * The consumer excluded one cell and re-enabled a different one, so exactly one cell should be
 * missing from the payload. None is. The cell the consumer took out is submitted again, which is the
 * same integrity failure as the two above, reached by a sequence neither performs.
 *
 * Found by the generative campaign at 4000 runs per property — run 2709, seed 563959424, minimised
 * from 18 operations to 5 in 30 attempts. The campaign's default is 400 and CI runs that, so this
 * sequence is past the depth continuous integration reaches. That is a fact about the depth rather
 * than about the property.
 *
 * Report: reports/failures/COL-001+COL-008+SUB-001+SUB-002-ffc128b7.json
 *
 * The five operations are the campaign's, in its order, with only the cell names adapted to the
 * shared fixture. A first attempt rebuilt them from a reading of the report instead — it dropped the
 * empty-collection binding and the neighbouring enable, and passed, which is a regression test
 * proving nothing in the one place that cannot afford it.
 */

import { battle } from "../harness/battle.mjs";
import { expectClaim, expectEqual } from "../harness/assertions.mjs";
import { POSITIONAL_ROWS_SPEC } from "../models/schemas.mjs";

battle(
  {
    claims: ["VAL-002", "COL-001", "COL-008"],
    title: "a cell stays excluded when rows are inserted below it",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    // The campaign's five operations, in its order, with only the cell names adapted to the shared
    // fixture. Reconstructing the sequence from a reading of it produced a test that passed and
    // proved nothing — the record is the evidence, not my account of it.
    const context = ctx.open(POSITIONAL_ROWS_SPEC);

    // Made before any row exists, which the contract allows: the binding is row state and takes
    // effect when the row arrives.
    await context.execute({ type: "field.disable", path: "items.2.code" });
    await context.execute({ type: "array.push", path: "items", value: { code: "", note: "u" } });
    await context.execute({ type: "array.insert", path: "items", index: 0, value: { code: "A1", note: "" } });
    await context.execute({ type: "field.enable", path: "items.1.code" });
    await context.execute({ type: "array.insert", path: "items", index: 1, value: { code: "849", note: "u" } });

    const rows = context.form.getValue().items;
    const submitted = context.form.submitValue().items;
    ctx.log.note("what the form holds and what it would send", { rows, submitted });

    // The control: the sequence built the rows it was meant to, so a failure below is the exclusion
    // rather than a sequence that never reached index 2.
    expectEqual(rows.length, 3, {
      claimIds: ["COL-001"],
      what: "the sequence did not produce three rows, so it is not the one the campaign ran",
      detail: JSON.stringify(rows),
    });

    // One cell was disabled and never enabled: `items.2.code` was bound before the rows arrived, and
    // the enable named `items.1.code`, a different cell. Exactly one cell must be missing from the
    // payload, and it must be the one whose row now sits where index 2's row was carried to.
    const missing = submitted.flatMap((row, index) => ("code" in row ? [] : [index]));
    ctx.log.note("which rows are missing a cell", { missing });

    expectEqual(missing.length, 1, {
      claimIds: ["VAL-002", "COL-001", "COL-008"],
      what: "the number of cells excluded from the payload is not the one the consumer asked for",
      detail: JSON.stringify({ submitted, missing }),
    });
  },
);
