/**
 * The cross-product of this suite's two strongest instruments.
 *
 * The generative campaigns run thousands of sequences against an independently written model — on one
 * runtime. `every-runtime` runs six published reactivity implementations against each other — on one
 * sequence, twelve operations long, written by hand.
 *
 * So a divergence that belongs to a runtime and that those twelve operations do not reach has never
 * been looked for. A reactivity is a scheduling decision as much as a data structure: when a
 * computation re-runs, what it re-reads, whether a batch collapses two writes. A hand-written
 * sequence exercises the shapes its author thought of.
 *
 * This drives *generated* sequences across all six. The property is not "the engine is right" — that
 * is the campaigns' job, against a model. It is narrower and different: **whatever the engine means,
 * every runtime means the same thing**, for a sequence nobody chose.
 *
 * Vanilla is the baseline because it is the one the campaigns already hold against a model, so a
 * difference reported here is a runtime's and not the engine's.
 */

import { battle } from "../../harness/battle.mjs";
import { BattleBreak, compareCanonical } from "../../harness/assertions.mjs";
import { betweenRuns } from "../../harness/campaign.mjs";
import { createRng, runCount, runSeed } from "../../harness/seed.mjs";
import { shrink } from "../../harness/shrinking.mjs";
import { RENDERER_ONLY_FIELDS } from "../../harness/canonical-snapshot.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";
import { createReferenceModel } from "../../generative/reference-model.mjs";
import { generateSequence } from "../../generative/generators/operations.mjs";

const CELLS = Object.freeze({ code: "", note: "", tax: "" });
const CELL_NAMES = Object.keys(CELLS);

/** The six adapters that publish a reactivity of their own. */
const RUNTIMES = Object.freeze([
  ["vue", async () => (await import("@modyra/vue")).vueReactivity()],
  ["react", async () => (await import("@modyra/react")).reactReactivity()],
  ["preact", async () => (await import("@modyra/preact")).preactReactivity()],
  ["svelte", async () => (await import("@modyra/svelte")).svelteReactivity()],
  ["lit", async () => (await import("@modyra/lit")).litReactivity()],
  ["solid", async () => (await import("@modyra/solid")).solidReactivity()],
]);

/**
 * Apply a sequence and observe, letting the runtime settle first.
 *
 * Each runtime schedules on its own terms and is allowed to; a macrotask lets all of them finish so
 * a difference in *when* cannot be read as a difference in *what*.
 */
async function drive(context, operations) {
  for (const operation of operations) await context.execute(operation);
  await context.scheduler.flush();
  await new Promise((resolve) => setTimeout(resolve, 0));
  return context.observe("after a generated sequence");
}

battle(
  {
    claims: ["REA-001", "COL-001", "SUB-002"],
    title: "six runtimes mean the same thing by a sequence nobody chose",
    environments: ["node"],
  },
  async (ctx) => {
    const runs = runCount(6);
    const loaded = [];
    for (const [name, load] of RUNTIMES) loaded.push([name, await load()]);

    // The control: every adapter is the one it claims to be. A runtime that silently resolved to the
    // framework-agnostic fallback would agree with vanilla for a reason that is not agreement.
    for (const [name, reactivity] of loaded) {
      if (reactivity.kind !== name) {
        throw new BattleBreak({
          claimIds: ["REA-001"],
          severity: "S1",
          what: `the ${name} adapter published a reactivity of kind ${JSON.stringify(reactivity.kind)}`,
          detail: "a runtime resolving to something else agrees with vanilla for the wrong reason",
        });
      }
    }

    /** Run one sequence everywhere and report the first runtime that meant something else. */
    const disagreement = async (operations) => {
      const baseline = await drive(ctx.open(KEYED_ROWS_SPEC, { history: true }), operations);
      for (const [name, reactivity] of loaded) {
        const seen = await drive(ctx.open(KEYED_ROWS_SPEC, { history: true, reactivity }), operations);
        // What a runtime *says* is excluded here for a reason that is this harness's rather than the
        // product's: every context in one battle shares the console capture, so a later runtime's
        // snapshot carries the diagnostics of the ones before it. Comparing them would report the
        // order they ran in. `mountedPaths` is excluded for the standing reason — it is what a
        // renderer holds, not what a form means.
        const divergence = compareCanonical(baseline, seen, {
          ignore: [...RENDERER_ONLY_FIELDS, "diagnostics"],
        });
        if (divergence !== null) return { runtime: name, divergence };
      }
      return null;
    };

    let longest = 0;
    for (let run = 0; run < runs; run += 1) {
      await betweenRuns(run);
      const rng = createRng(runSeed(ctx.seed, run));
      const model = createReferenceModel({ cells: CELLS, history: true });
      // History is on and the generator may draw undo and redo. Restoring a state is where a
      // reactivity is asked to re-run the most at once, which is where two schedulers are most
      // likely to differ — and it is the dimension a hand-written sequence is least likely to reach
      // in the order that matters.
      const operations = generateSequence(rng, model, {
        length: 12,
        cells: CELL_NAMES,
        collectionPath: "rows",
        withHistory: true,
      });
      longest = Math.max(longest, model.keys().length);

      const found = await disagreement(operations);
      if (found === null) continue;

      const { minimized, attempts } = await shrink(operations, async (candidate) => {
        const attempt = await disagreement(candidate);
        return attempt !== null;
      });
      const final = await disagreement(minimized);

      throw new BattleBreak({
        claimIds: ["REA-001"],
        severity: "S1",
        what: `${(final ?? found).runtime} meant something else by a sequence the others agreed on`,
        divergence: (final ?? found).divergence,
        search: { run, runs, operations: minimized, minimizedTo: minimized.length, shrinkAttempts: attempts },
      });
    }

    // The second control: the sequences built something. Six runtimes agreeing about an empty
    // collection is six runtimes agreeing about nothing.
    if (longest === 0) {
      throw new BattleBreak({
        claimIds: ["COL-001"],
        severity: "S1",
        what: "no generated sequence left a row standing, so every comparison was of empty forms",
        detail: `${runs} run(s)`,
      });
    }

    ctx.log.note("what the cross-product covered", {
      runs,
      runtimes: loaded.map(([name]) => name),
      deepest: longest,
    });
  },
);
