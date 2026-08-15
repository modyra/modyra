/**
 * A message that ends at its colon.
 *
 * An empty option list is legitimate and stays that way: a select whose choices arrive from somewhere
 * is declared before they land, and until then nothing has been chosen. That case is correct — the
 * field is valid, the form is submittable, and `oneOf` says nothing, because emptiness is `required`'s
 * question and not its own.
 *
 * The case beside it is a restored draft. A choice was saved, the form reopens, the options are still
 * in flight, and the value is measured against a list with nothing in it. It fails, correctly, and
 * says:
 *
 *     Value must be one of:
 *
 * A sentence that ends at its colon. The person reading it is being told their choice is not on a
 * list, and shown no list. Whatever they do next — retype it, pick again, give up — nothing on the
 * page can tell them what would have been accepted.
 *
 * Both halves are asserted, because a repair that fixed the sentence by making an empty list
 * legitimate for any value would break the guard, and one that refused an empty list at declaration
 * would break the select whose choices arrive later.
 */

import { applyFlatValidators, buildFlatFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 50));

/** A form over a flat field list, which is the two-step door a host with its own fields uses. */
function formOver(fields) {
  const form = createForm(buildFlatFormSchema(fields), { devWarnings: false });
  applyFlatValidators(form, fields);
  return form;
}

const selectWith = (options) => [{ name: "s", kind: "select", label: "S", options }];

battle(
  {
    claims: ["UI-004"],
    title: "a refusal that names a list shows the list it names",
    environments: ["node"],
  },
  async (ctx) => {
    // The first control: choices that have not arrived yet leave the field alone. A select declared
    // before its options land must not be failing while it waits.
    const waiting = formOver(selectWith([]));
    await settled();
    ctx.log.note("a select whose choices are still in flight", {
      value: waiting.getValue().s,
      valid: waiting.state.valid(),
    });

    expectClaim(waiting.state.valid() && waiting.state.canSubmit(), {
      claimIds: ["UI-004"],
      what: "a select declared before its options arrived was already failing",
      detail: JSON.stringify(waiting.errorsFor("s")().map((each) => each.message)),
    });
    waiting.destroy();

    // The second control: with options, a refusal names them, so the assertion below is about the
    // empty list rather than about a message that never lists anything.
    const offered = formOver(selectWith([{ value: "a", label: "A" }, { value: "b", label: "B" }]));
    offered.f.s.set("c");
    await settled();
    const named = offered.errorsFor("s")().map((each) => each.message);
    ctx.log.note("a refusal with a list to name", { named });

    expectClaim(named.length > 0 && /\S/.test(named[0].split(":")[1] ?? ""), {
      claimIds: ["UI-004"],
      what: "a refusal did not name the options it was measuring against",
      detail: JSON.stringify(named),
    });
    offered.destroy();

    // And the restored-draft shape: a choice measured against a list that has not arrived.
    const restored = formOver(selectWith([]));
    restored.f.s.set("a");
    await settled();
    const said = restored.errorsFor("s")().map((each) => each.message);
    ctx.log.note("a saved choice against a list with nothing in it", {
      valid: restored.state.valid(),
      said,
    });

    // The premise: it is refused, which is right — nothing is on the list.
    expectEqual(restored.state.valid(), false, {
      claimIds: ["UI-004"],
      what: "a value was accepted against an empty option list",
    });

    // What is asserted is the sentence. A message naming a list has to show one, or say instead that
    // there is nothing to choose from yet.
    expectClaim(said.every((message) => !/:\s*$/.test(message)), {
      claimIds: ["UI-004"],
      what: "a refusal ended at its colon, naming a list it could not show",
      detail: JSON.stringify(said),
    });

    restored.destroy();
  },
);
