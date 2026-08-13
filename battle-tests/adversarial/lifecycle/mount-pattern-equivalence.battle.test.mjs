/**
 * The same operations, six different views, one answer.
 *
 * What a renderer chooses to bind is a rendering decision. If the declared value, the validity, the
 * errors or the submitted payload move when a strategy changes, then what is on screen is deciding
 * what the data is — which is the failure this whole suite was built around.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectSameObservation } from "../../harness/assertions.mjs";
import { MOUNT_COMPARISON_FIELDS } from "../../harness/canonical-snapshot.mjs";
import { createMountStrategy, MOUNT_STRATEGIES, runUnderStrategy } from "../../harness/mount-strategy.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

/**
 * One log, hostile on purpose: a row edited then removed, a provisional key renamed to a server one,
 * a whole-collection write, and a cell written while the row it belongs to is not declared.
 */
const OPERATIONS = Object.freeze([
  { type: "record.upsert", path: "rows", key: "a", value: { code: "A1", note: "first" } },
  { type: "record.upsert", path: "rows", key: "tmp:1", value: { code: "", note: "draft" } },
  { type: "field.set", path: "rows.tmp:1.code", value: "B2" },
  { type: "field.touch", path: "rows.a.code" },
  { type: "record.remove", path: "rows", key: "a" },
  { type: "field.set", path: "rows.a.code", value: "ghost" },
  { type: "record.rename", path: "rows", from: "tmp:1", to: "947" },
  { type: "record.patch", path: "rows", value: { 947: { note: "renamed" } } },
  { type: "record.upsert", path: "rows", key: "b", value: { code: "", note: "" } },
  { type: "field.set", path: "rows.b.code", value: "C3" },
]);

battle(
  {
    claims: ["COL-003", "LIF-002", "SUB-001"],
    title: "declared state is the same under every mount strategy",
    environments: ["node"],
    requires: ["structural", "mountedPhases", "unmountedPhases", "observations"],
  },
  async (ctx) => {
    const results = new Map();

    for (const name of MOUNT_STRATEGIES) {
      const strategy = createMountStrategy(name, {
        collectionPath: "rows",
        cells: ["code", "note", "tax"],
        // A table that renders a row for a key the server has announced but nothing has declared.
        anticipatedKeys: ["a", "tmp:1", "947", "b", "never-declared"],
      });
      const { observation } = await runUnderStrategy({
        ctx,
        spec: KEYED_ROWS_SPEC,
        operations: OPERATIONS,
        strategy,
      });
      results.set(name, observation);
    }

    const baseline = results.get("none");

    for (const name of MOUNT_STRATEGIES.filter((each) => each !== "none")) {
      expectSameObservation(results.get(name), baseline, {
        claimIds: ["COL-003", "LIF-002", "SUB-001"],
        ignore: MOUNT_COMPARISON_FIELDS,
        what: `mount strategy "${name}" changed the declared state`,
      });
    }

    // The two fields excluded above are asserted here rather than dropped: mounting a cell whose row
    // does not exist is documented, warned about, and must stay that way.
    expectClaim(baseline.diagnostics.length === 0, {
      claimIds: ["COL-003"],
      what: "mounting nothing produces no diagnostic",
      detail: baseline.diagnostics.join(" | "),
    });
    expectClaim(
      results.get("early").diagnostics.some((line) => /before its row was declared/.test(line)),
      {
        claimIds: ["COL-006"],
        what: "claiming a cell before its row is declared says so",
        detail: results.get("early").diagnostics.join(" | "),
      },
    );

    // A strategy that never releases a control must not keep the removed row's paths registered.
    const retained = results.get("retained");
    expectClaim(!retained.fieldNames.some((path) => path.startsWith("rows.a.")), {
      claimIds: ["COL-001", "SUB-001"],
      what: "a control retained after its row was removed registers no field",
      detail: retained.fieldNames.join(", "),
    });
  },
);
