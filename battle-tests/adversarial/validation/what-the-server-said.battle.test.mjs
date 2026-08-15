/**
 * A uniqueness check, and the four ways the network answers.
 *
 * `serverValidator(check)` is the ergonomic way to ask a server whether a value is allowed, and the
 * check is the one place in a form where the answer comes from somewhere that can simply fail. Three
 * of its four endings had no battle, and they are the ones that decide whether a form can be sent:
 *
 *   - **it says nothing** — `null`, `undefined` or an empty list — and the field is valid;
 *   - **it says something** — a message or several — and the field carries them;
 *   - **it throws**, because the network was not there, and the field is invalid rather than valid.
 *     A form that shrugged off a failed uniqueness check would submit the duplicate it could not
 *     rule out;
 *   - **it never answers**, and the form stays pending and unsubmittable rather than deciding for
 *     itself.
 *
 * The red is the fifth ending, which is a mistake rather than an outcome: a check that hands back
 * the response instead of a message. `async (value) => (await response.json())` is the ordinary
 * shape of this code and its type is `any`, so the signature does not stop it, and what lands next
 * to the field is `[object Object]`.
 *
 * This package has already written down why that is the worst answer, about option labels: *"a field
 * reading `[object Object]` is worse than a cleared one — cleared is visibly empty, while that looks
 * like a value and gives nothing to act on."* The rule exists; it has not reached here.
 */

import { createForm, field, serverValidator, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 120));

/** A form whose only field asks a server about its value. */
function asking(check) {
  return createForm(
    { name: field("", [], serverValidator(check)) },
    { reactivity: vanillaReactivity(), devWarnings: false },
  );
}

const messages = (form) => form.errorsFor("name")().map((each) => `${each.message}`);

battle(
  {
    claims: ["VAL-001", "SUB-001"],
    title: "a server that cannot answer leaves a form that cannot be sent",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a check that says nothing leaves the field valid, so a form that is invalid below
    // is invalid because of the answer rather than because the check ran at all.
    for (const [what, check] of [
      ["null", async () => null],
      ["undefined", async () => undefined],
      ["an empty list", async () => []],
    ]) {
      const form = asking(check);
      form.f.name.set("ada");
      await settled();
      expectClaim(form.state.valid() && form.state.canSubmit(), {
        claimIds: ["VAL-001"],
        what: `a check that answered ${what} left the field invalid`,
        detail: JSON.stringify(messages(form)),
      });
      form.destroy();
    }

    // A refusal, in both shapes the factory documents.
    for (const [what, check, expected] of [
      ["one message", async () => "already taken", ["already taken"]],
      ["several", async () => ["already taken", "too short"], ["already taken", "too short"]],
    ]) {
      const form = asking(check);
      form.f.name.set("ada");
      await settled();
      expectEqual(messages(form), expected, {
        claimIds: ["VAL-001"],
        what: `a check that answered with ${what} did not put them on the field`,
      });
      form.destroy();
    }

    // The network was not there. Staying valid would mean submitting the duplicate the check could
    // not rule out, so the failure has to land on the field.
    for (const [what, check] of [
      ["threw", async () => { throw new Error("the network is down"); }],
      ["rejected", () => Promise.reject(new Error("the network is down"))],
    ]) {
      const form = asking(check);
      form.f.name.set("ada");
      await settled();
      ctx.log.note("a check that failed", { what, valid: form.state.valid(), messages: messages(form) });

      expectClaim(form.state.valid() === false && form.state.canSubmit() === false, {
        claimIds: ["VAL-001", "SUB-001"],
        what: `a check that ${what} left the form submittable, so a value nobody could check is sent`,
        detail: JSON.stringify(messages(form)),
      });
      form.destroy();
    }

    // And a server that never answers: pending, and not submittable, rather than a form deciding
    // for itself that silence means yes.
    const hanging = asking(() => new Promise(() => {}));
    hanging.f.name.set("ada");
    await settled();
    ctx.log.note("a check that never answered", {
      pending: hanging.state.pending(),
      canSubmit: hanging.state.canSubmit(),
    });

    expectEqual([hanging.state.pending(), hanging.state.canSubmit()], [true, false], {
      claimIds: ["VAL-001", "SUB-001"],
      what: "a form whose server has not answered is submittable, or does not report itself pending",
    });
    hanging.destroy();
  },
);

battle(
  {
    claims: ["VAL-001", "DYN-001"],
    title: "what a failed check puts in front of a person is something a person can read",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a message is rendered as itself.
    const proper = asking(async () => "already taken");
    proper.f.name.set("ada");
    await settled();
    expectEqual(messages(proper), ["already taken"], {
      claimIds: ["VAL-001"],
      what: "a message did not reach the field",
    });
    proper.destroy();

    // `await response.json()` is the ordinary shape of this code and its type is `any`. What comes
    // back is the server's body, and the field shows it.
    for (const [what, check] of [
      ["the response body", async () => ({ code: "TAKEN", field: "name" })],
      ["a list holding one", async () => [{ code: "TAKEN" }]],
    ]) {
      const form = asking(check);
      form.f.name.set("ada");
      await settled();
      const shown = messages(form);
      ctx.log.note("what a wrong-shaped answer renders as", { what, shown });

      expectClaim(!shown.some((message) => message.includes("[object")), {
        claimIds: ["VAL-001", "DYN-001"],
        what: `a check that answered with ${what} put "[object Object]" next to the field`,
        detail: JSON.stringify(shown),
      });

      form.destroy();
    }
  },
);
