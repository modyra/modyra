/**
 * Saying "this is the new starting point", from outside.
 *
 * `clearDraft()` re-baselines: after discarding a draft the form's current value becomes what it is
 * compared against, so `getChanges()` is empty. The engine does it through
 * `rebaselineToCurrentValue()`, and the changeset that added it says it was published *because a
 * consumer who saves by another route wants the same thing* — a consumer who PUT the form themselves
 * and now wants the next `getChanges()` to be a diff against what the server has.
 *
 * That consumer holds what `createForm` returned. `rebaselineToCurrentValue` is on the engine and not
 * on it: the form's surface is `activate … undo`, and the engine behind it is `protected`.
 *
 * What the form does offer is `setInitialValue(path, value)`, one leaf at a time — and for a
 * collection that is the same wall finding 168 hit. Naming the collection does nothing; only the full
 * path works, and the row key in it is data the user created. A consumer cannot write the paths of
 * rows that did not exist when they wrote the code.
 *
 * And the inconsistency is inside one family: `setDisabled("rows", …)` takes the collection by name
 * and puts every row out of play. The same string given to `setInitialValue` does nothing at all, in
 * silence. Two path-taking calls on one form, and only one of them reaches a collection.
 *
 * So the capability exists, the call for it exists, and neither is reachable from what a consumer has.
 */

import { buildDynamicFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

const document = {
  node: "group",
  children: {
    who: { node: "field", field: { kind: "text", label: "W" } },
    rows: {
      node: "record",
      item: { node: "group", children: { c: { node: "field", field: { kind: "text", label: "C" } } } },
    },
  },
};

/** A form a user has filled in, including a row they added themselves. */
async function filledByHand() {
  const form = createForm(buildDynamicFormSchema(document), { devWarnings: false });
  form.f.who.set("typed");
  form.f.rows.upsert("row-the-user-added", {});
  await settled();
  form.f.rows.cell("row-the-user-added", "c").set("also typed");
  await settled();
  return form;
}

battle(
  {
    claims: ["PER-002", "API-001"],
    severity: "S2",
    title: "a consumer can say that the form's current value is its new starting point",
    environments: ["node"],
  },
  async (ctx) => {
    const form = await filledByHand();

    // The premise: there is something to re-baseline.
    const before = form.getChanges();
    ctx.log.note("what a consumer would have just sent themselves", { before });

    expectClaim(Object.keys(before).length > 0, {
      claimIds: ["PER-002"],
      what: "the form reports no changes, so there is nothing to re-baseline and nothing below is a measurement",
      detail: () => JSON.stringify(before),
    });

    // The control: the mechanism exists and works, one leaf at a time.
    form.setInitialValue("who", "typed");
    await settled();
    expectClaim(!Object.hasOwn(form.getChanges(), "who"), {
      claimIds: ["API-001"],
      what: "setting a leaf's initial did not stop it being reported as a change, so the mechanism is not what this battle takes it for",
      detail: () => JSON.stringify(form.getChanges()),
    });

    // Naming the collection does nothing, so a consumer cannot re-baseline rows without their keys.
    form.setInitialValue("rows", { "row-the-user-added": { c: "also typed" } });
    await settled();
    const afterNamingTheCollection = form.getChanges();
    ctx.log.note("after naming the collection", { afterNamingTheCollection });

    expectClaim(Object.hasOwn(afterNamingTheCollection, "rows"), {
      claimIds: ["API-001"],
      what: "naming the collection did re-baseline it, so the wall this battle describes is not there",
      detail: () => JSON.stringify(afterNamingTheCollection),
    });

    // And its sibling, which does take an ancestor. Two path-taking calls on one form, one reaching a
    // collection by name and one silently doing nothing with the same string, and neither says so.
    const other = await filledByHand();
    other.setDisabled("rows", () => true);
    await settled();
    const disabledByName = Object.hasOwn(other.submitValue(), "rows");
    ctx.log.note("the same string, given to setDisabled", { stillSubmitted: disabledByName });
    other.destroy();

    expectEqual(disabledByName, false, {
      claimIds: ["API-001"],
      what: "setDisabled does not take a collection by name either, so the inconsistency below is not the one this battle names",
    });

    // And the capability itself: one call that says the current value is the new baseline.
    expectClaim(typeof form.rebaselineToCurrentValue === "function", {
      claimIds: ["API-001", "PER-002"],
      what: "the form a consumer holds has no way to re-baseline itself in one call, and naming a collection through setInitialValue does nothing, so rows a user added can never stop being reported as changes",
      detail: () => JSON.stringify({ afterNamingTheCollection, surface: "setInitialValue is per leaf" }),
    });

    form.destroy();
  },
);
