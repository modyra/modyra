/**
 * A troubleshooting guide is a list of predictions, and a wrong one costs an afternoon.
 *
 * `docs/guides/troubleshooting.md` answers questions in the form *if you see this, it is because
 * that*. Every entry is falsifiable, none of them was held anywhere, and a wrong one is worse than a
 * missing one: somebody reads it while already confused and goes looking in the place it names.
 *
 * Four of its predictions are asserted here, chosen because each names a mechanism rather than a
 * habit:
 *
 * - `canSubmit = !submitting && valid && !pending` in the default mode, and **always false** under
 *   `"manual"`, where submission is the caller's to drive;
 * - a server refusal is routed by its `path`, and one whose path matches **no registered field is not
 *   lost** — it surfaces on `errorsFor("")`, which is also where a cross-field validator's failure
 *   shows;
 * - `timeoutMs` settles a run that never resolves, with a `kind: "async-timeout"` error rather than a
 *   field that stays `pending` forever.
 *
 * The routing is the one worth having as a partition rather than three separate checks: an error goes
 * to its field **or** to the form, and never to both or to neither.
 */

import { createForm, field, serverValidator } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

battle(
  {
    claims: ["SUB-001", "VAL-003"],
    title: "a refusal reaches the field it names, or the form when it names none",
    environments: ["node"],
  },
  async (ctx) => {
    const routed = [];
    for (const [what, refusal] of [
      ["a form-level refusal", { path: null, message: "the service is down" }],
      ["a refusal naming no registered field", { path: "ghost", message: "nobody has this" }],
      ["a refusal naming a real field", { path: "a", message: "this one exists" }],
    ]) {
      const form = createForm({ a: field("x") }, { devWarnings: false });
      await form.submit(() => [refusal]);
      await settled();
      const seen = {
        what,
        onTheForm: form.errorsFor("")().map((each) => each.message),
        onTheField: form.errorsFor("a")().map((each) => each.message),
      };
      form.destroy();
      ctx.log.note("where a refusal surfaced", seen);
      routed.push(seen);
    }

    // A partition: each message reaches exactly one of the two places. Neither is where a message
    // goes to be lost, and neither is where it goes twice.
    for (const seen of routed) {
      expectEqual(seen.onTheForm.length + seen.onTheField.length, 1, {
        claimIds: ["SUB-001"],
        what: `${seen.what} reached ${seen.onTheForm.length + seen.onTheField.length} of the two places a refusal can surface`,
        detail: JSON.stringify(seen),
      });
    }

    // And which one, which is the prediction the guide actually makes: a path nobody has is not lost.
    expectEqual(
      routed.map((seen) => (seen.onTheForm.length === 1 ? "form" : "field")),
      ["form", "form", "field"],
      {
        claimIds: ["SUB-001", "VAL-003"],
        what: "a refusal did not surface where the guide says to look for it",
        detail: JSON.stringify(routed),
      },
    );

    // The same place a cross-field failure shows, which is what makes `errorsFor("")` one answer
    // rather than a bucket for leftovers.
    const crossField = createForm(
      { a: field("1"), b: field("2") },
      {
        validators: [(value) => (value.a === value.b ? [] : [{ kind: "validation", message: "a and b must match" }])],
        devWarnings: false,
      },
    );
    await settled();
    const formErrors = crossField.errorsFor("")().map((each) => each.message);
    const valid = crossField.state.valid();
    crossField.destroy();
    ctx.log.note("a cross-field validator that failed", { formErrors, valid });

    expectEqual([formErrors, valid], [["a and b must match"], false], {
      claimIds: ["VAL-003"],
      what: "a cross-field failure did not show where the guide says, or left the form valid",
    });
  },
);

battle(
  {
    claims: ["SUB-001", "VAL-001"],
    title: "canSubmit answers per mode, and a run that never resolves still settles",
    environments: ["node"],
  },
  async (ctx) => {
    // `canSubmit = !submitting && valid && !pending` in the default mode, and always false under
    // `manual` — where the guide says to drive submission yourself.
    const perMode = [];
    for (const mode of ["valid-only", "always", "manual"]) {
      const form = createForm({ a: field("ok") }, { submitMode: mode, devWarnings: false });
      await settled(40);
      perMode.push({ mode, valid: form.state.valid(), canSubmit: form.state.canSubmit() });
      form.destroy();
    }
    ctx.log.note("canSubmit by mode, on a valid form", perMode);

    expectEqual(perMode.map((each) => each.canSubmit), [true, true, false], {
      claimIds: ["SUB-001"],
      what: "canSubmit did not answer the way the guide says it does in each mode",
      detail: JSON.stringify(perMode),
    });

    // And the hanging run. Without the timeout this field waits forever; with it the guide promises a
    // settled `pending` and a named error rather than a spinner nobody can stop.
    const hanging = createForm(
      { a: field("", [], serverValidator(() => new Promise(() => undefined), { debounceMs: 0, timeoutMs: 120 })) },
      { devWarnings: false },
    );
    hanging.f.a.set("x");
    await settled(400);
    const seen = {
      pending: hanging.state.pending(),
      errors: hanging.errorsFor("a")().map((each) => ({ kind: each.kind, message: String(each.message) })),
    };
    hanging.destroy();
    ctx.log.note("a run that never resolves, under a timeout", seen);

    expectEqual(seen.pending, false, {
      claimIds: ["VAL-001"],
      what: "a run that never resolves left the field pending despite its timeout",
    });

    expectClaim(seen.errors.some((each) => each.kind === "async-timeout"), {
      claimIds: ["VAL-001"],
      what: "the timeout settled the run without saying it was a timeout",
      detail: JSON.stringify(seen.errors),
    });
  },
);
