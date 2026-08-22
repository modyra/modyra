/**
 * The one call the whole form exists to make.
 *
 * `submit(action)` has a documented contract in a single line of the guide — a no-op that marks all
 * touched when `canSubmit()` is false, otherwise `submitting` rises, the action runs, and whatever
 * it returns is stored as server errors — and no battle had ever run it. What surrounds it is
 * undocumented and matters more than the line: what a form does when the action throws, and what a
 * second submit does while the first is still running.
 *
 * Both hold. A thrown action becomes a form-level error carrying the thrown message, and the form is
 * submittable again afterwards rather than stuck; a second submit does not start a second action.
 * They are pinned here because they are the behaviour a consumer builds a submit button on, and
 * nothing states them.
 *
 * What does not hold is the shape of one message. A consumer whose action returns something that is
 * not a list of errors gets a form-level error reading `errors.filter is not a function` — a
 * JavaScript runtime message, on the surface a consumer renders to the person filling in the form.
 * That is the smallest finding of the three and the only one with a red beside it.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const SPEC = Object.freeze({
  version: 2,
  fields: Object.freeze({
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({ code: Object.freeze({ kind: "text", required: true }) }),
    }),
  }),
});

/** A form holding one row that satisfies everything the schema asks for. */
async function submittable(ctx) {
  const context = ctx.open(SPEC);
  await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "A" } });
  return context;
}

const touchedCount = (form) => form.fieldNames().filter((name) => form.getField(name)?.().touched()).length;

battle(
  {
    claims: ["SUB-001", "VAL-003"],
    title: "a form that cannot be submitted runs nothing and tells the user why",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const context = ctx.open(SPEC);
    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "" } });

    const before = touchedCount(context.form);
    let ran = 0;
    await context.form.submit(async () => {
      ran += 1;
      return [];
    });
    const after = touchedCount(context.form);
    ctx.log.note("submitting a form that is not valid", { before, after, ran });

    // The control: the form really is unsubmittable, so what follows is the refusal rather than a
    // form that happened to be fine.
    expectEqual(context.form.state.canSubmit(), false, {
      claimIds: ["SUB-001"],
      what: "the form this battle builds is submittable, so nothing was refused",
    });

    expectEqual(ran, 0, {
      claimIds: ["SUB-001"],
      what: "the action ran for a form that cannot be submitted",
    });

    // Marking everything touched is what turns the refusal into something the user can see: an
    // untouched field shows no error, so a refusal without it looks like nothing happened.
    expectClaim(after > before, {
      claimIds: ["VAL-003", "SUB-001"],
      what: "a refused submit left the fields untouched, so the errors stay invisible",
      detail: `${before} touched before, ${after} after`,
    });
  },
);

battle(
  {
    claims: ["SUB-001"],
    title: "a submit that runs raises and lowers its flag and keeps what the server said",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const context = await submittable(ctx);

    let flagDuringAction = null;
    await context.form.submit(async () => {
      flagDuringAction = context.form.state.submitting();
      return [{ path: "rows.a.code", message: "the server said no" }];
    });

    const messages = context.form.errorsFor("rows.a.code")().map((each) => each.message);
    ctx.log.note("a submit that ran", {
      flagDuringAction,
      after: context.form.state.submitting(),
      count: context.form.state.submitCount(),
      messages,
    });

    expectEqual(flagDuringAction, true, {
      claimIds: ["SUB-001"],
      what: "the form did not report itself as submitting while its action was running",
    });

    expectEqual(context.form.state.submitting(), false, {
      claimIds: ["SUB-001"],
      what: "the form is still reporting itself as submitting after the action finished",
    });

    expectEqual(context.form.state.submitCount(), 1, {
      claimIds: ["SUB-001"],
      what: "the submit was not counted",
    });

    // What the action returned has to reach the field it names, which is what makes a server's
    // verdict visible where the user is looking.
    expectEqual(messages, ["the server said no"], {
      claimIds: ["SUB-001"],
      what: "the errors the action returned did not reach the field they name",
    });
  },
);

battle(
  {
    claims: ["SUB-001", "LIF-002"],
    title: "an action that fails leaves a form that can be submitted again",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    // A network that is down is the ordinary case, not the exotic one. What the form must not do is
    // stay stuck reporting itself as submitting, which would leave the button disabled forever.
    for (const [shape, action] of [
      ["throws", async () => { throw new Error("network down"); }],
      ["throws before awaiting", () => { throw new Error("network down"); }],
      ["rejects", () => Promise.reject(new Error("network down"))],
    ]) {
      const context = await submittable(ctx);
      let raised = null;
      try {
        await context.form.submit(action);
      } catch (error) {
        raised = error;
      }

      const formLevel = context.form.errorsFor("")().map((each) => each.message);
      ctx.log.note("an action that failed", {
        shape,
        raised: raised === null ? null : String(raised.message),
        formLevel,
        submitting: context.form.state.submitting(),
      });

      expectEqual(context.form.state.submitting(), false, {
        claimIds: ["LIF-002", "SUB-001"],
        what: `a submit whose action ${shape} left the form reporting itself as submitting`,
      });

      expectEqual(context.form.state.canSubmit(), true, {
        claimIds: ["SUB-001"],
        what: `a submit whose action ${shape} left the form unable to try again`,
      });

      // The failure is kept where a consumer displays it, carrying what was thrown rather than
      // being swallowed: a submit that failed and said nothing is a form that lies about succeeding.
      expectEqual(formLevel, ["network down"], {
        claimIds: ["SUB-001"],
        what: `a submit whose action ${shape} did not keep what it threw`,
      });
    }
  },
);

battle(
  {
    claims: ["SUB-001"],
    title: "a second submit does not start a second action",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const context = await submittable(ctx);

    // Two clicks on one button. Nothing states what the second does, and a form that ran the action
    // twice would send the same payload twice — which for a payment is the whole problem.
    let running = 0;
    let peak = 0;
    let calls = 0;
    const action = async () => {
      calls += 1;
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 30));
      running -= 1;
      return [];
    };

    await Promise.all([context.form.submit(action), context.form.submit(action)]);
    ctx.log.note("two submits at once", { calls, peak, count: context.form.state.submitCount() });

    expectEqual(peak, 1, {
      claimIds: ["SUB-001"],
      what: `two submits ran ${peak} actions at once, so one payload can be sent twice`,
    });

    expectEqual(context.form.state.submitting(), false, {
      claimIds: ["SUB-001"],
      what: "the form is still submitting after both calls settled",
    });
  },
);

battle(
  {
    claims: ["SUB-001", "DYN-001"],
    title: "an action that returns the wrong shape is told so in words a consumer can act on",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const context = await submittable(ctx);

    // The return value is a list of errors. Something else is the consumer's mistake, and what they
    // are handed for it is a form-level error — the surface an application renders to the person
    // filling in the form. A JavaScript runtime message there names an internal nobody wrote.
    await context.form.submit(async () => "not a list of errors");
    const shown = context.form.errorsFor("")().map((each) => each.message);
    ctx.log.note("what a wrong-shaped return puts in front of the user", { shown });

    expectClaim(shown.length > 0, {
      claimIds: ["SUB-001"],
      what: "a return that is not a list of errors was accepted silently",
    });

    const internal = shown.filter((message) =>
      /is not a function|is not iterable|Cannot read properties|undefined is not/.test(message));

    expectEqual(internal, [], {
      claimIds: ["SUB-001", "DYN-001"],
      what: "the message a consumer renders for a wrong-shaped return is a JavaScript runtime error",
      detail: JSON.stringify(shown),
    });
  },
);
