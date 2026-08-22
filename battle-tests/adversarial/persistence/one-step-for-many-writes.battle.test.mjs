/**
 * A batch that ends badly, and the history after it.
 *
 * `form.mutate(fn)` groups every field write inside `fn` into one history entry, which is what makes
 * a programmatic burst — a wizard step applying its answers, an import filling a section — one thing
 * a user can undo rather than fifteen. It had no battle.
 *
 * The case worth having is the one nobody writes down: `fn` throws halfway. Three answers are
 * possible and only one of them is safe. The exception has to reach the caller, or a failure
 * disappears. The writes already made have to stay — the engine has no transaction and pretending
 * otherwise would mean guessing which of them to undo. And the batch has to *close*, because a batch
 * left open silently groups every later write in the form's life into the same entry, and nothing
 * about the form looks different afterwards.
 *
 * That last one is why this exists: it degrades history permanently, from one throw, with no
 * symptom until somebody presses undo and watches an hour of work disappear at once.
 */

import { createForm, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { buildSchema } from "../../models/schemas.mjs";

const SPEC = Object.freeze({
  version: 2,
  fields: Object.freeze({
    a: Object.freeze({ kind: "text" }),
    b: Object.freeze({ kind: "text" }),
    c: Object.freeze({ kind: "text" }),
  }),
});

const settled = () => new Promise((resolve) => setTimeout(resolve, 30));
const open = () =>
  createForm(buildSchema(SPEC).schema, { reactivity: vanillaReactivity(), devWarnings: false, history: true });

/** How far undo reaches. */
function undoDepth(form) {
  let steps = 0;
  while (form.canUndo() && steps < 40) {
    form.undo();
    steps += 1;
  }
  return steps;
}

battle(
  {
    claims: ["PER-002"],
    title: "a burst of writes is one step, and the same writes apart are three",
    environments: ["node"],
  },
  async (ctx) => {
    const grouped = open();
    grouped.mutate(() => {
      grouped.f.a.set("1");
      grouped.f.b.set("2");
      grouped.f.c.set("3");
    });
    await settled();
    const groupedSteps = undoDepth(grouped);
    ctx.log.note("three writes inside one mutate", { steps: groupedSteps });

    // The control, and the reason the number above means anything: the same three writes, made the
    // ordinary way, are three steps.
    const apart = open();
    for (const [name, value] of [["a", "1"], ["b", "2"], ["c", "3"]]) {
      apart.f[name].set(value);
      await settled();
    }
    const apartSteps = undoDepth(apart);

    expectEqual([groupedSteps, apartSteps], [1, 3], {
      claimIds: ["PER-002"],
      what: "a burst was not one step, or the same writes apart were not three",
    });

    // Nesting is what a helper calling another helper produces, and it is still one thing the user
    // did.
    const nested = open();
    nested.mutate(() => {
      nested.f.a.set("1");
      nested.mutate(() => {
        nested.f.b.set("2");
      });
      nested.f.c.set("3");
    });
    await settled();
    expectEqual(undoDepth(nested), 1, {
      claimIds: ["PER-002"],
      what: "a mutate inside a mutate produced more than one step",
    });

    grouped.destroy();
    apart.destroy();
    nested.destroy();
  },
);

battle(
  {
    claims: ["PER-002", "LIF-001"],
    title: "a burst that throws halfway ends, and the next write is its own step",
    environments: ["node"],
  },
  async (ctx) => {
    const form = open();

    let raised = null;
    try {
      form.mutate(() => {
        form.f.a.set("1");
        form.f.b.set("2");
        throw new Error("halfway");
      });
    } catch (error) {
      raised = error;
    }
    await settled();
    ctx.log.note("a burst that threw", {
      raised: raised === null ? null : String(raised.message),
      value: form.getValue(),
    });

    // The failure reaches the caller: a batch that swallowed it would leave an application believing
    // its own code ran.
    expectClaim(raised instanceof Error && raised.message === "halfway", {
      claimIds: ["LIF-001"],
      what: "an exception thrown inside a burst did not reach the caller",
      detail: String(raised),
    });

    // The writes already made stay. There is no transaction here and inventing one would mean
    // guessing which of them the caller meant to keep.
    expectEqual([form.getValue().a, form.getValue().b, form.getValue().c], ["1", "2", ""], {
      claimIds: ["PER-002"],
      what: "the writes made before the throw were rolled back or lost",
    });

    // And the batch closed. Two later writes are two more steps, not two more members of the batch
    // that failed — a batch left open groups the rest of the form's life into one entry, and nothing
    // about the form looks different until somebody presses undo.
    form.f.b.set("later 1");
    await settled();
    form.f.c.set("later 2");
    await settled();
    const total = undoDepth(form);
    ctx.log.note("two writes after the throw", { total });

    expectEqual(total, 3, {
      claimIds: ["PER-002"],
      what: `the burst left ${total} step(s) where the partial batch and two separate writes are three`,
    });

    form.destroy();
  },
);
