/**
 * A check still running for a field that left play.
 *
 * A disabled field is out of the form's reckoning. Its value is kept and excluded from submission,
 * and its errors stop counting: a form holding one empty, `required`, disabled field reports
 * `valid: true`. That is the contract working, and it is the control here.
 *
 * An async run belonging to that field is not taken out with it. `pending` stays on, so `canSubmit`
 * stays false, and the form withholds submission until an answer arrives that cannot change the
 * verdict it already reached — measured: the answer lands in the field's held errors and `valid`
 * never moves.
 *
 * The run also keeps running. `ctx.signal` is documented as aborted "when the run is superseded
 * (last-wins), re-debounced, or the form is destroyed"; a field leaving play is not on that list, so
 * the `fetch` a consumer wired to that signal — which is what the guide tells them to do with it —
 * goes on being paid for.
 *
 * How long this lasts is `timeoutMs`, and without one it does not end: a hanging call strands the
 * form whether or not anything was disabled, which is the documented reason to set one. So the
 * defect is not "the form can hang". It is that leaving play does not end the question, and the
 * guide's own example sets `timeoutMs: 5000` — five seconds of dead submit button after a person
 * ticks "not applicable".
 *
 * There are two ways out of play and they behave alike: `setDisabled` and `setInactive`, the latter
 * being what a closed conditional section does to the fields inside it. `setReadonly` is the
 * contrast that names the property at issue — a readonly field is still being asked about, still
 * counts against `valid`, and keeping its check running is correct. Leaving play is the condition,
 * not any change of state.
 *
 * Either repair passes: dropping the run from what `pending` counts, or aborting it.
 */

import { createForm, field, required, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

/** A form whose one interesting field runs a check that never answers on its own. */
function formWithAHangingCheck(signals) {
  return createForm(
    {
      a: field("", [required()], {
        asyncValidators: [
          async (value, ctx) => {
            signals.push(ctx.signal);
            await new Promise(() => undefined);
            return [];
          },
        ],
      }),
      b: field("ok"),
    },
    { reactivity: vanillaReactivity(), devWarnings: false },
  );
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const IN_FLIGHT = 140;

/** The two ways a field stops being asked about. A closed conditional section is the second one. */
const WAYS_OUT = Object.freeze([
  ["setDisabled", (form) => form.setDisabled("a", () => true)],
  ["setInactive", (form) => form.setInactive("a", () => true)],
]);

battle(
  {
    claims: ["VAL-001"],
    title: "a run a newer value supersedes is aborted, which is what the signal is for",
    environments: ["node"],
  },
  async (ctx) => {
    // The instrument, before anything is concluded from it. Each run gets its own signal, so the
    // first run's is the only one that can say whether the first run was aborted.
    const signals = [];
    const form = formWithAHangingCheck(signals);

    form.f.a.set("first");
    await wait(IN_FLIGHT);
    form.f.a.set("second");
    await wait(IN_FLIGHT);
    ctx.log.note("two runs, and what each signal says", {
      runs: signals.length,
      aborted: signals.map((signal) => signal.aborted),
    });

    expectClaim(signals.length === 2, {
      claimIds: ["VAL-001"],
      what: "a newer value did not start a run, so nothing here measures a supersede",
      detail: JSON.stringify({ runs: signals.length }),
    });

    expectClaim(signals[0].aborted === true, {
      claimIds: ["VAL-001"],
      what: "the run a newer value superseded was not aborted",
    });

    expectClaim(signals[1].aborted === false, {
      claimIds: ["VAL-001"],
      what: "the run that superseded the other one was aborted too",
    });

    form.destroy();
  },
);

battle(
  {
    claims: ["VAL-002", "VAL-003"],
    title: "a field that leaves play takes its unanswered question with it",
    environments: ["node"],
  },
  async (ctx) => {
    for (const [route, leave] of WAYS_OUT) {
      // The control: the field really is out of the reckoning. It is empty and `required`, and the
      // form is valid and submittable anyway — so whatever blocks submission below is not the
      // field's own rule.
      const quiet = [];
      const control = formWithAHangingCheck(quiet);
      leave(control);
      await wait(IN_FLIGHT);
      ctx.log.note(`a field out of play through ${route}, with nothing in flight`, {
        valid: control.state.valid(),
        canSubmit: control.state.canSubmit(),
        runs: quiet.length,
      });

      expectClaim(control.state.valid() && control.state.canSubmit(), {
        claimIds: ["VAL-002"],
        what: `an empty required field taken out of play by ${route} still held the form back`,
        detail: JSON.stringify({ valid: control.state.valid(), canSubmit: control.state.canSubmit() }),
      });
      control.destroy();

      // The same field, taken out of play while its check is in flight.
      const signals = [];
      const form = formWithAHangingCheck(signals);
      form.f.a.set("typed");
      await wait(IN_FLIGHT);

      expectClaim(form.state.pending() === true && signals.length === 1, {
        claimIds: ["VAL-003"],
        what: "no check was in flight, so this battle is not measuring what it says it is",
        detail: JSON.stringify({ pending: form.state.pending(), runs: signals.length }),
      });

      leave(form);
      await wait(200);
      ctx.log.note(`the same field, ${route} while its check was running`, {
        valid: form.state.valid(),
        canSubmit: form.state.canSubmit(),
        pending: form.state.pending(),
        aborted: signals[0].aborted,
      });

      // The form has already reached its verdict without this field: `valid` is true. What it will
      // not do is act on it.
      expectClaim(form.state.valid() === true, {
        claimIds: ["VAL-002"],
        what: `a field out of play through ${route} had its own rule counted against the form`,
      });

      expectClaim(form.state.canSubmit() === true || signals[0].aborted === true, {
        claimIds: ["VAL-002", "VAL-003"],
        what: `a field out of play through ${route} kept the form waiting on its check, and the check kept running`,
        detail: JSON.stringify({
          valid: form.state.valid(),
          canSubmit: form.state.canSubmit(),
          pending: form.state.pending(),
          aborted: signals[0].aborted,
        }),
      });

      form.destroy();
    }
  },
);

battle(
  {
    claims: ["VAL-002", "VAL-003"],
    title: "a field that is only readonly is still being asked, and keeps its check",
    environments: ["node"],
  },
  async (ctx) => {
    // The contrast that names what is at issue above. Readonly is not out of play: the value still
    // goes to the server and the field still has to be right, so it counts against `valid` and its
    // check has every reason to still be running. A repair that cancelled *any* state change's runs
    // would break this.
    const signals = [];
    const form = formWithAHangingCheck(signals);
    form.setReadonly("a", () => true);
    await wait(IN_FLIGHT);
    ctx.log.note("a readonly field with nothing in flight", {
      valid: form.state.valid(),
      canSubmit: form.state.canSubmit(),
    });

    expectClaim(form.state.valid() === false, {
      claimIds: ["VAL-002"],
      what: "an empty required field that is only readonly left the form valid, so readonly takes a field out of play",
      detail: JSON.stringify({ valid: form.state.valid() }),
    });

    form.f.a.set("typed");
    await wait(IN_FLIGHT);
    form.setReadonly("a", () => true);
    await wait(200);
    ctx.log.note("a readonly field whose check is running", {
      pending: form.state.pending(),
      aborted: signals[0].aborted,
    });

    expectClaim(form.state.pending() === true && signals[0].aborted === false, {
      claimIds: ["VAL-003"],
      what: "the check of a field that is still being asked about was cancelled",
      detail: JSON.stringify({ pending: form.state.pending(), aborted: signals[0].aborted }),
    });

    form.destroy();
  },
);
