/**
 * Two published answers to "what leaves this form", and a field only one of them withholds.
 *
 * `submitValue()` leaves out a field that is out of play. That is VAL-002 and it is stated as a
 * promise about submission: disabled values are retained in edit state and excluded from what is
 * sent, which is why a form can hold a value it must not transmit.
 *
 * `getChanges()` is documented as a *minimal nested patch* — an `Object.is` diff of each leaf against
 * its initial — and the guide talks about it as something a consumer sends, in those words, when a
 * removal is itself something you need to send. It includes the disabled field, because by its own
 * definition the value did change.
 *
 * Each function is right about its own question. The consumer is the one holding two answers: a PATCH
 * built the documented way carries exactly the value the other way withholds, and nothing on either
 * side says the two disagree.
 *
 * It is not the rules feature that does this. A field switched off by a document's rule, one disabled
 * through the handle, and one made inactive all behave the same way, and that is asserted here so a
 * repair aimed at rules alone is visible as one that fixed a third of it.
 */

import { applyDynamicRules, buildDynamicFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

const document = {
  node: "group",
  children: {
    mode: { node: "field", field: { kind: "text", label: "M" } },
    secret: { node: "field", field: { kind: "text", label: "S" } },
  },
};

/** A form holding a typed value in `secret`, with it taken out of play the given way. */
async function outOfPlayBy(how) {
  const form = createForm(buildDynamicFormSchema(document), { devWarnings: false });
  if (how === "a document's rule") {
    applyDynamicRules(form, [{
      effect: "hidden",
      target: "secret",
      when: { field: "mode", operator: "equals", value: "off" },
    }]);
  }
  form.patchValue({ mode: "on", secret: "typed by the user" });
  await settled();

  if (how === "a document's rule") form.patchValue({ mode: "off" });
  if (how === "the handle, disabled") form.setDisabled("secret", () => true);
  if (how === "the handle, inactive") form.setInactive("secret", () => true);
  await settled();

  const seen = {
    submitted: Object.keys(form.submitValue()),
    changed: Object.keys(form.getChanges()),
    stillHeld: form.getValue().secret,
  };
  form.destroy();
  return seen;
}

battle(
  {
    claims: ["VAL-002", "SUB-001"],
    severity: "S2",
    title: "the two published ways to read what a form would send agree about a field out of play",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: with the field in play, both answers carry it. Two functions that never mention
    // it would agree perfectly and prove nothing.
    const inPlay = await outOfPlayBy("nothing");
    ctx.log.note("with the field in play", inPlay);

    expectEqual([inPlay.submitted.includes("secret"), inPlay.changed.includes("secret")], [true, true], {
      claimIds: ["SUB-001"],
      what: "the two readers do not agree even with the field in play, so nothing below is about it being taken out",
    });

    const disagreed = [];
    for (const how of ["a document's rule", "the handle, disabled", "the handle, inactive"]) {
      const seen = await outOfPlayBy(how);
      ctx.log.note("with the field taken out of play", { how, ...seen });

      // The premise for each: the value is still held, which is what VAL-002 promises — retained in
      // edit state — and what makes the disagreement about reading rather than about losing it.
      expectEqual(seen.stillHeld, "typed by the user", {
        claimIds: ["VAL-002"],
        what: `taking the field out of play by ${how} lost the value instead of retaining it`,
      });

      if (seen.submitted.includes("secret") !== seen.changed.includes("secret")) {
        disagreed.push({ how, submitted: seen.submitted, changed: seen.changed });
      }
    }

    expectEqual(disagreed, [], {
      claimIds: ["VAL-002", "SUB-001"],
      what: `${disagreed.length} of 3 ways of taking a field out of play leave submitValue() withholding it and getChanges() carrying it, so a PATCH built the documented way sends what a submission does not`,
      detail: () => JSON.stringify(disagreed),
    });
  },
);
