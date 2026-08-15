/**
 * Three sentences from the mental model, none of them held anywhere.
 *
 * The guide states the engine's shape in prose, and three of its sentences are decisions a refactor
 * could reverse without any type moving:
 *
 * - **`undo()` / `redo()` restore recorded values only, never touched, dirty or errors.** A step of
 *   history is a value the form held, not a session it was in — so undoing a write does not un-visit
 *   the field, and a person who has been somewhere has still been there.
 * - **The engine never deep-compares and never uses `JSON.stringify` to decide equality.** Identity
 *   is the rule, so an object rebuilt with the same contents is a new value. That is a cost a
 *   consumer needs to know about — a mapper that rebuilds on every render writes on every render —
 *   and it is the only rule that is honest about a value the engine cannot look inside.
 * - **`disabled` and `readonly` are derived from one interactivity value, so the two cannot
 *   disagree.** One value rather than two flags, which is what makes `disabled && readonly`
 *   unrepresentable rather than merely unlikely.
 *
 * Each is asserted at the point where breaking it would be quiet: a flag restored by an undo, a
 * deep comparison introduced as an optimisation, a second flag added beside the first.
 */

import { createForm, field, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = (ms = 70) => new Promise((resolve) => setTimeout(resolve, ms));

battle(
  {
    claims: ["PER-002"],
    title: "a step of history is a value the form held, not a session it was in",
    environments: ["node"],
  },
  async (ctx) => {
    const form = createForm({ a: field("start") }, { history: true, devWarnings: false });
    form.f.a.set("one");
    await settled();
    form.f.a.markAsTouched();
    form.f.a.markAsDirty();
    await settled();

    // The control: the write is in history and the person has been here, so an undo has both a value
    // to restore and flags it could wrongly restore with it.
    expectEqual(
      { value: form.getValue().a, touched: form.f.a.touched(), dirty: form.f.a.dirty(), canUndo: form.canUndo() },
      { value: "one", touched: true, dirty: true, canUndo: true },
      {
        claimIds: ["PER-002"],
        what: "the form was not in the state this battle is about before the undo",
      },
    );

    form.undo();
    await settled();
    ctx.log.note("after one undo", {
      value: form.getValue().a,
      touched: form.f.a.touched(),
      dirty: form.f.a.dirty(),
    });

    expectEqual(
      { value: form.getValue().a, touched: form.f.a.touched(), dirty: form.f.a.dirty() },
      { value: "start", touched: true, dirty: true },
      {
        claimIds: ["PER-002"],
        what: "undo restored something other than the value — a person who has been somewhere has still been there",
      },
    );
    form.destroy();
  },
);

battle(
  {
    claims: ["REA-001", "SUB-001"],
    title: "an object rebuilt with the same contents is a new value",
    environments: ["node"],
  },
  async (ctx) => {
    // Identity, not contents. A deep comparison introduced as an optimisation would make this quiet:
    // the write would land and nothing downstream would notice.
    const changed = createForm({ a: field({ x: 1 }) }, { devWarnings: false });
    await settled();
    changed.f.a.set({ x: 1 });
    await settled();
    const changes = changed.getChanges();
    changed.destroy();
    ctx.log.note("writing an equal-but-different object", { changes });

    expectEqual(changes, { a: { x: 1 } }, {
      claimIds: ["SUB-001"],
      what: "an object rebuilt with the same contents was treated as no change — the engine compared inside it",
    });

    // And the same through the reactive graph, which is where the cost lands: an effect re-runs.
    const reactivity = vanillaReactivity();
    const watched = createForm({ a: field({ x: 1 }) }, { devWarnings: false });
    await settled();
    let runs = 0;
    const watcher = reactivity.effect(() => {
      watched.f.a.value();
      runs += 1;
    });
    await settled();
    const before = runs;
    watched.f.a.set({ x: 1 });
    await settled();
    const after = runs;
    watcher?.destroy?.();
    watched.destroy();
    ctx.log.note("an effect watching an equal-but-different write", { before, after });

    expectClaim(after > before, {
      claimIds: ["REA-001"],
      what: "an effect did not re-run for a new object with the same contents, so something is comparing inside values",
      detail: JSON.stringify({ before, after }),
    });

    // The control: writing the *same reference* is not a change, so the rule is identity rather than
    // "every write is a change".
    const same = { x: 1 };
    const unchanged = createForm({ a: field(same) }, { devWarnings: false });
    await settled();
    unchanged.f.a.set(same);
    await settled();
    const nothing = unchanged.getChanges();
    unchanged.destroy();

    expectEqual(nothing, {}, {
      claimIds: ["SUB-001"],
      what: "writing the same reference was reported as a change, so the rule is not identity",
    });
  },
);

battle(
  {
    claims: ["VAL-002"],
    title: "disabled and readonly are one value, so they cannot disagree",
    environments: ["node"],
  },
  async (ctx) => {
    // A consumer asking for both is the case the shape exists to make unrepresentable. Two flags
    // would answer "both"; one value has to choose, and the choice is the stricter.
    const both = createForm({ a: field("x") }, { devWarnings: false });
    both.setDisabled("a", () => true);
    both.setReadonly("a", () => true);
    await settled();
    const seen = {
      interactivity: both.f.a.interactivity(),
      disabled: both.f.a.disabled(),
      readonly: both.f.a.readonly(),
    };
    both.destroy();
    ctx.log.note("a field asked to be both", seen);

    expectEqual(seen, { interactivity: "disabled", disabled: true, readonly: false }, {
      claimIds: ["VAL-002"],
      what: "a field asked to be disabled and readonly answered as both, or as neither",
    });

    // The two controls: each on its own is itself, so the answer above is the meeting of the two
    // rather than one of them never working.
    for (const [what, apply, expected] of [
      ["disabled alone", (form) => form.setDisabled("a", () => true), { interactivity: "disabled", disabled: true, readonly: false }],
      ["readonly alone", (form) => form.setReadonly("a", () => true), { interactivity: "readonly", disabled: false, readonly: true }],
    ]) {
      const form = createForm({ a: field("x") }, { devWarnings: false });
      apply(form);
      await settled();
      const answer = {
        interactivity: form.f.a.interactivity(),
        disabled: form.f.a.disabled(),
        readonly: form.f.a.readonly(),
      };
      form.destroy();

      expectEqual(answer, expected, {
        claimIds: ["VAL-002"],
        what: `${what} did not give the interactivity it names`,
      });
    }
  },
);
