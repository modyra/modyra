/**
 * Two collections deep, with work in flight and an undo underneath it.
 *
 * A nested collection was made executable days ago; async validation and history were built when a
 * path could only cross one collection. The three together are where a verdict can land on a field
 * that has the same path as the one it was computed for and is not the same field: a subtree is
 * removed while a grandchild is validating, the removal is undone, and the answer arrives after the
 * subtree came back.
 *
 * `orders.o1.lines.l1.tax` is one string and, across that sequence, two different fields.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const SPEC = Object.freeze({
  version: 1,
  fields: Object.freeze({
    orders: Object.freeze({
      kind: "record",
      of: Object.freeze({
        ref: Object.freeze({ kind: "text" }),
        lines: Object.freeze({
          kind: "record",
          of: Object.freeze({
            sku: Object.freeze({ kind: "text" }),
            tax: Object.freeze({ kind: "text", async: true }),
          }),
        }),
      }),
    }),
  }),
});

const ORDER = Object.freeze({ ref: "R1", lines: { l1: { sku: "S1", tax: "T1" } } });

battle(
  {
    claims: ["COL-005", "VAL-001", "PER-002", "LIF-001"],
    title: "a verdict computed before an undo does not land on what the undo restored",
    environments: ["node"],
    requires: ["structural", "observations", "asyncStarted"],
  },
  async (ctx) => {
    const context = ctx.open(SPEC, { history: true, devWarnings: false });
    const { asyncValidators, scheduler } = context;
    const grandchild = "orders.o1.lines.l1.tax";

    await context.execute({ type: "record.upsert", path: "orders", key: "o1", value: ORDER });
    await scheduler.flush();

    const started = asyncValidators.runs(grandchild);
    expectClaim(started.length >= 1, {
      claimIds: ["VAL-001"],
      what: "declaring a nested row starts the grandchild's validation",
      detail: `${started.length} run(s)`,
    });

    // The subtree goes while its grandchild is still being checked.
    await context.execute({ type: "record.remove", path: "orders", key: "o1" });
    await scheduler.flush();
    const afterRemoval = context.observe("subtree removed with work in flight");
    expectClaim(afterRemoval.collections.every((each) => each.keys.length === 0), {
      claimIds: ["COL-005"],
      what: "removing the parent takes the whole subtree",
      detail: JSON.stringify(afterRemoval.collections.map((each) => each.keys)),
    });

    // The removal is undone. The path comes back; the field behind it is a new one.
    await context.execute({ type: "undo" });
    await scheduler.flush();
    const restored = context.observe("subtree restored by undo");
    expectClaim(restored.fieldNames.includes(grandchild), {
      claimIds: ["PER-002"],
      what: "undo restores the whole subtree",
      detail: restored.fieldNames.join(", "),
    });

    // Now the run that belonged to the *removed* field answers, with an error.
    const stale = asyncValidators.runs(grandchild)[0];
    expectClaim(stale !== undefined, {
      claimIds: ["VAL-001"],
      what: "the pre-removal run is still identifiable",
    });
    await context.execute({
      type: "async.resolve",
      token: grandchild,
      ordinal: 1,
      result: ["tax code rejected — for a field that no longer exists"],
    });
    await scheduler.flush();

    const afterStale = context.observe("pre-removal verdict arrives after the undo");
    expectClaim(afterStale.errors.length === 0, {
      claimIds: ["VAL-001", "COL-005"],
      what: "a verdict for the removed field does not attach to the restored one",
      detail: JSON.stringify(afterStale.errors),
    });

    // And the restored field's own run still decides.
    const live = asyncValidators.activeRuns(grandchild);
    expectClaim(live.length >= 1, {
      claimIds: ["VAL-001"],
      what: "the restored field is being validated on its own account",
      detail: `${live.length} live run(s)`,
    });
    const ordinal = asyncValidators.runs(grandchild).indexOf(live[live.length - 1]) + 1;
    await context.execute({
      type: "async.resolve",
      token: grandchild,
      ordinal,
      result: ["the restored field's own verdict"],
    });
    await scheduler.flush();

    const settled = context.observe("restored field's own verdict");
    expectClaim(
      settled.errors.some((error) => error.path === grandchild),
      {
        claimIds: ["VAL-001"],
        what: "the restored field's own answer is the one that lands",
        detail: JSON.stringify(settled.errors),
      },
    );
    expectClaim(!settled.pending, {
      claimIds: ["LIF-001"],
      what: "and the form settles",
    });
  },
);
