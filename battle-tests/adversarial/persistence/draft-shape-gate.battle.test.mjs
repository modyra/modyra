/**
 * Two shape-checkers, and which one stands at the draft door.
 *
 * A draft lives where every script on the origin can write it, which the security guide names as the
 * threat model rather than a hypothetical. `draftShapeMatches` is the gate it passes through, and it
 * decides by comparing the stored value against the field's *initial* one.
 *
 * That is weaker than it looks, and deliberately: a field whose initial is `null` — which
 * `MDY_VALUE_CONTRACTS` declares legitimate for `number`, `select`, `radio`, `segmented`,
 * `datepicker` and `timepicker` — carries no shape to compare against, so the gate accepts any JSON
 * value. An object reaches a datepicker. Meanwhile `matchesValueShape` is exported and knows what a
 * datepicker holds, and the gate does not consult it.
 *
 * What makes that a layering rather than a hole is the next layer: the shape alone invalidates.
 * A datepicker holding an object is invalid with no `required` anywhere, so `canSubmit` is false and
 * a consumer following the contract cannot send it. ADR 0009 calls that defence in depth, and this
 * battle exists to make both layers visible — a change to either one, the gate loosening or the
 * validator stopping, is a change to how much protection a hostile draft meets.
 */

import { buildDynamicFormSchema, createForm, draftShapeMatches, field, matchesValueShape } from "@modyra/core";
import { MDY_VALUE_CONTRACTS } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Storage a battle owns, so nothing depends on an environment having one. */
function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

const saved = () => new Promise((resolve) => setTimeout(resolve, 700));
const restored = () => new Promise((resolve) => setTimeout(resolve, 60));

battle(
  {
    claims: ["SEC-001", "PER-001"],
    title: "the draft gate reads the initial value, and the contract knows more than it does",
    environments: ["node"],
  },
  async (ctx) => {
    // What the gate does when the initial says something.
    for (const [initial, accepted, refused] of [
      ["abc", ["x", null], [3, true, [], {}]],
      [3, [7, null], ["x", true, [], {}]],
      [["a"], [[], ["b"], null], ["x", 3, {}]],
      [{ a: 1 }, [{}, { b: 2 }, null], ["x", 3, []]],
    ]) {
      for (const value of accepted) {
        expectClaim(draftShapeMatches(initial, value) === true, {
          claimIds: ["PER-001"],
          what: `the gate refused ${JSON.stringify(value)} against an initial of ${JSON.stringify(initial)}`,
        });
      }
      for (const value of refused) {
        expectClaim(draftShapeMatches(initial, value) === false, {
          claimIds: ["SEC-001"],
          what: `the gate accepted ${JSON.stringify(value)} against an initial of ${JSON.stringify(initial)}`,
        });
      }
    }

    // And what it does when the initial says nothing, which is the case the value contracts make
    // ordinary rather than exotic.
    const nullable = Object.entries(MDY_VALUE_CONTRACTS)
      .filter(([, contract]) => contract.nullable)
      .map(([kind]) => kind);
    ctx.log.note("kinds whose value may legitimately start as null", { nullable });

    expectClaim(nullable.length > 0, {
      claimIds: ["PER-001"],
      what: "no kind declares a nullable value, so the case below is not one a form can be in",
    });

    for (const value of ["x", 3, true, [], {}, ["a"]]) {
      expectClaim(draftShapeMatches(null, value) === true, {
        claimIds: ["PER-001"],
        what: `the gate refused ${JSON.stringify(value)} against an initial that says nothing`,
        detail: "a change here is a tightening, and this battle is where it becomes visible",
      });
    }

    // The checker that does know: exported, and not what the gate calls.
    expectClaim(matchesValueShape("string", 3) === false && matchesValueShape("string", "x") === true, {
      claimIds: ["SEC-001"],
      what: "the value-shape checker does not answer for the shape it is given",
    });
  },
);

battle(
  {
    claims: ["SEC-001", "PER-001", "VAL-003"],
    title: "a hostile draft reaches the model and cannot be submitted from it",
    environments: ["node"],
  },
  async (ctx) => {
    const storage = memoryStorage();
    const document = {
      node: "group",
      children: { when: { node: "field", field: { kind: "datepicker", label: "When" } } },
    };
    const open = () => createForm(buildDynamicFormSchema(document), {
      draft: { key: "hostile", storage },
      devWarnings: false,
    });

    // A legitimate draft first, so the envelope is the engine's own rather than one this battle
    // invented — a hand-built envelope would test the parser rather than the door.
    const honest = open();
    honest.f.when.set("2026-04-03");
    await saved();
    const envelope = JSON.parse(storage.written.get("hostile"));
    honest.destroy();

    expectEqual(envelope.value.when, "2026-04-03", {
      claimIds: ["PER-001"],
      what: "the draft the engine wrote does not hold what was typed",
    });

    // Now the same envelope carrying a value of the **right shape** and the wrong content. A
    // datepicker holds a string, so each of these passes the shape gate — which is the point: the
    // gate is not what stands between a tampered draft and a server, and this battle is about the
    // layer that does.
    //
    // It used to hand the gate an object, an array, a number and a boolean, on the reasoning that a
    // field whose initial is `null` had nothing to compare against and let them through. Finding 223
    // closed that: the gate now reads the kind's declared shape rather than the field's initial, and
    // refuses all four. A battle whose way in has been sealed is measuring nothing, and its own
    // control said so before anything else did.
    for (const hostile of ["not a date at all", "9999-99-99", "2026-04-03T00:00:00Z", "__proto__"]) {
      envelope.value.when = hostile;
      storage.written.set("hostile", JSON.stringify(envelope));

      const form = open();
      await restored();
      ctx.log.note("a draft carrying a value the field's kind can hold and its rules cannot", { hostile, restored: form.getValue().when });

      // The gate lets it through, because a datepicker does hold strings.
      expectEqual(form.getValue().when, hostile, {
        claimIds: ["PER-001"],
        what: "the draft gate refused a value of the kind's own shape, so the layer below is untested",
      });

      // And the layer that does refuse it. This is what stands between a hostile draft and a
      // server: not the gate, the verdict.
      expectClaim(!form.state.valid() && form.state.canSubmit() === false, {
        claimIds: ["SEC-001", "VAL-003"],
        what: `a datepicker restored from a draft holding ${JSON.stringify(hostile)} left the form submittable`,
        detail: JSON.stringify(form.errorsFor("when")()),
      });

      form.destroy();
    }
  },
);
