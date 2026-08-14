/**
 * One operation log, five published reactivity implementations, compared against vanilla.
 *
 * `vanilla-vs-vue` established that a second runtime can be compared at all. This is the general
 * case, and it is the suite's largest gap closed: every collection, validation and submission claim
 * was proven on the vanilla graph alone — one implementation out of the set, and the one whose
 * tracking is global to the module, so the most forgiving of them.
 *
 * What is compared is what a consumer sees, not how a runtime schedules. The two differ legitimately
 * in when effects run, which is why every context is settled before anything is read; they may not
 * differ in what the form holds, what it will submit, which rows it has, what is invalid, or which
 * cells carry a mark.
 *
 * Angular is absent for a build reason rather than a semantic one: its reactivity is produced by
 * `build:angular`, and `npm run battle` runs `build:packages`. Adding it would make the suite's own
 * build a different one.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectSameObservation } from "../../harness/assertions.mjs";
import { RENDERER_ONLY_FIELDS } from "../../harness/canonical-snapshot.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

/** Every runtime a consumer can hand `createForm`, loaded through its own package entry point. */
const RUNTIMES = Object.freeze([
  ["vue", async () => (await import("@modyra/vue")).vueReactivity()],
  ["react", async () => (await import("@modyra/react")).reactReactivity()],
  ["preact", async () => (await import("@modyra/preact")).preactReactivity()],
  ["svelte", async () => (await import("@modyra/svelte")).svelteReactivity()],
  ["lit", async () => (await import("@modyra/lit")).litReactivity()],
]);

/**
 * Solid is attacked on its own, in `adversarial/reactivity/solid-collection-rows`.
 *
 * It cannot reach this comparison: under the export condition its own suite uses it raises while
 * declaring a two-cell row, and without that condition it resolves to a build whose computations do
 * not run — where it diverges here by starting no async work at all. Neither state is a comparison,
 * and folding it in under the lenient condition would report agreement about a runtime that was not
 * doing anything.
 */

const SEQUENCE = Object.freeze([
  { type: "record.upsert", path: "rows", key: "a", value: { code: "A", note: "first" } },
  { type: "record.upsert", path: "rows", key: "b", value: { code: "", note: "second" } },
  { type: "mount", paths: ["rows.a.code", "rows.b.code"] },
  { type: "field.set", path: "rows.a.code", value: "edited" },
  { type: "field.touch", path: "rows.b.code" },
  { type: "field.dirty", path: "rows.b.note" },
  { type: "record.upsert", path: "rows", key: "c" },
  // Disabled on a row that outlives the sequence: an exclusion made on the row that is removed
  // leaves nothing to compare, and the control below is what caught that.
  { type: "field.disable", path: "rows.c.note" },
  { type: "record.rename", path: "rows", from: "b", to: "d" },
  { type: "unmount", paths: ["rows.b.code"] },
  { type: "record.remove", path: "rows", key: "a" },
  { type: "record.patch", path: "rows", value: { d: { code: "D1" } } },
]);

async function drive(context) {
  for (const operation of SEQUENCE) await context.execute(operation);
  await context.scheduler.flush();
  // Each runtime settles on its own schedule and is allowed to; a macrotask lets all of them finish
  // so a difference in when cannot be mistaken for a difference in what.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return context.observe("after the sequence");
}

battle(
  {
    claims: ["COL-001", "COL-003", "COL-007", "VAL-002", "SUB-001", "SUB-002"],
    title: "a form means the same thing on vue, react, preact, svelte and lit",
    environments: ["node"],
    requires: ["structural", "mountedPhases", "unmountedPhases", "observations"],
  },
  async (ctx) => {
    const baseline = await drive(ctx.open(KEYED_ROWS_SPEC));

    // The control, once, against the baseline: a sequence that left nothing behind would make every
    // runtime agree about an empty form.
    expectClaim(baseline.collections[0].keys.length > 0, {
      claimIds: ["COL-001"],
      what: "the sequence left rows to compare",
      detail: JSON.stringify(baseline.collections[0].keys),
    });

    expectClaim(baseline.disabledPaths.length > 0 && baseline.touchedPaths.length > 0, {
      claimIds: ["VAL-002"],
      what: "the sequence left interaction state to compare",
      detail: `disabled ${JSON.stringify(baseline.disabledPaths)}, touched ${JSON.stringify(baseline.touchedPaths)}`,
    });

    for (const [name, load] of RUNTIMES) {
      const reactivity = await load();
      ctx.log.note("the same sequence on another runtime", { runtime: name, kind: reactivity.kind });

      // The runtime has to be the one it says it is. A package whose export quietly fell back to
      // vanilla would agree with the baseline perfectly and prove nothing about itself.
      expectClaim(reactivity.kind === name, {
        claimIds: ["COL-001"],
        what: `@modyra/${name} supplied a runtime of its own kind`,
        detail: `kind=${reactivity.kind}`,
      });

      const state = await drive(ctx.open(KEYED_ROWS_SPEC, { reactivity }));
      expectSameObservation(state, baseline, {
        claimIds: ["COL-001", "COL-003", "COL-007", "VAL-002", "SUB-001", "SUB-002"],
        ignore: [...RENDERER_ONLY_FIELDS],
        what: `the same operations on ${name}'s reactivity produced a different form`,
      });
    }
  },
);
