/**
 * Four ways to declare a row, one row.
 *
 * A keyed collection is declared as a template plus the keys that exist: `record(group({…}))` says
 * what a row is, and each cell of that template says what it starts as. A consumer declares a row
 * with `upsert(key)`, with `upsert(key, {})`, through `patch` or through `setAll`, and the row that
 * arrives should be the same row — the template's.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const SPEC = Object.freeze({
  version: 2,
  fields: Object.freeze({
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({
        code: Object.freeze({ kind: "text" }),
        note: Object.freeze({ kind: "text", initial: "unset" }),
      }),
    }),
  }),
});

battle(
  {
    claims: ["COL-008", "SUB-001"],
    title: "a row declared without a value is the template's row",
    environments: ["node"],
    requires: ["structural", "observations"],
  },
  async (ctx) => {
    const context = ctx.open(SPEC);

    // The four public ways to bring a row into existence without stating its contents.
    await context.execute({ type: "record.upsert", path: "rows", key: "valueless" });
    await context.execute({ type: "record.upsert", path: "rows", key: "empty", value: {} });
    await context.execute({ type: "record.patch", path: "rows", value: { patched: {} } });
    await context.execute({ type: "record.setAll", path: "rows", value: { via_set_all: {} } });

    const declared = context.observe("rows declared without contents");
    const rows = declared.value.of.rows.of;

    expectClaim(rows.via_set_all !== undefined, {
      claimIds: ["COL-008"],
      what: "setAll declared its row",
      detail: declared.collections[0].keys.join(","),
    });

    // `setAll` removes what it does not name, so the earlier three are re-declared beside it.
    await context.execute({
      type: "record.setAll",
      path: "rows",
      value: { valueless: undefined, empty: {}, patched: {} },
    });
    const together = context.observe("all four ways, side by side");
    const all = together.value.of.rows.of;

    const template = all.empty;
    expectEqual(all.patched, template, {
      claimIds: ["COL-008"],
      what: "a row declared by patch is the template's row",
    });
    expectEqual(all.valueless, template, {
      claimIds: ["COL-008"],
      what: "a row declared with no value is the template's row",
    });

    expectClaim(!JSON.stringify(together.submittedValue).includes("null"), {
      claimIds: ["COL-008", "SUB-001"],
      what: "no declared row submits a null the schema never declared",
      detail: JSON.stringify(together.submittedValue),
    });
  },
);
