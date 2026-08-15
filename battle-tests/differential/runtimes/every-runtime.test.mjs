/**
 * One operation log, six published reactivity implementations, compared against vanilla.
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
 * Six of the eight adapters are here. `@modyra/plain` is the seventh and is not missing: it mounts on
 * `vanillaReactivity()` from the core, so it is the baseline every row is compared against rather
 * than a row of its own.
 *
 * Angular, the eighth, is absent for two reasons, and only the first is about tooling. Its reactivity is produced
 * by `build:angular` while `npm run battle` runs `build:packages`, so adding it would make the
 * suite's own build a different one.
 *
 * The second is that it would not agree if it were here, and is not supposed to. `angularReactivity`
 * built outside an injection context reports `effects: false`, and an async validator is skipped
 * rather than half-started: the same log that leaves one run in flight on vanilla leaves none on
 * Angular. That is the documented degradation, pinned by
 * `angular/degraded-reactivity.battle.mjs`, and comparing it here would report a difference that is
 * the contract rather than a break. A reader who solves the build and expects Angular to slot in
 * would find that out the hard way otherwise.
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
  ["solid", async () => (await import("@modyra/solid")).solidReactivity()],
]);

/**
 * Solid takes part now, and what it took to get here is worth stating.
 *
 * It used to be excluded because without the `browser` export condition it resolved to a build whose
 * computations never re-run, and a form on it froze at creation — reporting itself valid with an
 * empty `required` field. That was read here as a property of how this suite is run. It was the
 * server build, which is what a server render resolves, so the frozen verdict was a production
 * answer and not a test artefact.
 *
 * `solidReactivity()` now probes the graph it resolved and falls back to the framework-agnostic one
 * when computations do not re-run, so the verdicts are the same on both builds and Solid belongs in
 * this comparison.
 *
 * What it emits is not the same: the fallback says so once, and no other runtime says anything. That
 * is compared separately below rather than ignored, because a runtime that started reporting a
 * diagnostic nobody expected is exactly what this file exists to catch.
 *
 * Solid's *tracking* is still not portable — reads on the server build are not tracked by Solid's
 * own primitives — so a battle asserting that a Solid computation observed a handle still needs the
 * condition. This one asserts what a form means, not who noticed.
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
    title: "a form means the same thing on every runtime a consumer can hand it",
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

      // The form itself, everywhere but the diagnostics: what a runtime *says* about the process it
      // resolved is not part of what a form means.
      expectSameObservation(state, baseline, {
        claimIds: ["COL-001", "COL-003", "COL-007", "VAL-002", "SUB-001", "SUB-002"],
        ignore: [...RENDERER_ONLY_FIELDS, "diagnostics"],
        what: `the same operations on ${name}'s reactivity produced a different form`,
      });

      // And the diagnostics, compared rather than ignored. Every runtime is silent except a Solid
      // that resolved the server build, which says so once — anything else appearing here is a
      // runtime reporting something no consumer was told to expect.
      const spoke = (state.diagnostics ?? []).map((entry) => entry.code ?? entry.message ?? String(entry));
      ctx.log.note("what the runtime said while doing it", { runtime: name, spoke });

      const permitted = name === "solid"
        ? spoke.every((line) => String(line).includes("server build"))
        : spoke.length === 0;

      expectClaim(permitted, {
        claimIds: ["COL-001"],
        what: `${name}'s reactivity reported something this comparison does not account for`,
        detail: JSON.stringify(spoke),
      });
    }
  },
);
