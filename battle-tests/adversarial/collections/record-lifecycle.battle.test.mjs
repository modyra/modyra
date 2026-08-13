/**
 * The full life of a keyed row, attacked at every seam.
 *
 * A control binds before the row exists, the row arrives, the view moves away, the key is renamed to
 * the one the server chose, a validator is still running when the row is removed, and its answer
 * arrives afterwards. Each of those is ordinary in a table and rare in a unit test, and the claims
 * they cross are the ones a keyed collection is built on.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectSameObservation } from "../../harness/assertions.mjs";
import { RENDERER_ONLY_FIELDS } from "../../harness/canonical-snapshot.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

battle(
  {
    claims: ["COL-001", "COL-003", "COL-005", "COL-006", "COL-007", "LIF-001"],
    title: "a row survives its renderer and a stale validator survives nothing",
    environments: ["node"],
    requires: ["structural", "mountedPhases", "unmountedPhases", "observations", "asyncStarted"],
  },
  async (ctx) => {
    const context = ctx.open(KEYED_ROWS_SPEC);
    const rows = context.collections.rows;
    const { asyncValidators, scheduler } = context;

    // 1–2. Handles are taken before anything is declared, as a template does.
    const provisionalCode = rows.cell("tmp:1", "code");
    const provisionalTax = rows.cell("tmp:1", "tax");

    // 3–4. Only one cell of the undeclared row is mounted. Nothing may follow from that.
    await context.execute({ type: "mount", paths: ["rows.tmp:1.code"] });
    const undeclared = context.observe("cell mounted, row undeclared");
    expectClaim(undeclared.collections[0].keys.length === 0, {
      claimIds: ["COL-001"],
      what: "a mounted cell declares no row",
    });
    expectClaim(!JSON.stringify(undeclared.submittedValue).includes("tmp:1"), {
      claimIds: ["COL-001"],
      what: "an undeclared row contributes no submitted path",
    });

    // 5–6. The row arrives and its async cell is validated.
    await context.execute({
      type: "record.upsert",
      path: "rows",
      key: "tmp:1",
      value: { code: "A1", note: "provisional", tax: "T-1" },
    });
    await scheduler.flush();

    expectClaim(rows.cell("tmp:1", "code") === provisionalCode, {
      claimIds: ["COL-006"],
      what: "the handle taken before declaration is the one the row arrives on",
    });
    expectClaim(asyncValidators.runs("rows.tmp:1.tax").length === 1, {
      claimIds: ["VAL-001"],
      what: "declaring a row starts its async validation",
      detail: `${asyncValidators.runs("rows.tmp:1.tax").length} run(s)`,
    });

    await context.execute({ type: "async.resolve", token: "rows.tmp:1.tax", ordinal: 1, result: [] });
    const settled = context.observe("row declared and validated");
    expectClaim(settled.valid, {
      claimIds: ["COL-003"],
      what: "a declared row with a filled required cell and a clean validator is valid",
      detail: JSON.stringify(settled.errors),
    });

    // 7–8. Every control leaves. The declared state may not move.
    await context.execute({ type: "unmount", paths: ["rows.tmp:1.code"] });
    const unmounted = context.observe("nothing mounted");
    expectSameObservation(unmounted, settled, {
      claimIds: ["COL-003"],
      ignore: RENDERER_ONLY_FIELDS,
      what: "unmounting every control changed the declared state",
    });

    // 9. A different column mounts — a table scrolled sideways.
    await context.execute({ type: "mount", paths: ["rows.tmp:1.note"] });

    // 10. The server answers with the real key.
    await context.execute({ type: "record.rename", path: "rows", from: "tmp:1", to: "947" });
    const renamed = context.observe("renamed to the server key");

    expectClaim(renamed.collections[0].keys.join(",") === "947", {
      claimIds: ["COL-007"],
      what: "the collection declares the new key and only it",
      detail: renamed.collections[0].keys.join(","),
    });
    expectClaim(renamed.value.of.rows.of["947"] !== undefined, {
      claimIds: ["COL-007"],
      what: "rename carries the row value to the new key",
    });
    expectClaim(renamed.valid === settled.valid, {
      claimIds: ["COL-007"],
      what: "rename carries validity",
      detail: `${settled.valid} became ${renamed.valid}`,
    });

    // 11–13. A validation is in flight when the row is removed, and answers afterwards.
    await context.execute({ type: "field.set", path: "rows.947.tax", value: "T-2" });
    await scheduler.flush();
    const inFlight = asyncValidators.activeRuns("rows.947.tax");
    expectClaim(inFlight.length === 1, {
      claimIds: ["VAL-001"],
      what: "editing the async cell starts exactly one live run",
      detail: `${inFlight.length} live run(s)`,
    });

    await context.execute({ type: "record.remove", path: "rows", key: "947" });
    const staleOrdinal = asyncValidators.runs("rows.947.tax").indexOf(inFlight[0]) + 1;
    await context.execute({
      type: "async.resolve",
      token: "rows.947.tax",
      ordinal: staleOrdinal,
      result: ["tax code rejected"],
    });
    await scheduler.flush();

    // 14. Nothing of the removed row may survive its own validator's answer.
    const afterStale = context.observe("stale answer for a removed row");
    expectClaim(afterStale.collections[0].keys.length === 0, {
      claimIds: ["COL-005"],
      what: "a stale answer does not resurrect the row",
      detail: afterStale.collections[0].keys.join(","),
    });
    expectClaim(afterStale.errors.length === 0, {
      claimIds: ["COL-005"],
      what: "a stale answer creates no error path",
      detail: JSON.stringify(afterStale.errors),
    });
    expectClaim(!afterStale.fieldNames.some((path) => path.startsWith("rows.947")), {
      claimIds: ["COL-005"],
      what: "no field of the removed row survives",
      detail: afterStale.fieldNames.join(", "),
    });
    expectClaim(!afterStale.pending, {
      claimIds: ["COL-005", "LIF-001"],
      what: "the form settles after the removed row's validator answers",
    });

    // 15–16. The same key comes back. It comes back clean.
    await context.execute({
      type: "record.upsert",
      path: "rows",
      key: "947",
      value: { code: "A1", note: "restored", tax: "T-3" },
    });
    await scheduler.flush();
    const restored = context.observe("key re-declared");

    expectClaim(restored.touchedPaths.length === 0 && restored.dirtyPaths.length === 0, {
      claimIds: ["COL-001"],
      what: "a re-declared row arrives untouched and clean",
      detail: `${restored.touchedPaths.join(",")} | ${restored.dirtyPaths.join(",")}`,
    });
    expectClaim(restored.errors.length === 0, {
      claimIds: ["COL-005"],
      what: "the dead row's verdict does not attach to its successor",
      detail: JSON.stringify(restored.errors),
    });

    // 17. Teardown, then work that was scheduled before it.
    await context.execute({ type: "destroy" });
    await context.execute({ type: "flush", ms: 5000 });

    expectClaim(asyncValidators.survivors().length === 0, {
      claimIds: ["LIF-001"],
      what: "destroy leaves no live validator run",
      detail: JSON.stringify(asyncValidators.survivors()),
    });
    expectClaim(provisionalTax !== undefined && rows.cell("947", "tax") !== undefined, {
      claimIds: ["COL-006"],
      what: "cell handles remain answerable after teardown",
    });
  },
);
