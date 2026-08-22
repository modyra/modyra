/**
 * Answers that arrive in the wrong order, or for a question nobody is asking any more.
 *
 * A server answers when it answers. The orders attacked here — the newest run first, the oldest last
 * and carrying an error, an answer for a row that was removed, for a field that was disabled, for a
 * form that was destroyed — are the ones that decide whether "last applicable run wins" is a
 * property or a coincidence of timing.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const SPEC = Object.freeze({
  version: 2,
  fields: Object.freeze({
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({
        code: Object.freeze({ kind: "text" }),
        tax: Object.freeze({ kind: "text", async: true }),
      }),
    }),
  }),
});

battle(
  {
    claims: ["VAL-001", "VAL-002", "COL-005", "LIF-001"],
    title: "a late answer never wins and a dead row never hears one",
    environments: ["node"],
    requires: ["structural", "observations", "asyncStarted"],
  },
  async (ctx) => {
    // ── The newest answer first, the oldest last and wrong ────────────────────
    const inversion = ctx.open(SPEC);
    const runsAt = (path) => inversion.asyncValidators.runs(path);

    await inversion.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "c", tax: "T1" } });
    await inversion.scheduler.flush();
    await inversion.execute({ type: "field.set", path: "rows.a.tax", value: "T2" });
    await inversion.scheduler.flush();

    expectClaim(runsAt("rows.a.tax").length === 2, {
      claimIds: ["VAL-001"],
      what: "editing an async cell starts a second run",
      detail: `${runsAt("rows.a.tax").length} run(s)`,
    });

    await inversion.execute({ type: "async.resolve", token: "rows.a.tax", ordinal: 2, result: [] });
    await inversion.execute({
      type: "async.resolve",
      token: "rows.a.tax",
      ordinal: 1,
      result: ["stale: tax code rejected"],
    });
    await inversion.scheduler.flush();

    const afterInversion = inversion.observe("oldest answered last, with an error");
    expectClaim(afterInversion.errors.length === 0, {
      claimIds: ["VAL-001"],
      what: "the superseded run's answer does not become the verdict",
      detail: JSON.stringify(afterInversion.errors),
    });
    expectClaim(!afterInversion.pending, {
      claimIds: ["VAL-001"],
      what: "the field settles once its applicable run has answered",
    });

    // ── An answer for a row that no longer exists ─────────────────────────────
    const removed = ctx.open(SPEC);
    await removed.execute({ type: "record.upsert", path: "rows", key: "z", value: { code: "c", tax: "T1" } });
    await removed.scheduler.flush();
    await removed.execute({ type: "record.remove", path: "rows", key: "z" });
    await removed.execute({
      type: "async.resolve",
      token: "rows.z.tax",
      ordinal: 1,
      result: ["ghost: rejected"],
    });
    await removed.scheduler.flush();

    const afterGhost = removed.observe("answer for a removed row");
    expectClaim(afterGhost.collections[0].keys.length === 0, {
      claimIds: ["COL-005"],
      what: "the answer does not resurrect the row",
      detail: afterGhost.collections[0].keys.join(","),
    });
    expectClaim(afterGhost.errors.length === 0 && !afterGhost.pending, {
      claimIds: ["COL-005", "VAL-001"],
      what: "the answer creates neither an error nor pending work",
      detail: `${JSON.stringify(afterGhost.errors)} pending=${afterGhost.pending}`,
    });

    // ── An answer for a field that was disabled while it ran ──────────────────
    const disabled = ctx.open(SPEC);
    await disabled.execute({ type: "record.upsert", path: "rows", key: "d", value: { code: "c", tax: "T1" } });
    await disabled.scheduler.flush();
    await disabled.execute({ type: "field.disable", path: "rows.d.tax" });
    await disabled.execute({
      type: "async.resolve",
      token: "rows.d.tax",
      ordinal: 1,
      result: ["rejected while disabled"],
    });
    await disabled.scheduler.flush();

    const afterDisable = disabled.observe("answer for a disabled field");
    expectClaim(afterDisable.disabledPaths.includes("rows.d.tax"), {
      claimIds: ["VAL-002"],
      what: "the field is disabled",
      detail: afterDisable.disabledPaths.join(","),
    });
    expectClaim(afterDisable.valid, {
      claimIds: ["VAL-002"],
      what: "a disabled field's verdict does not invalidate the form",
      detail: JSON.stringify(afterDisable.errors),
    });
    expectClaim(
      !JSON.stringify(afterDisable.submittedValue).includes("T1"),
      {
        claimIds: ["VAL-002"],
        what: "a disabled value is not submitted",
        detail: JSON.stringify(afterDisable.submittedValue),
      },
    );
    expectClaim(JSON.stringify(afterDisable.value).includes("T1"), {
      claimIds: ["VAL-002"],
      what: "a disabled value is retained in the edit state",
      detail: JSON.stringify(afterDisable.value),
    });

    // ── An answer for a form that was destroyed ───────────────────────────────
    const destroyed = ctx.open(SPEC);
    await destroyed.execute({ type: "record.upsert", path: "rows", key: "x", value: { code: "c", tax: "T1" } });
    await destroyed.scheduler.flush();
    await destroyed.execute({ type: "destroy" });
    await destroyed.execute({
      type: "async.resolve",
      token: "rows.x.tax",
      ordinal: 1,
      result: ["answer after teardown"],
    });
    await destroyed.execute({ type: "flush", ms: 1000 });

    expectClaim(destroyed.asyncValidators.survivors().length === 0, {
      claimIds: ["LIF-001"],
      what: "destroy aborts the runs it leaves behind",
      detail: JSON.stringify(destroyed.asyncValidators.survivors()),
    });
    expectClaim(ctx.diagnostics().every((line) => !/after destroy|destroyed scope/i.test(line)), {
      claimIds: ["LIF-001"],
      what: "an answer arriving after teardown says nothing at all",
      detail: ctx.diagnostics().join(" | "),
    });
  },
);
