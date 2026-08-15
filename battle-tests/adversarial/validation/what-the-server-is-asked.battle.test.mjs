/**
 * Which values reach a server, and which answers are allowed back.
 *
 * A server check is the expensive one — a network round trip, a rate limit, sometimes a log entry
 * with the value in it — so `when` is documented as skipping the call for input the field already
 * refuses. The claim is stated from the server's side: it is asked only about a value the field's own
 * rules accept.
 *
 * Five things decide that, and only the first is obvious.
 *
 * A value a sync rule rejects is not sent. An **empty** value with no `required` *is* sent, and that
 * is not a leak: emptiness is `required`'s question and every other validator stays out of it, so a
 * field with no `required` accepts blank and the server is being asked about a value the field
 * accepts. Pinning both sides is what makes the rule legible rather than a coincidence.
 *
 * Then the three that are about time. A run whose value stops being acceptable is abandoned rather
 * than finished, and its answer does not land afterwards. A dependency change re-asks, and the check
 * can read the dependency it was re-run for. A server slower than its timeout ends the run with
 * something a user can read instead of leaving the field pending forever.
 */

import { createForm, field, minLength, required, serverValidator } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms));

battle(
  {
    claims: ["VAL-005"],
    title: "a server is asked about the values the field accepts, and no others",
    environments: ["node"],
  },
  async (ctx) => {
    // With `required`, blank is refused locally and never travels.
    const withRequired = [];
    const strict = createForm({
      name: field("x", [required(), minLength(3)], serverValidator(async (value) => {
        withRequired.push(value);
        return null;
      }, { debounceMs: 10 })),
    }, { devWarnings: false });
    await settled();
    withRequired.length = 0;
    for (const value of ["", "ab", "abc"]) {
      strict.f.name.set(value);
      await settled();
    }
    ctx.log.note("what travelled when the field refuses blank and short", { withRequired });

    expectEqual(withRequired, ["abc"], {
      claimIds: ["VAL-005"],
      what: "a value the field's own rules reject was sent to the server",
    });
    strict.destroy();

    // Without `required`, blank is a value the field accepts, so asking about it is the rule holding
    // rather than leaking. The other half of the same boundary.
    const withoutRequired = [];
    const lenient = createForm({
      name: field("x", [minLength(3)], serverValidator(async (value) => {
        withoutRequired.push(value);
        return null;
      }, { debounceMs: 10 })),
    }, { devWarnings: false });
    await settled();
    withoutRequired.length = 0;
    for (const value of ["ab", ""]) {
      lenient.f.name.set(value);
      await settled();
    }
    ctx.log.note("what travelled when the field has no required", { withoutRequired });

    expectEqual(withoutRequired, [""], {
      claimIds: ["VAL-005"],
      what: "a field with no `required` did not treat blank as a value it accepts",
    });
    lenient.destroy();
  },
);

battle(
  {
    claims: ["VAL-005", "REA-002"],
    title: "an answer about a value the field has stopped accepting does not land",
    environments: ["node"],
  },
  async (ctx) => {
    let release = () => {};
    const held = () => new Promise((resolve) => { release = resolve; });
    const asked = [];

    const form = createForm({
      name: field("start", [required(), minLength(3)], serverValidator(async (value) => {
        asked.push(value);
        await held();
        return "the server says no";
      }, { debounceMs: 5 })),
    }, { devWarnings: false });
    await settled();

    form.f.name.set("abc");
    await settled();
    ctx.log.note("a run in flight", { asked, pending: form.state.pending() });

    expectClaim(asked.includes("abc") && form.state.pending() === true, {
      claimIds: ["VAL-005"],
      what: "no run was in flight, so nothing below is about a run being abandoned",
      detail: JSON.stringify({ asked, pending: form.state.pending() }),
    });

    // The value stops being one the field accepts while the server is still thinking.
    form.f.name.set("ab");
    await settled(150);
    const whilePending = {
      pending: form.state.pending(),
      errors: form.errorsFor("name")().map((each) => each.message),
    };
    ctx.log.note("after the value stopped being acceptable", whilePending);

    expectEqual(whilePending.pending, false, {
      claimIds: ["VAL-005"],
      what: "a run about a value the field now rejects was still reported as pending",
    });

    // And the answer arrives.
    release();
    await settled();
    const after = form.errorsFor("name")().map((each) => each.message);
    ctx.log.note("after the server answered about the abandoned value", { after, pending: form.state.pending() });

    expectClaim(!after.includes("the server says no"), {
      claimIds: ["REA-002", "VAL-005"],
      what: "an answer about a value the field had already stopped accepting landed on the field",
      detail: JSON.stringify(after),
    });

    form.destroy();
  },
);

battle(
  {
    claims: ["VAL-005"],
    title: "a dependency re-asks, and a slow server ends in something a user can read",
    environments: ["node"],
  },
  async (ctx) => {
    const asked = [];
    const form = createForm({
      country: field("IT"),
      vat: field("X", [required()], serverValidator(async (value, context) => {
        asked.push({
          value,
          country: context.form.fieldValue("country"),
          path: context.path,
          aborted: context.signal.aborted,
        });
        return null;
      }, { debounceMs: 10, dependsOn: ["country"] })),
    }, { devWarnings: false });
    await settled();
    asked.length = 0;

    form.f.country.set("FR");
    await settled();
    ctx.log.note("what the check saw when a dependency changed", { asked });

    expectEqual(asked, [{ value: "X", country: "FR", path: "vat", aborted: false }], {
      claimIds: ["VAL-005"],
      what: "a dependency change did not re-ask, or the check could not read the dependency it was re-run for",
    });
    form.destroy();

    // A server slower than its own bound ends the run rather than leaving the field pending.
    const slow = createForm({
      n: field("v", [required()], serverValidator(async () => {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return "an answer nobody waited for";
      }, { debounceMs: 5, timeoutMs: 200 })),
    }, { devWarnings: false });
    slow.f.n.set("abc");
    await settled(700);

    const ended = {
      pending: slow.state.pending(),
      valid: slow.state.valid(),
      errors: slow.errorsFor("n")().map((each) => each.message),
    };
    ctx.log.note("after a server slower than its timeout", ended);

    expectEqual(ended.pending, false, {
      claimIds: ["VAL-005"],
      what: "a run past its timeout left the field pending",
    });

    expectClaim(ended.errors.length > 0 && !ended.errors.includes("an answer nobody waited for"), {
      claimIds: ["VAL-005"],
      what: "a timed-out run said nothing, or said what the late answer would have said",
      detail: JSON.stringify(ended),
    });

    slow.destroy();
  },
);
