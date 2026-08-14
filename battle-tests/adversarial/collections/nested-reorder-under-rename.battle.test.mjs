/**
 * A reorder at the middle level while the identity above it changes.
 *
 * `orders` is keyed and `lines` and `allocations` are positional, so a row can change identity from
 * above and position from within, in the same sequence. Both are structural, both rebuild rows, and
 * each is rebuilding rows the other is also rebuilding.
 *
 * The failure this is aimed at is not a lost value but a *duplicated* one: a subtree replaced rather
 * than ended leaves its fields behind, and the level above carries them into whichever row it
 * rebuilds next, so a list appears in two rows at once. Nothing shallower can express it — it needs a
 * collection whose rows themselves contain a collection, which the suite's fixtures did not have.
 *
 * The whole battle runs twice, on vanilla and on `@modyra/vue`, and the two are compared. Vanilla's
 * tracking is global to the module, which is the accident that hides exactly this class of defect:
 * a manager that rebuilt in the wrong order can still read the right value there and not elsewhere.
 */

import { vueReactivity } from "@modyra/vue";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual, expectSameObservation } from "../../harness/assertions.mjs";
import { RENDERER_ONLY_FIELDS } from "../../harness/canonical-snapshot.mjs";
import { NESTED_ORDERS_SPEC } from "../../models/schemas.mjs";

const TWO_LINES = Object.freeze([
  Object.freeze({ sku: "S1", allocations: [{ bin: "A", qty: "1" }] }),
  Object.freeze({ sku: "S2", allocations: [{ bin: "B", qty: "2" }, { bin: "C", qty: "3" }] }),
]);

/**
 * Declare an order with two lines, reorder them, then rename the order that holds them.
 *
 * The move happens first and the rename second so the outer rebuild runs over a subtree that has
 * just been rebuilt itself — the ordering in which a stale field is most likely to survive.
 */
const REORDER_THEN_RENAME = Object.freeze([
  { type: "record.upsert", path: "orders", key: "o1", value: { ref: "R1", lines: [...TWO_LINES] } },
  { type: "array.move", path: "orders.o1.lines", from: 0, to: 1 },
  { type: "record.rename", path: "orders", from: "o1", to: "o2" },
]);

async function drive(context) {
  for (const operation of REORDER_THEN_RENAME) await context.execute(operation);
  await context.scheduler.flush();
  await new Promise((resolve) => setTimeout(resolve, 0));
  return context.observe("reordered, then renamed");
}

/**
 * The lines of one order, out of a canonical observation.
 *
 * The encoding keeps objects apart from arrays deliberately — an object becomes `{ $mdy, keys, of }`
 * and an array stays an array — so reading a nested value means alternating between the two.
 */
function linesIn(state, key) {
  const lines = state.value?.of?.orders?.of?.[key]?.of?.lines;
  return Array.isArray(lines) ? lines : null;
}

battle(
  {
    claims: ["COL-001", "COL-002", "COL-007", "SUB-002"],
    title: "a line keeps its own allocations when it moves and its order is renamed",
    environments: ["node"],
    requires: ["structural", "observations"],
  },
  async (ctx) => {
    const context = ctx.open(NESTED_ORDERS_SPEC);
    await drive(context);

    const submitted = context.form.submitValue().orders.o2;

    expectClaim(submitted !== undefined && context.form.submitValue().orders.o1 === undefined, {
      claimIds: ["COL-007"],
      what: "the order answers to its new key and not to its old one",
      detail: JSON.stringify(Object.keys(context.form.submitValue().orders)),
    });

    expectEqual(submitted.lines.length, 2, {
      claimIds: ["COL-001"],
      what: "the order still holds exactly the two lines it was declared with",
    });

    // The move swapped them, so the allocations must have travelled with their own line. A subtree
    // left behind by a replaced row shows up here as the wrong bins under the right sku.
    expectEqual(submitted.lines[0], { sku: "S2", allocations: [{ bin: "B", qty: "2" }, { bin: "C", qty: "3" }] }, {
      claimIds: ["COL-002", "SUB-002"],
      what: "the line moved into position 0 brought its own allocations",
    });

    expectEqual(submitted.lines[1], { sku: "S1", allocations: [{ bin: "A", qty: "1" }] }, {
      claimIds: ["COL-002", "SUB-002"],
      what: "the line moved into position 1 brought its own allocations",
    });

    // Duplication states itself: every bin in the order appears once. A list carried into a second
    // row satisfies both assertions above while saying "B" twice.
    const bins = submitted.lines.flatMap((line) => line.allocations.map((allocation) => allocation.bin));
    expectEqual([...bins].sort(), ["A", "B", "C"], {
      claimIds: ["COL-001"],
      what: "no allocation was carried into a row it does not belong to",
    });
  },
);

battle(
  {
    claims: ["COL-001", "COL-002", "COL-007", "SUB-002"],
    title: "two positional levels under a keyed one mean the same on vue's reactivity",
    environments: ["node"],
    requires: ["structural", "observations"],
  },
  async (ctx) => {
    const onVanilla = ctx.open(NESTED_ORDERS_SPEC);
    const onVue = ctx.open(NESTED_ORDERS_SPEC, { reactivity: vueReactivity() });

    const vanillaState = await drive(onVanilla);
    const vueState = await drive(onVue);

    // The control: a rebuild that emptied the order would make two empty forms agree.
    expectClaim(linesIn(vanillaState, "o2")?.length === 2, {
      claimIds: ["COL-001"],
      what: "the sequence left a two-line order behind to compare",
      detail: JSON.stringify(vanillaState.value.of.orders),
    });

    expectSameObservation(vueState, vanillaState, {
      claimIds: ["COL-001", "COL-002", "COL-007", "SUB-002"],
      ignore: [...RENDERER_ONLY_FIELDS],
      what: "the same nested reorder produced a different form on vue's reactivity",
    });
  },
);
