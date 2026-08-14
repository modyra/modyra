/**
 * A validator that answers about a row that is no longer the row it was asked about.
 *
 * `async-temporal-inversion` attacks the order answers arrive in: newest first, oldest last, an
 * answer for a row that left, an answer for a form that was destroyed. What it does not attack is
 * the case where the path is still there and means something else — the row was renamed, or removed
 * and re-declared under the same key, or restored from a draft.
 *
 * That is the harder half, because every cheap check passes: the field exists, the path resolves,
 * the run was started against that very path. Only the identity behind it changed, and an answer
 * that lands anyway attaches a verdict about one row's data to another row's cell.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

/**
 * Edit a row's async cell and hand back the ordinal of the run that edit started.
 *
 * Declaring the row already starts one against the cell's initial value, so the run under attack is
 * the latest rather than the first, and its ordinal is what a resolve has to name.
 */
async function startRun(context, path, value) {
  await context.execute({ type: "field.set", path, value });
  await context.scheduler.flush();
  const runs = context.asyncValidators.runs(path);
  return { count: runs.length, ordinal: runs.length };
}

battle(
  {
    claims: ["VAL-001", "COL-007"],
    title: "an answer for a row that was renamed while it ran does not become a verdict elsewhere",
    environments: ["node"],
    requires: ["structural", "observations", "asyncStarted"],
  },
  async (ctx) => {
    const context = ctx.open(KEYED_ROWS_SPEC);

    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "c" } });
    await context.execute({ type: "record.upsert", path: "rows", key: "b", value: { code: "c" } });
    const started = await startRun(context, "rows.a.tax", "T1");

    expectClaim(started.count > 0, {
      claimIds: ["VAL-001"],
      what: "a run was in flight against the row about to be renamed",
      detail: `${started.count} run(s)`,
    });

    await context.execute({ type: "record.rename", path: "rows", from: "a", to: "z" });
    await context.scheduler.flush();

    // The answer arrives for the path the run was filed under, which no longer names that row.
    await context.execute({
      type: "async.resolve",
      token: "rows.a.tax",
      ordinal: started.ordinal,
      result: ["the tax code for the row that used to be a"],
    });
    await context.scheduler.flush();

    const after = context.observe("the renamed row, after its old run answered");

    // Wherever the verdict went, it may not have gone to a row that never asked. `b` was never
    // validated and must be untouched; the renamed row is the only one that could legitimately
    // carry it, and only if the contract says a rename keeps its run.
    const onNeighbour = after.errors.filter((error) => error.path.startsWith("rows.b."));
    expectClaim(onNeighbour.length === 0, {
      claimIds: ["VAL-001", "COL-007"],
      what: "a stale answer landed on a row that was never validated",
      detail: JSON.stringify(after.errors),
    });

    const onDeadPath = after.errors.filter((error) => error.path.startsWith("rows.a."));
    expectClaim(onDeadPath.length === 0, {
      claimIds: ["VAL-001"],
      what: "a verdict was recorded against a key the collection no longer has",
      detail: JSON.stringify(after.errors),
    });

    // Pending is expected here — the renamed row started a run of its own, and so did the untouched
    // neighbour when it was declared — so what matters is whether that pending is live or stranded.
    // Answering every run the form still names has to settle it; one it cannot name is the leak.
    const live = context.asyncValidators.activeRuns();
    expectClaim(live.length > 0, {
      claimIds: ["VAL-001"],
      what: "the form is waiting on runs it can still name",
      detail: JSON.stringify(live.map((run) => run.path)),
    });

    for (const path of new Set(live.map((run) => run.path))) {
      await context.execute({
        type: "async.resolve",
        token: path,
        ordinal: context.asyncValidators.runs(path).length,
        result: [],
      });
    }
    await context.scheduler.flush();

    expectClaim(!context.observe("after every live run answered").pending, {
      claimIds: ["VAL-001"],
      what: "the form stays pending after every run it can name has answered",
      detail: JSON.stringify(context.asyncValidators.activeRuns().map((run) => run.path)),
    });
  },
);

battle(
  {
    claims: ["VAL-001", "COL-005", "COL-001"],
    title: "a key re-used for a new row does not inherit the old row's verdict",
    environments: ["node"],
    requires: ["structural", "observations", "asyncStarted"],
  },
  async (ctx) => {
    const context = ctx.open(KEYED_ROWS_SPEC);

    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "c" } });
    const started = await startRun(context, "rows.a.tax", "T-old");

    expectClaim(started.count > 0, {
      claimIds: ["VAL-001"],
      what: "a run was in flight against the row about to be removed",
      detail: `${started.count} run(s)`,
    });

    // The row ends and the key is re-used for a different one. Every path is spelled the same and
    // nothing about it is the same row.
    await context.execute({ type: "record.remove", path: "rows", key: "a" });
    await context.scheduler.flush();
    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "different", tax: "T-new" } });
    await context.scheduler.flush();

    await context.execute({
      type: "async.resolve",
      token: "rows.a.tax",
      ordinal: started.ordinal,
      result: ["the old row's tax code was rejected"],
    });
    await context.scheduler.flush();

    const after = context.observe("the re-used key, after the old row's run answered");

    expectClaim(after.errors.length === 0, {
      claimIds: ["VAL-001", "COL-005"],
      what: "the new row inherited a verdict about the row that used to hold its key",
      detail: JSON.stringify(after.errors),
    });

    // The control: the new row is really there and really different, so the assertion above is
    // about an identity that changed rather than about a row that never came back.
    expectClaim(after.value.of.rows.of.a.of.code === "different", {
      claimIds: ["COL-001"],
      what: "the key was re-used by a row with its own data",
      detail: JSON.stringify(after.value.of.rows),
    });
  },
);

battle(
  {
    claims: ["VAL-001", "PER-002"],
    title: "undoing a removal does not bring the removed row's pending answer back with it",
    environments: ["node"],
    requires: ["structural", "observations", "asyncStarted"],
  },
  async (ctx) => {
    const context = ctx.open(KEYED_ROWS_SPEC, { history: true });

    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "c" } });
    await context.scheduler.flush();
    const started = await startRun(context, "rows.a.tax", "T1");

    await context.execute({ type: "record.remove", path: "rows", key: "a" });
    await context.scheduler.flush();
    await context.execute({ type: "undo" });
    await context.scheduler.flush();

    // The row is back. The run that was in flight when it left belongs to the state before the
    // undo, and an undo restores data rather than resuming work.
    await context.execute({
      type: "async.resolve",
      token: "rows.a.tax",
      ordinal: started.ordinal,
      result: ["answered for the row as it was before it was removed"],
    });
    await context.scheduler.flush();

    const after = context.observe("the restored row, after the pre-removal run answered");

    expectClaim(after.errors.length === 0, {
      claimIds: ["VAL-001", "PER-002"],
      what: "an undo inherited async work that belonged to the state it undid",
      detail: JSON.stringify(after.errors),
    });

    // As above: the restored row starts its own run, so pending is expected. What may not happen is
    // that it stays pending once that run is answered.
    const live = context.asyncValidators.runs("rows.a.tax");
    await context.execute({ type: "async.resolve", token: "rows.a.tax", ordinal: live.length, result: [] });
    await context.scheduler.flush();

    expectClaim(!context.observe("after the restored row's own run answered").pending, {
      claimIds: ["VAL-001"],
      what: "the restored row stays pending on a run nobody will answer",
    });
  },
);

battle(
  {
    claims: ["LIF-001", "VAL-001"],
    title: "a form destroyed while a run is in flight settles it rather than leaving it",
    environments: ["node"],
    requires: ["structural", "asyncStarted"],
  },
  async (ctx) => {
    const context = ctx.open(KEYED_ROWS_SPEC);

    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "c" } });
    const started = await startRun(context, "rows.a.tax", "T1");

    const before = context.asyncValidators.activeRuns().length;
    expectClaim(before > 0, {
      claimIds: ["VAL-001"],
      what: "a run was in flight when the form was destroyed",
      detail: `${before} active run(s)`,
    });

    await context.execute({ type: "destroy" });
    await context.scheduler.flush();

    // Nothing may still be in flight against a destroyed form: a run the engine never abandoned is
    // a callback waiting to fire into a form that is gone.
    expectClaim(context.asyncValidators.activeRuns().length === 0, {
      claimIds: ["LIF-001"],
      what: "a run survived the destruction of the form that started it",
      detail: `${context.asyncValidators.activeRuns().length} still active`,
    });

    // And answering it afterwards changes nothing and raises nothing.
    let raised = null;
    try {
      await context.execute({ type: "async.resolve", token: "rows.a.tax", ordinal: started.ordinal, result: ["too late"] });
      await context.scheduler.flush();
    } catch (error) {
      raised = error;
    }

    expectClaim(raised === null, {
      claimIds: ["LIF-001"],
      what: "answering a run after the form was destroyed raised",
      detail: raised?.message ?? "",
    });
  },
);
