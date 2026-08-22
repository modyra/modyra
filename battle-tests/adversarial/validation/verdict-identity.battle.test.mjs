/**
 * A path is not an identity.
 *
 * `rows.a.tax` names a field. Remove the row and declare it again and the string is the same while
 * the field is not, and a verdict computed for the first one has no business landing on the second.
 * The sequences below close that window as tightly as a consumer can: the answer arrives in the same
 * task as the re-declaration, and the parent is renamed rather than removed.
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
    claims: ["COL-005", "VAL-001"],
    title: "a verdict for a removed row does not land on the row that replaces it",
    environments: ["node"],
    requires: ["structural", "observations", "asyncStarted"],
  },
  async (ctx) => {
    const context = ctx.open(SPEC, { devWarnings: false });
    const path = "rows.a.tax";

    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "C", tax: "T1" } });
    await context.scheduler.flush();

    // Remove and re-declare in one task, with the old answer arriving between the two — the
    // narrowest window a consumer can produce, and the one a real server hits.
    context.executeNow({ type: "record.remove", path: "rows", key: "a" });
    context.asyncValidators.resolveRun(path, 1, ["verdict for the row that was removed"]);
    context.executeNow({
      type: "record.upsert",
      path: "rows",
      key: "a",
      value: { code: "C2", tax: "T2" },
    });
    await context.scheduler.flush();

    const after = context.observe("removed, answered and re-declared in one task");
    expectClaim(after.errors.length === 0, {
      claimIds: ["COL-005", "VAL-001"],
      what: "the dead row's verdict does not attach to its replacement",
      detail: JSON.stringify(after.errors),
    });
    expectClaim(after.value.of.rows.of.a?.of.tax === "T2", {
      claimIds: ["COL-005"],
      what: "the replacement holds its own value",
      detail: JSON.stringify(after.value.of.rows.of.a),
    });
  },
);

battle(
  {
    claims: ["COL-007", "VAL-001"],
    title: "renaming a row while it is being validated moves the question, not a stale answer",
    environments: ["node"],
    requires: ["structural", "observations", "asyncStarted"],
  },
  async (ctx) => {
    const context = ctx.open(SPEC, { devWarnings: false });

    await context.execute({
      type: "record.upsert",
      path: "rows",
      key: "tmp:1",
      value: { code: "C", tax: "T1" },
    });
    await context.scheduler.flush();

    // Two renames before anything settles: a provisional key, a server id, then a correction.
    context.executeNow({ type: "record.rename", path: "rows", from: "tmp:1", to: "947" });
    context.executeNow({ type: "record.rename", path: "rows", from: "947", to: "948" });
    await context.scheduler.flush();

    const moved = context.observe("renamed twice with work in flight");
    expectClaim(moved.collections[0].keys.join(",") === "948", {
      claimIds: ["COL-007"],
      what: "the row ends under the last key it was given",
      detail: moved.collections[0].keys.join(","),
    });

    // The first key's run answers now, with an error. Nothing under that key exists any more.
    await context.execute({
      type: "async.resolve",
      token: "rows.tmp:1.tax",
      ordinal: 1,
      result: ["verdict addressed to a key nobody holds"],
    });
    await context.scheduler.flush();

    const afterStale = context.observe("the first key's verdict arrives");
    expectClaim(afterStale.errors.length === 0, {
      claimIds: ["COL-007", "VAL-001"],
      what: "a verdict for the key the row used to have does not land on the key it has",
      detail: JSON.stringify(afterStale.errors),
    });
    expectClaim(!afterStale.fieldNames.some((name) => name.startsWith("rows.tmp:1") || name.startsWith("rows.947")), {
      claimIds: ["COL-007"],
      what: "no field survives under either abandoned key",
      detail: afterStale.fieldNames.join(", "),
    });

    // The row under its final key is still being asked, and its own answer decides.
    const live = context.asyncValidators.activeRuns("rows.948.tax");
    expectClaim(live.length >= 1, {
      claimIds: ["VAL-001"],
      what: "the renamed row is validated under its new key",
      detail: `${live.length} live run(s)`,
    });
  },
);
