/**
 * A rule about a field nobody declared, and a Submit button that stops working.
 *
 * The doors that take a name the schema does not have mostly ignore it. This one accepts it, and the
 * consequence runs the other way: `addValidators("emial", [required()])` — one letter transposed —
 * registers a field, attaches a rule to it, and the rule can never be satisfied because nothing
 * renders a control for a path the schema never declared.
 *
 * `state.valid()` goes false. `canSubmit()` goes false. `submit()` never calls its callback. The
 * error exists, on a path no control is bound to, so the page shows a filled-in form with a Submit
 * that does nothing and no message anywhere. Nothing is reported, `devWarnings: true` included.
 *
 * There is a way out, and it is the shape of the problem: `removeField("emial")` restores the form.
 * `removeValidators` cannot, because it takes a key and `addValidators` never had one — the keyed
 * pair `upsertValidators`/`removeValidators` does undo itself, and is asserted here as the control,
 * on a path the schema declares. So the repair requires knowing the ghost path is there, which is the
 * one thing nobody was told.
 *
 * Either repair closes this: refuse the name where it arrives, or leave the form able to be sent. The
 * control sits on a declared path so that it keeps holding under either one.
 *
 * VAL-003 is the claim: hidden or unmounted controls do not alter validation semantics. A field that
 * is not in the schema at all is the limit of unmounted, and it decides whether the form can be sent.
 */

import { createForm, field, required } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 50));

/** Run `act` and collect whatever reaches either console channel. */
function saying(act) {
  const said = [];
  const realWarn = console.warn;
  const realError = console.error;
  console.warn = (...parts) => said.push(parts.join(" "));
  console.error = (...parts) => said.push(parts.join(" "));
  try {
    act();
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
    claims: ["VAL-003", "API-001"],
    title: "a rule attached to a name the schema does not have cannot stop the form being sent",
    environments: ["node"],
  },
  async (ctx) => {
    // The first control: the same call on the field that exists does what it is for, and a value
    // satisfies it. Whatever happens below is about the name rather than about the method.
    const real = createForm({ email: field("") }, { devWarnings: true });
    real.addValidators("email", [required()]);
    await settled();
    const emptyAndInvalid = real.state.valid();
    real.f.email.set("someone@example.com");
    await settled();
    ctx.log.note("the same call on a field that exists", {
      whileEmpty: emptyAndInvalid,
      onceFilled: real.state.valid(),
    });

    expectEqual([emptyAndInvalid, real.state.valid()], [false, true], {
      claimIds: ["VAL-003"],
      what: "addValidators did not make an empty required field invalid and a filled one valid",
    });
    real.destroy();

    // The second control: the keyed pair undoes itself, which is what `addValidators` cannot do. It is
    // asserted on a *declared* path, because whether either call reaches an undeclared one is the
    // question this battle asks rather than something it may lean on.
    const keyed = createForm({ email: field("") }, { devWarnings: false });
    keyed.upsertValidators("email", "mine", [required()]);
    await settled();
    const brokenByKeyed = keyed.state.valid();
    keyed.removeValidators("email", "mine");
    await settled();
    ctx.log.note("the keyed pair, put on a declared field and taken off again", {
      afterUpsert: brokenByKeyed,
      afterRemove: keyed.state.valid(),
    });

    expectEqual([brokenByKeyed, keyed.state.valid()], [false, true], {
      claimIds: ["API-001"],
      what: "the keyed pair did not undo itself on a declared path, so there is no working comparison for the one below",
    });
    keyed.destroy();

    // And the call itself. A form somebody filled in correctly, and one transposed letter.
    const form = createForm({ email: field("someone@example.com") }, { devWarnings: true });
    const before = { valid: form.state.valid(), canSubmit: form.state.canSubmit() };
    const said = saying(() => form.addValidators("emial", [required()]));
    await settled();

    let submitted = "the callback never ran";
    await form.submit((value) => {
      submitted = value;
    });

    ctx.log.note("a form after one transposed letter", {
      before,
      after: { valid: form.state.valid(), canSubmit: form.state.canSubmit() },
      submitted,
      errorsOnTheGhost: form.errorsFor("emial")().map((each) => each.message),
      said,
    });

    // The premise: the form was fine, so what follows is the call rather than the form.
    expectEqual(before, { valid: true, canSubmit: true }, {
      claimIds: ["VAL-003"],
      what: "the form was not submittable before the call, so this battle proves nothing about it",
    });

    // Either repair closes this: refuse the name at the call, or leave the form able to be sent.
    // What it refuses is the third thing — a Submit that stops working with nothing said anywhere.
    const stillSendable = form.state.canSubmit() === true;
    expectClaim(said.length > 0 || stillSendable, {
      claimIds: ["VAL-003", "API-001"],
      what: "a rule on a name the schema does not have made the form unsendable, without a word",
      detail: `canSubmit=${form.state.canSubmit()}, submit gave ${JSON.stringify(submitted)}, `
        + `the error sits on "emial" which no control renders`,
    });

    form.destroy();
  },
);
