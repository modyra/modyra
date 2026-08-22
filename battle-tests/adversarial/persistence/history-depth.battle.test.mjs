/**
 * The three things `history` promises in numbers.
 *
 * `history: { maxEntries, debounceMs }` is the only place the engine takes an instruction about how
 * much of the past to keep and how finely to cut it, and the guide states all three answers: the
 * defaults are 100 entries and no debounce; `debounceMs` exists so rapid typing collapses into a
 * single undo step; and `undo()` flushes a snapshot still waiting on the debounce, so no typing is
 * silently lost.
 *
 * None of the three had a check. `canUndo` did — it is where the affordance defect was found — but
 * the affordance is about whether the button lights up, and these are about what the button reaches
 * when it is pressed. A cap that quietly stops capping turns undo into a promise a long editing
 * session breaks; a debounce that stops coalescing turns one word into five undo steps; and a flush
 * that stops flushing loses the last thing the user typed, which is the one they remember.
 *
 * The clock is the suite's, not the machine's: a debounce asserted with real waiting is a coin toss
 * on a loaded runner, and the window under test is the one between a keystroke and the snapshot.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const SPEC = Object.freeze({
  version: 2,
  fields: Object.freeze({
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({ code: Object.freeze({ kind: "text" }) }),
    }),
  }),
});

/** How many times undo moves before the form says there is nothing left. */
function undoDepth(form, ceiling = 400) {
  let steps = 0;
  while (form.canUndo() && steps < ceiling) {
    form.undo();
    steps += 1;
  }
  return steps;
}

battle(
  {
    claims: ["PER-002"],
    title: "a debounce collapses typing into one step, and its absence does not",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const typed = ["h", "he", "hel", "hell", "hello"];

    ctx.scheduler.install();
    try {
      // Without a debounce every keystroke is its own step. This is the default the guide describes,
      // and it is also the control: the same typing, the same clock, one option apart.
      const fine = ctx.open(SPEC, { history: { debounceMs: 0 } });
      await fine.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "" } });
      await ctx.scheduler.advance(1);
      for (const value of typed) {
        await fine.execute({ type: "field.set", path: "rows.a.code", value });
        await ctx.scheduler.advance(1);
      }

      expectEqual(fine.form.getValue().rows.a.code, "hello", {
        claimIds: ["PER-002"],
        what: "the typing did not land in the field",
      });

      const fineSteps = undoDepth(fine.form) - 1;
      ctx.log.note("typing without a debounce", { steps: fineSteps });

      expectEqual(fineSteps, typed.length, {
        claimIds: ["PER-002"],
        what: "the default recorded something other than one entry per keystroke",
      });

      // And with one, the same five keystrokes are one step — each restarting the window, the last
      // one committing when the typing stops.
      const coarse = ctx.open(SPEC, { history: { debounceMs: 300 } });
      await coarse.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "" } });
      await ctx.scheduler.advance(400);
      for (const value of typed) {
        await coarse.execute({ type: "field.set", path: "rows.a.code", value });
        await ctx.scheduler.advance(100);
      }
      await ctx.scheduler.advance(400);

      const coarseSteps = undoDepth(coarse.form) - 1;
      ctx.log.note("the same typing with a debounce", { steps: coarseSteps });

      expectEqual(coarseSteps, 1, {
        claimIds: ["PER-002"],
        what: `a debounce of 300ms left ${coarseSteps} undo steps for one word`,
      });
    } finally {
      ctx.scheduler.restore();
    }
  },
);

battle(
  {
    claims: ["PER-002"],
    title: "history holds the number of entries it was told to, and drops the oldest",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    ctx.scheduler.install();
    try {
      for (const [history, expected] of [[true, 100], [{ maxEntries: 5 }, 5]]) {
        const context = ctx.open(SPEC, { history });
        await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "" } });
        await ctx.scheduler.advance(1);

        // More writes than any cap here, each its own entry, so the cap is what decides the depth.
        for (let index = 0; index < 150; index += 1) {
          await context.execute({ type: "field.set", path: "rows.a.code", value: `v${index}` });
          await ctx.scheduler.advance(1);
        }

        const steps = undoDepth(context.form);
        const oldestReached = context.form.getValue().rows.a?.code ?? null;
        ctx.log.note("what a capped history reaches", { history, steps, oldestReached });

        expectEqual(steps, expected, {
          claimIds: ["PER-002"],
          what: `a history of ${JSON.stringify(history)} reached ${steps} steps back`,
        });

        // Which end was dropped matters: keeping the oldest would mean undo walks away from what
        // the user just did. Exhausting a cap of N from the last write, v149, lands on v(149 - N):
        // the value left names the oldest entry still held.
        expectEqual(oldestReached, `v${149 - expected}`, {
          claimIds: ["PER-002"],
          what: `undo bottomed out at ${JSON.stringify(oldestReached)}, so the dropped entries were not the oldest`,
        });
      }
    } finally {
      ctx.scheduler.restore();
    }
  },
);

battle(
  {
    claims: ["PER-002"],
    title: "undo reaches a snapshot the debounce has not taken yet",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    ctx.scheduler.install();
    try {
      const context = ctx.open(SPEC, { history: { debounceMs: 300 } });
      await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "start" } });
      await ctx.scheduler.advance(400);

      // The window the promise is about: written, and the debounce has not fired. An undo that
      // ignored the pending snapshot would step past this write to the one before it, and the last
      // thing the user typed would be gone with nothing to redo.
      await context.execute({ type: "field.set", path: "rows.a.code", value: "typed but not recorded" });
      context.form.undo();

      const afterUndo = context.form.getValue().rows.a?.code ?? null;
      ctx.log.note("undo against a pending snapshot", { afterUndo });

      expectEqual(afterUndo, "start", {
        claimIds: ["PER-002"],
        what: `undo landed on ${JSON.stringify(afterUndo)} instead of the value before the pending write`,
      });

      context.form.redo();
      const afterRedo = context.form.getValue().rows.a?.code ?? null;

      expectEqual(afterRedo, "typed but not recorded", {
        claimIds: ["PER-002"],
        what: "the flushed snapshot was not on the redo stack, so the typing was lost",
      });
    } finally {
      ctx.scheduler.restore();
    }
  },
);
