/**
 * A generated sequence, written down and read back.
 *
 * The seven campaigns compare the engine against an independent model after every operation, and
 * they are the strongest evidence in this suite. What they cannot do is cross a draft: `draft.restore`
 * is refused by the operation interpreter by design — a restore rebuilds the form from storage, which
 * is not a step inside a run but a new run over the same state — so no seed and no run count reaches
 * it.
 *
 * That leaves the transition where several findings in this suite live untested by the instrument
 * built to find them. This campaign closes the narrow version of it: apply a generated sequence, let
 * the draft save, throw the form away, open a new one over the same storage, and ask the reference
 * model what should have come back.
 *
 * The property is deliberately narrower than the campaigns'. A draft carries a *value*, not a
 * session: what somebody touched, what they had mounted, what was dirty are not promised across a
 * reopen and are not asserted. What is asserted is `PER-001` in its own words — the declared
 * structure comes back, and rows that left do not — and `PER-003` beside it: the form is as valid as
 * the state it was saved from.
 *
 * The validity half is compared against the form itself rather than against the model, because the
 * model carries no rules. A required cell in the spec is what makes it vary: a generated sequence
 * that leaves a row's code empty saves an invalid form, and reopening it has to find the same answer.
 *
 * The reopen re-applies the interactivity bindings the sequence had set, because that is what a
 * consumer does and the only thing they can do. A binding is a function; a draft is JSON. The first
 * version of this campaign left them off and went red on three seeds: a required cell that was empty
 * *and disabled* saved a valid form and came back invalid, since the reason it was valid had not been
 * carried. Measured against a consumer who states their bindings again — in either order, before or
 * after the restore lands — the form is valid, so the red was this campaign asking for something no
 * form ships without.
 */

import { battle } from "../../harness/battle.mjs";
import { BattleBreak, compareCanonical } from "../../harness/assertions.mjs";
import { createBattleContext } from "../../harness/context.mjs";
import { betweenRuns } from "../../harness/campaign.mjs";
import { createRng, runCount, runSeed } from "../../harness/seed.mjs";
import { shrink } from "../../harness/shrinking.mjs";
import { encodeValue } from "../../models/observations.mjs";
import { createReferenceModel } from "../reference-model.mjs";
import { generateSequence } from "../generators/operations.mjs";

const CELLS = Object.freeze({ code: "", note: "unset" });
const CELL_NAMES = Object.keys(CELLS);

const SPEC = Object.freeze({
  version: 1,
  fields: Object.freeze({
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({
        code: Object.freeze({ kind: "text", required: true }),
        note: Object.freeze({ kind: "text", initial: "unset" }),
      }),
    }),
  }),
});

/** Storage the campaign owns, so a run depends on no environment. */
function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

/** The draft manager saves on its own debounce, which no clock in this harness drives. */
const saved = () => new Promise((resolve) => setTimeout(resolve, 700));
const restored = () => new Promise((resolve) => setTimeout(resolve, 60));

/** What has to survive a reopen: the rows that are declared, and what is in them. */
const survivingOf = (keys, rows) => encodeValue({ keys: [...keys], value: rows ?? {} }, "observable");

/**
 * Run a sequence, save it, reopen over the same storage, and report what came back against what the
 * model says was there. Building both from nothing is what makes a candidate sequence testable on
 * its own, which is what shrinking needs.
 */
async function roundTrip(operations, { log }) {
  const storage = memoryStorage();
  let validBefore = null;
  const model = createReferenceModel({ cells: CELLS });
  const before = createBattleContext({
    spec: SPEC,
    formOptions: { draft: { key: "campaign", storage }, devWarnings: false },
    log,
  });

  try {
    for (const operation of operations) {
      await before.execute(operation);
      model.apply(operation);
    }
    await saved();
    // PER-003 in its own words: a restored draft is as valid as the state it was saved from. Read
    // from the form rather than derived, because the reference model carries no rules — the
    // comparison is the form against itself across the reopen.
    validBefore = before.form.state.valid();
  } finally {
    before.form.destroy();
  }

  const wrote = storage.written.get("campaign");
  const after = createBattleContext({
    spec: SPEC,
    formOptions: { draft: { key: "campaign", storage }, devWarnings: false },
    log,
  });

  try {
    // What a consumer does on reopen, and the only thing they can do: re-apply their own bindings.
    // A binding is a function and a draft is JSON, so `setDisabled(path, () => …)` cannot be written
    // down and read back — the consumer owns it and states it again over the new form. Comparing
    // validity across a reopen that skipped this step compares a form nobody would ship.
    // The model names a path inside the collection; the form names it from the root.
    for (const path of model.disabledPaths()) after.form.setDisabled(`rows.${path}`, () => true);
    await restored();
    const actual = survivingOf(after.collections.rows.keys(), after.form.getValue().rows);
    const expected = survivingOf(model.keys(), model.value());
    const divergence = compareCanonical(expected, actual)
      ?? compareCanonical(
        encodeValue({ valid: validBefore }, "observable"),
        encodeValue({ valid: after.form.state.valid() }, "observable"),
      );
    return {
      divergence,
      wrote: typeof wrote === "string" ? wrote.length : 0,
      restoredRows: after.collections.rows.keys().length,
      validBefore,
    };
  } finally {
    after.form.destroy();
  }
}

battle(
  {
    claims: ["PER-001", "PER-003", "COL-001", "COL-002"],
    title: "a generated sequence written to a draft comes back as the sequence it was",
    environments: ["node"],
  },
  async (ctx) => {
    const runs = runCount(12);
    let carried = 0;
    let deepest = 0;
    let sawInvalid = false;

    for (let run = 0; run < runs; run += 1) {
      const seed = runSeed(ctx.seed, run);
      const rng = createRng(seed);
      const model = createReferenceModel({ cells: CELLS });
      const operations = generateSequence(rng, model, {
        length: 14,
        cells: CELL_NAMES,
        collectionPath: "rows",
      });

      const outcome = await roundTrip(operations, { log: ctx.log });
      carried += outcome.wrote;
      deepest = Math.max(deepest, outcome.restoredRows);
      if (outcome.validBefore === false) sawInvalid = true;
      if (!outcome.divergence) {
        await betweenRuns();
        continue;
      }

      // Reduce before reporting: a sequence of eight that survives removal of any one operation is
      // the shortest thing that still breaks, and it is what a reader has to hold in their head.
      const { minimized, attempts } = await shrink(operations, async (candidate) => {
        const attempt = await roundTrip(candidate, { log: ctx.log });
        return attempt.divergence !== null;
      });

      const final = await roundTrip(minimized, { log: ctx.log });
      throw new BattleBreak({
        claimIds: ["PER-001"],
        severity: "S0",
        what: "a draft did not bring back the collection the sequence had built",
        divergence: final.divergence ?? outcome.divergence,
        search: {
          run,
          runs,
          operations: minimized,
          minimizedTo: minimized.length,
          shrinkAttempts: attempts,
        },
      });
    }

    // Two controls, because a green campaign that round-tripped nothing proves nothing. The first
    // says a draft was written at all; the second says at least one run brought back a collection
    // with something in it, which is the case the property is about. A generated sequence can end
    // with every row removed, and a run of those is a comparison of two empty maps.
    if (carried === 0) {
      throw new BattleBreak({
        claimIds: ["PER-001"],
        severity: "S0",
        what: "no run wrote a draft, so nothing was read back and the property is untested",
      });
    }

    if (deepest === 0) {
      throw new BattleBreak({
        claimIds: ["PER-001"],
        severity: "S0",
        what: "no run restored a collection with a row in it, so every comparison was of two empty maps",
        detail: `${runs} run(s), ${carried} byte(s) written`,
      });
    }

    // The third control: validity has to have varied, or the half of the property about it compared
    // `true` with `true` every time.
    if (!sawInvalid) {
      throw new BattleBreak({
        claimIds: ["PER-003"],
        severity: "S0",
        what: "no run saved an invalid form, so the validity half of this property was never exercised",
        detail: `${runs} run(s)`,
      });
    }

    ctx.log.note("what the campaign carried across its runs", {
      runs,
      bytes: carried,
      deepestRestore: deepest,
    });
  },
);
