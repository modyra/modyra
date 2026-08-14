/**
 * Renaming a row onto a key another row already has.
 *
 * The collection refuses: the move would replace a row nobody asked to remove, and silently losing
 * one is worse than not moving the other. The refusal is documented and warned about — and nothing
 * had ever checked either half, so both were free to drift.
 *
 * Two halves, because a refusal is only safe if it is complete. The collection must be exactly as it
 * was — both rows, both values, both keys in their declared order — and the consumer must be told,
 * or a rename that quietly did nothing looks like a rename that worked.
 *
 * The diagnostic is only emitted when dev warnings are on, which is why this battle leaves them at
 * their default. Measured with them off, the refusal is silent, and a battle that turned them off
 * to reduce noise would have pinned the wrong behaviour.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

battle(
  {
    claims: ["COL-001", "COL-007"],
    title: "a rename onto an occupied key changes nothing and says so",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const context = ctx.open(KEYED_ROWS_SPEC);

    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "A" } });
    await context.execute({ type: "record.upsert", path: "rows", key: "q", value: { code: "Q" } });
    await context.execute({ type: "field.touch", path: "rows.a.note" });
    await context.scheduler.flush();

    const before = context.observe("two rows, one about to be renamed onto the other");

    await context.execute({ type: "record.rename", path: "rows", from: "a", to: "q" });
    await context.scheduler.flush();

    const after = context.observe("after the refused rename");

    // Nothing partial: not a row moved and not removed, not a value copied across, not a key left
    // in the wrong order. The whole observation is compared rather than the keys alone, because a
    // half-applied rename is exactly the shape that keeps the key list intact.
    expectEqual(after.value, before.value, {
      claimIds: ["COL-001", "COL-007"],
      what: "the refused rename left the collection's value untouched",
    });

    expectEqual(after.collections, before.collections, {
      claimIds: ["COL-001"],
      what: "the refused rename left both rows in the order they were declared",
    });

    expectEqual(after.touchedPaths, before.touchedPaths, {
      claimIds: ["COL-007"],
      what: "the refused rename did not move the mark the row was carrying",
    });

    // And the consumer is told. A refusal nobody can see is a rename that appears to have worked.
    const said = ctx.diagnostics().filter((line) => line.includes("rename") && line.includes("rows"));
    expectClaim(said.length > 0, {
      claimIds: ["COL-007"],
      what: "the collection said why it refused the rename",
      detail: JSON.stringify(ctx.diagnostics()),
    });

    expectClaim(said.some((line) => line.includes("q")), {
      claimIds: ["COL-007"],
      what: "the diagnostic names the key that was already taken",
      detail: JSON.stringify(said),
    });
  },
);
