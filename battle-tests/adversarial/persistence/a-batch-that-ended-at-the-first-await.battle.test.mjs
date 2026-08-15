/**
 * One history entry, not three — unless the callback waits.
 *
 * `mutate` exists for one promise, and the feature tour states it in a comment: `form.mutate(() => {
 * … })` produces *one history entry, not three*, so an undo returns to where the batch started rather
 * than unwinding it a write at a time.
 *
 * It keeps that promise under every shape a batch can take. Three writes collapse to one step. A
 * nested `mutate` collapses into the outer one. A callback that throws still closes its batch, with
 * the writes it managed before the throw in it. A callback that changes nothing records nothing.
 *
 * The shape it does not keep it under is a callback that waits. `mutate(fn: () => void)` is typed as
 * synchronous, and TypeScript does not stop `async () => {}` being passed to it: a function returning
 * `Promise<void>` is assignable where `void` is expected, which is the rule that makes callbacks
 * ergonomic and here makes a footgun. The batch closes when the synchronous part returns, so every
 * write after the first `await` lands outside it — and the caller gets exactly the history they asked
 * `mutate` to prevent, with nothing said.
 *
 * The engine can tell: a callback that returns a thenable is one that has not finished. Either repair
 * closes it — refuse it where it arrives, or say that the batch ended before the callback did.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

/** Three fields, so a batch of three writes is distinguishable from three batches of one. */
const openForm = () =>
  createForm({ a: field("a0"), b: field("b0"), c: field("c0") }, { history: true, devWarnings: true });

/** How many times undo moves before the form runs out of past. */
async function undoSteps(form) {
  let steps = 0;
  while (form.canUndo() && steps < 12) {
    form.undo();
    await settled(20);
    steps += 1;
  }
  return steps;
}

/** Whatever reaches either console channel while `act` runs. */
async function saying(act) {
  const said = [];
  const realWarn = console.warn;
  const realError = console.error;
  console.warn = (...parts) => said.push(parts.join(" "));
  console.error = (...parts) => said.push(parts.join(" "));
  try {
    await act();
  } catch (error) {
    said.push(`threw: ${error.message}`);
  } finally {
    console.warn = realWarn;
    console.error = realError;
  }
  return said;
}

battle(
  {
    claims: ["PER-002", "API-001"],
    title: "a batch is one step of history however the callback is written",
    environments: ["node"],
  },
  async (ctx) => {
    // The promise, and the control that makes it mean something: the same three writes outside a
    // batch are three steps.
    const batched = openForm();
    batched.mutate(() => {
      batched.f.a.set("a1");
      batched.f.b.set("b1");
      batched.f.c.set("c1");
    });
    await settled();
    const collapsed = await undoSteps(batched);
    batched.destroy();

    const loose = openForm();
    loose.f.a.set("a1");
    await settled();
    loose.f.b.set("b1");
    await settled();
    loose.f.c.set("c1");
    await settled();
    const separate = await undoSteps(loose);
    loose.destroy();
    ctx.log.note("three writes, batched and not", { collapsed, separate });

    expectEqual([collapsed, separate], [1, 3], {
      claimIds: ["PER-002"],
      what: "a batch did not collapse three writes into one step, or three loose writes were not three",
    });

    // The shapes it holds under, each asserted rather than assumed — a repair must not lose them.
    const nested = openForm();
    nested.mutate(() => {
      nested.f.a.set("a1");
      nested.mutate(() => {
        nested.f.b.set("b1");
      });
      nested.f.c.set("c1");
    });
    await settled();
    expectEqual(await undoSteps(nested), 1, {
      claimIds: ["PER-002"],
      what: "a batch inside a batch did not collapse into the outer one",
    });
    nested.destroy();

    const empty = openForm();
    empty.mutate(() => {});
    await settled();
    expectEqual(await undoSteps(empty), 0, {
      claimIds: ["PER-002"],
      what: "a batch that changed nothing recorded a step there was nothing to undo",
    });
    empty.destroy();

    const raised = openForm();
    let caught = null;
    try {
      raised.mutate(() => {
        raised.f.a.set("a1");
        throw new Error("halfway");
      });
    } catch (error) {
      caught = error.message;
    }
    await settled();
    raised.f.b.set("b1");
    await settled();
    ctx.log.note("a batch whose callback threw", { caught, value: raised.getValue() });

    expectEqual([caught, await undoSteps(raised)], ["halfway", 2], {
      claimIds: ["PER-002"],
      what: "a callback that threw left its batch open or lost the writes it had made",
    });
    raised.destroy();

    // And the shape it does not hold under.
    const waited = openForm();
    const said = await saying(async () => {
      await waited.mutate(async () => {
        waited.f.a.set("a1");
        await settled(20);
        waited.f.b.set("b1");
        await settled(20);
        waited.f.c.set("c1");
      });
      await settled(120);
    });
    const acrossAwaits = await undoSteps(waited);
    ctx.log.note("a batch whose callback waited", { acrossAwaits, said });
    waited.destroy();

    // Either repair closes it: refuse a callback that has not finished, or say that the batch ended
    // before it did. What this refuses is the caller getting the history `mutate` exists to prevent,
    // with nothing to tell them it happened.
    expectClaim(acrossAwaits === 1 || said.length > 0, {
      claimIds: ["PER-002", "API-001"],
      what: "a batch whose callback waited became one step per write, with nothing said",
      detail: `${acrossAwaits} step(s) of history where a batch is one`,
    });
  },
);
