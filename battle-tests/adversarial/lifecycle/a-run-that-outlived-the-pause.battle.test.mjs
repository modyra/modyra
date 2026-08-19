/**
 * An async run in flight when the form is paused, and the pending that never settles.
 *
 * `docs/guides/typed-forms.md` makes three promises about activation, in one paragraph:
 * `deactivate()` *"pauses them again without losing any state"*, `activate()` *"resumes exactly
 * where it left off"*, and both are *"idempotent and safe to call any number of times in any
 * order"*. The paragraph then says what the mechanism is for: it is what makes `useMdyForm` safe
 * under React Strict Mode's *"dev-only mount→unmount→remount cycle"* — the hook activates in its
 * effect and deactivates on cleanup.
 *
 * Strict Mode's cycle is immediate, and an async validator debounced at zero starts on the first
 * write. So "a run is in flight when `deactivate()` is called" is not a corner: it is the shape of
 * the environment the feature exists for.
 *
 * Measured:
 *
 *                              in flight   after the run settles   after activate()
 *   never paused               pending     not pending, submittable
 *   paused mid-flight          pending     PENDING, not submittable   PENDING, not submittable
 *
 * The run resolves. Its answer is never taken, `pending` never reaches a terminal state, and
 * `canSubmit` stays false — so the submit button of a form the user has finished filling in never
 * comes back. `activate()` does not resume it, which is the promise the paragraph makes in as many
 * words.
 *
 * It is not permanent, and the way out is what makes it worth pinning rather than tolerating: a
 * *new* write starts a new run, and when that one settles the form frees itself. The user's escape
 * from a stuck submit button is to touch the field again — which they have no reason to do, because
 * nothing on screen says anything is waiting.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Drives one write through a validator the test releases by hand, optionally pausing the form while
 * that validator is still in flight.
 */
async function runWith({ pauseMidFlight }) {
  let release;
  const form = createForm(
    {
      x: field("", [], {
        asyncValidators: [
          async () => {
            await new Promise((resolve) => {
              release = resolve;
            });
            return [];
          },
        ],
        asyncDebounceMs: 0,
      }),
    },
    { devWarnings: false },
  );
  try {
    form.f.x.set("v");
    await wait(60);
    const inFlight = form.state.pending();

    if (pauseMidFlight) {
      form.deactivate();
      await wait(40);
    }

    release();
    await wait(120);
    const afterTheRunSettles = { pending: form.state.pending(), canSubmit: form.state.canSubmit() };

    if (pauseMidFlight) {
      form.activate();
      await wait(150);
    }
    const afterActivate = { pending: form.state.pending(), canSubmit: form.state.canSubmit() };

    return { inFlight, afterTheRunSettles, afterActivate };
  } finally {
    form.destroy();
  }
}

battle(
  {
    claims: ["LIF-001", "SUB-001"],
    title: "a run in flight when the form is paused still reaches a terminal state",
    environments: ["node"],
  },
  async (ctx) => {
    const control = await runWith({ pauseMidFlight: false });
    const paused = await runWith({ pauseMidFlight: true });
    ctx.log.note("the same run, with and without a pause across it", { control, paused });

    // The instrument: without the pause the run is in flight and then settles, so what follows is
    // about the pause rather than about a validator that never resolves.
    expectClaim(
      control.inFlight === true &&
        control.afterTheRunSettles.pending === false &&
        control.afterTheRunSettles.canSubmit === true,
      {
        claimIds: ["LIF-001"],
        what: "the run does not settle even without a pause, so the probe is wrong before the product is",
        detail: JSON.stringify(control),
      },
    );

    expectClaim(paused.inFlight === true, {
      claimIds: ["LIF-001"],
      what: "no run was in flight when the form was paused, so nothing was paused across",
      detail: JSON.stringify(paused),
    });

    // `activate()` resumes exactly where it left off — so a run whose answer arrived during the
    // pause must not leave the form waiting for it forever.
    expectEqual(paused.afterActivate, control.afterTheRunSettles, {
      claimIds: ["LIF-001", "SUB-001"],
      what: "a form picked up again is still waiting for a run that already answered, so its submit button never comes back",
    });
  },
);
