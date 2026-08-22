/**
 * A form put down and picked up again.
 *
 * `deactivate()` pauses draft persistence, history recording and async validators "without losing
 * any state"; `activate()` resumes them; both are idempotent. It is what a wizard does to the step
 * the user is not on, and what a tab does when it goes to the background — three background
 * behaviours stopped at once so a form nobody is looking at stops writing, recording and calling a
 * server.
 *
 * None of it had a battle, and each third fails differently. A draft that keeps writing burns a
 * quota and stores what the user has not looked at; history that keeps recording fills with steps
 * nobody took; an async validator that keeps running calls a server for a form off screen. Each is
 * asserted against the same form left active, so a pause that stopped nothing and a form that never
 * did the thing at all cannot be confused.
 *
 * The one nuance worth stating: the steps taken while paused are not lost, they arrive as one. A
 * pending snapshot is flushed by `undo()`, which the guide says it does, so a paused stretch is one
 * undo step rather than none — the work is still reachable, which is what "without losing any state"
 * has to mean for history.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

const SPEC = Object.freeze({
  version: 2,
  fields: Object.freeze({
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({ code: Object.freeze({ kind: "text" }) }),
    }),
  }),
});

function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 60));

/** How far undo reaches, leaving the form where it found it. */
function undoDepth(form) {
  let steps = 0;
  while (form.canUndo() && steps < 30) {
    form.undo();
    steps += 1;
  }
  for (let index = 0; index < steps; index += 1) form.redo();
  return steps;
}

battle(
  {
    claims: ["LIF-001", "PER-001"],
    title: "a paused form stops writing drafts and starts again when it is picked up",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const storage = memoryStorage();
    const context = ctx.open(SPEC, { draft: { key: "d", storage, debounceMs: 15 } });
    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "A" } });
    await settled();

    // The control: it writes while it is active, so a storage that stays empty below is the pause.
    expectEqual(storage.written.has("d"), true, {
      claimIds: ["PER-001"],
      what: "an active form did not write a draft, so nothing below is about pausing",
    });

    context.form.deactivate();
    storage.written.delete("d");
    await context.execute({ type: "field.set", path: "rows.a.code", value: "typed while paused" });
    await settled();
    ctx.log.note("edited while paused", { stored: storage.written.has("d"), deactivated: context.form.deactivated });

    expectEqual(storage.written.has("d"), false, {
      claimIds: ["PER-001", "LIF-001"],
      what: "a paused form wrote a draft for a form nobody is looking at",
    });

    // Nothing was lost by pausing: the value is what was typed.
    expectEqual(context.form.getValue().rows.a.code, "typed while paused", {
      claimIds: ["LIF-001"],
      what: "a paused form did not keep what was typed into it",
    });

    context.form.activate();
    await settled();
    ctx.log.note("picked up again", { stored: storage.written.has("d"), deactivated: context.form.deactivated });

    expectEqual(storage.written.has("d"), true, {
      claimIds: ["PER-001"],
      what: "a form picked up again did not resume writing its draft",
    });
  },
);

battle(
  {
    claims: ["LIF-001", "PER-002"],
    title: "a paused form records the stretch as one step rather than every keystroke",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const write = async (context, values) => {
      for (const value of values) {
        await context.execute({ type: "field.set", path: "rows.a.code", value });
        await settled();
      }
    };
    const typed = ["one", "two", "three"];

    const active = ctx.open(SPEC, { history: true });
    await active.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "start" } });
    await settled();
    await write(active, typed);
    const activeSteps = undoDepth(active.form);

    const paused = ctx.open(SPEC, { history: true });
    await paused.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "start" } });
    await settled();
    paused.form.deactivate();
    await write(paused, typed);
    const pausedSteps = undoDepth(paused.form);
    ctx.log.note("the same typing, active and paused", { activeSteps, pausedSteps });

    // The control: recording works, so a smaller number below is the pause.
    expectEqual(activeSteps, typed.length + 1, {
      claimIds: ["PER-002"],
      what: "an active form did not record one step per edit",
    });

    // Fewer steps is the pause. More than the declaration alone is the pending snapshot that undo
    // flushes, which is what keeps the paused stretch reachable instead of discarding it.
    expectClaim(pausedSteps < activeSteps, {
      claimIds: ["LIF-001", "PER-002"],
      what: `a paused form recorded ${pausedSteps} steps for typing it was not supposed to record`,
    });

    expectClaim(pausedSteps >= 1, {
      claimIds: ["PER-002"],
      what: "a paused form lost the step that reaches the work done while it was paused",
    });

    expectEqual(paused.form.getValue().rows.a.code, "three", {
      claimIds: ["LIF-001"],
      what: "a paused form did not keep what was typed into it",
    });
  },
);

battle(
  {
    claims: ["LIF-001", "VAL-001"],
    title: "a paused form does not call a server for a field nobody is looking at",
    environments: ["node"],
    requires: ["structural", "asyncStarted"],
  },
  async (ctx) => {
    const started = async (pause) => {
      const context = ctx.open(KEYED_ROWS_SPEC);
      await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "A" } });
      await settled();
      const before = context.asyncValidators.runs("rows.a.tax").length;
      if (pause) context.form.deactivate();
      await context.execute({ type: "field.set", path: "rows.a.tax", value: "changed" });
      await settled();
      return { before, after: context.asyncValidators.runs("rows.a.tax").length };
    };

    const active = await started(false);
    const paused = await started(true);
    ctx.log.note("async runs started by one edit", { active, paused });

    // The control: an edit starts a run while the form is active.
    expectClaim(active.after > active.before, {
      claimIds: ["VAL-001"],
      what: "an active form started no async validation, so the pause below is not observable",
      detail: JSON.stringify(active),
    });

    expectEqual(paused.after, paused.before, {
      claimIds: ["LIF-001", "VAL-001"],
      what: "a paused form started an async validation for a form nobody is looking at",
      detail: JSON.stringify(paused),
    });
  },
);

battle(
  {
    claims: ["LIF-001"],
    title: "pausing and picking up twice is the same as doing it once",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    const context = ctx.open(SPEC, { history: true });
    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "A" } });

    // Idempotence is what lets a wizard call these from a lifecycle hook that may run twice without
    // tracking whether it already did.
    expectEqual(context.form.deactivated, false, {
      claimIds: ["LIF-001"],
      what: "a form reports itself paused before anyone paused it",
    });

    context.form.deactivate();
    context.form.deactivate();
    expectEqual(context.form.deactivated, true, {
      claimIds: ["LIF-001"],
      what: "pausing twice did not leave the form paused",
    });

    context.form.activate();
    context.form.activate();
    expectEqual(context.form.deactivated, false, {
      claimIds: ["LIF-001"],
      what: "picking the form up twice did not leave it running",
    });

    expectEqual(context.form.getValue().rows.a.code, "A", {
      claimIds: ["LIF-001"],
      what: "a form put down and picked up twice lost what it held",
    });
  },
);

battle(
  {
    claims: ["LIF-001", "PER-001"],
    title: "a form built without being activated is a paused form, and says so",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    // `autoActivate: false` is how the React and Preact bindings construct — the form is built in
    // one place and activated where the component's lifetime begins. A form left in that state is a
    // paused one, and the only thing standing between "not started yet" and "quietly doing nothing"
    // is that it reports itself paused.
    const storage = memoryStorage();
    const context = ctx.open(SPEC, {
      draft: { key: "d", storage, debounceMs: 15 },
      history: true,
      autoActivate: false,
    });

    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "A" } });
    await settled();
    ctx.log.note("a form built without being activated", {
      deactivated: context.form.deactivated,
      stored: storage.written.has("d"),
      canUndo: context.form.canUndo(),
      value: context.form.getValue().rows,
    });

    expectEqual(context.form.deactivated, true, {
      claimIds: ["LIF-001"],
      what: "a form built with autoActivate false does not report itself paused, so nothing distinguishes it from one that is running and doing nothing",
    });

    expectEqual(storage.written.has("d"), false, {
      claimIds: ["PER-001"],
      what: "a form that was never activated wrote a draft",
    });

    // And what was written into it is still there when it starts.
    context.form.activate();
    await settled();
    expectEqual(context.form.getValue().rows.a.code, "A", {
      claimIds: ["LIF-001"],
      what: "activating a form lost what was put into it before",
    });

    // Starting draft persistence on a form that already holds something has one obvious meaning, and
    // the resume path takes it: a form that was active, paused, written to and resumed writes its
    // draft on resuming. A form that was built unstarted and then activated does not — it waits for
    // an unrelated edit. React and Preact construct with `autoActivate: false`, so a form hydrated
    // from a payload in the tick it was built keeps nothing until the user types.
    expectEqual(storage.written.has("d"), true, {
      claimIds: ["PER-001"],
      what: "activating a form that was never started did not persist what it already holds, where resuming a paused one does",
    });
  },
);

battle(
  {
    claims: ["PER-001", "LIF-001"],
    title: "resuming a paused form persists what it holds",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    // The control for the battle above, and the reason it is a difference rather than a rule: the
    // same state reached the other way round writes its draft the moment it resumes.
    const storage = memoryStorage();
    const context = ctx.open(SPEC, { draft: { key: "d", storage, debounceMs: 15 }, history: true });
    await settled();
    context.form.deactivate();

    await context.execute({ type: "record.upsert", path: "rows", key: "a", value: { code: "A" } });
    await settled();
    const whilePaused = storage.written.has("d");

    context.form.activate();
    await settled();
    ctx.log.note("a paused form, written to, then resumed", { whilePaused, afterResume: storage.written.has("d") });

    expectEqual(whilePaused, false, {
      claimIds: ["PER-001"],
      what: "a paused form wrote a draft, so the resume below proves nothing",
    });

    expectEqual(storage.written.has("d"), true, {
      claimIds: ["PER-001"],
      what: "resuming a paused form did not persist what it holds",
    });
  },
);
