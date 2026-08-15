/**
 * Two rules an author wrote as "or", composed as "and".
 *
 * Two rules on one field compose rather than replace, which is the right decision: a binding that
 * replaced would let whichever was written last win in silence. Composition is over *switched off* —
 * a field is out of play if any rule says so — and for the negative effects that is exactly what an
 * author means. `hidden when a is x` and `hidden when a is y` hides it for both and shows it
 * otherwise.
 *
 * The positive effects are the same sentence from the other side: `visible when C` is *off unless C*.
 * Two of those compose to "off unless C₁, or off unless C₂" — on only when **both** hold. An author
 * writing "show this for a business, and also for a charity" has written a field that is never shown
 * to anybody, and no surface says so: the document parses, the form builds, the field renders
 * disabled forever and is never submitted.
 *
 * Each half of the pair is the other's control. The negative form of the same intent composes
 * correctly, and one positive rule on its own behaves correctly, so what fails is the composition of
 * two — not the effect, and not composition itself.
 */

import { applyDynamicRules, buildDynamicFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const document = {
  node: "group",
  children: {
    a: { node: "field", field: { kind: "text", label: "A" } },
    c: { node: "field", field: { kind: "text", label: "C" } },
  },
};

const settled = () => new Promise((resolve) => setTimeout(resolve, 80));

const when = (value) => ({ field: "a", operator: "equals", value });

/** Whether the field the rules name is in play, for each value of the field they read. */
async function inPlayFor(rules) {
  const answers = {};
  for (const value of ["x", "y", "z"]) {
    const form = createForm(buildDynamicFormSchema(document), { devWarnings: false });
    applyDynamicRules(form, rules);
    form.patchValue({ a: value, c: "C" });
    await settled();
    answers[value] = !form.f.c.disabled();
    form.destroy();
  }
  return answers;
}

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    severity: "S1",
    title: "two rules that each show a field show it, rather than hiding it from everybody",
    environments: ["node"],
  },
  async (ctx) => {
    // The first control: one rule of each kind, on its own, does what it says.
    const oneVisible = await inPlayFor([{ effect: "visible", target: "c", when: when("x") }]);
    ctx.log.note("one positive rule", oneVisible);

    expectEqual(oneVisible, { x: true, y: false, z: false }, {
      claimIds: ["DYN-001"],
      what: "a single visible rule does not put the field in play for its own condition, so nothing below is a measurement",
    });

    // The second control: the same intent written negatively composes correctly, so composition
    // itself is not what fails.
    const twoHidden = await inPlayFor([
      { effect: "hidden", target: "c", when: when("x") },
      { effect: "hidden", target: "c", when: when("y") },
    ]);
    ctx.log.note("two negative rules", twoHidden);

    expectEqual(twoHidden, { x: false, y: false, z: true }, {
      claimIds: ["DYN-001"],
      what: "two hidden rules did not compose to hiding for either condition",
    });

    // And the same intent written the way it reads: show it for this, and also for that.
    const twoVisible = await inPlayFor([
      { effect: "visible", target: "c", when: when("x") },
      { effect: "visible", target: "c", when: when("y") },
    ]);
    ctx.log.note("two positive rules", twoVisible);

    expectClaim(twoVisible.x === true || twoVisible.y === true, {
      claimIds: ["DYN-001", "DYN-003"],
      what: "two rules that each say to show a field left it out of play for every value there is",
      detail: JSON.stringify(twoVisible),
    });

    expectEqual(twoVisible, { x: true, y: true, z: false }, {
      claimIds: ["DYN-001"],
      what: "two rules that each show a field for one value do not show it for either",
    });
  },
);
