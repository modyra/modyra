/**
 * An exclusion bound to an index no row has reached yet, lost when an insertion renumbers.
 *
 * `setDisabled` takes a cell out of the submitted payload while keeping its value in edit state, and
 * the binding is row state rather than a subscription to a spelling — so it can be made before the
 * row exists and takes effect when the row arrives. `regressions/disabled-across-identity` pins the
 * two ways a row that already exists can move: renamed, and moved.
 *
 * This is the third shape, and each part of it is ordinary:
 *
 *   - a cell is excluded at `items.1.code` while the collection holds nothing;
 *   - one row arrives at index 0;
 *   - an insertion at index 0 renumbers it to index 1 — the index the exclusion names.
 *
 * The row that now sits at index 1 should submit without that cell. Both rows submit whole. The
 * consumer took one cell out of the payload, never put it back, and the server receives it.
 *
 * Found twice by the generative campaign at 4000 runs per property, from two unrelated seeds:
 *
 *   seed 20260814  run 2709  18 operations minimised to 5  report …-ffc128b7.json
 *   seed 11111     run 3921  23 operations minimised to 4  report …-478dee91.json
 *
 * The four-operation sequence below is the second, which is the smaller of the two. Two seeds
 * reaching one divergence — `of.disabled[0]`, expected present, actually absent — is what says these
 * are one defect rather than two that resemble each other.
 *
 * Both are past the depth continuous integration reaches: `battle:campaign` defaults to 400 and CI
 * runs that, where the whole generative tier is green in under a second. At 4000 it takes seven and
 * finds this.
 *
 * The operations are the campaign's, in its order, with only the cell names adapted to the shared
 * fixture. A first attempt at this file rebuilt them from a reading of the report instead — it
 * dropped the empty-collection binding, kept the shape I had in my head, and passed, which is a
 * regression test proving nothing in the one place that cannot afford it.
 */

import { battle } from "../harness/battle.mjs";
import { expectEqual } from "../harness/assertions.mjs";
import { POSITIONAL_ROWS_SPEC } from "../models/schemas.mjs";

battle(
  {
    claims: ["VAL-002", "COL-001", "COL-008"],
    title: "a cell excluded before its row arrives is still excluded once it does",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const context = ctx.open(POSITIONAL_ROWS_SPEC);

    // An enable on an index nothing has reached, which is what the campaign drew first and which
    // must not leave anything behind: the exclusion below is the only one the consumer asks for.
    await context.execute({ type: "field.enable", path: "items.0.code" });
    await context.execute({ type: "array.push", path: "items", value: { code: "", note: "A1" } });
    await context.execute({ type: "field.disable", path: "items.1.code" });
    await context.execute({ type: "array.insert", path: "items", index: 0, value: { code: "A1", note: "" } });

    const rows = context.form.getValue().items;
    const submitted = context.form.submitValue().items;
    ctx.log.note("what the form holds and what it would send", { rows, submitted });

    // The control: the sequence built two rows, so a failure below is the exclusion rather than a
    // collection that never reached index 1.
    expectEqual(rows.length, 2, {
      claimIds: ["COL-001"],
      what: "the sequence did not produce two rows, so it is not the one the campaign ran",
      detail: JSON.stringify(rows),
    });

    // The row now at index 1 is the one the exclusion names. Its cell must not be in the payload,
    // and no other row's may be missing — an exclusion that landed elsewhere would suppress a value
    // nobody disabled, which is the same failure from the other side.
    const missing = submitted.flatMap((row, index) => ("code" in row ? [] : [index]));
    ctx.log.note("which rows submit without their cell", { missing });

    expectEqual(missing, [1], {
      claimIds: ["VAL-002", "COL-001", "COL-008"],
      what: "the cell the consumer excluded is submitted, or the exclusion landed on a row nobody disabled",
      detail: JSON.stringify({ submitted, missing }),
    });
  },
);
