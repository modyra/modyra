/**
 * A slot the parser guards and nothing reads.
 *
 * The Dynamic Form Contract has a `rules` array, and the type says what one is for: *a rule fires an
 * effect on a field it names*. Four effects — `visible`, `hidden`, `enabled`, `disabled` — over ten
 * operators. The guide for generated documents carries one in its worked example, which is the
 * document a model writes against.
 *
 * The parser treats it as behaviour rather than as opaque data. An effect nobody declared, an
 * operator nobody declared, a target naming a field that does not exist, a condition on a field that
 * does not exist: each is refused with `MDY_DYNAMIC_INVALID_RULE`, and in strict mode the whole
 * document is refused with it. That care is what makes acceptance mean something.
 *
 * Nothing then fires. The rule is returned in its own array, it leaves no mark on the field it names
 * or on the layout that places it, and a form built from the document the parser accepted behaves as
 * though the array were empty — measured in `browser/a-rule-that-fires-on-nothing.spec.ts`.
 *
 * The sibling slot is the control. `validations` arrived in the same contract version, is parsed by
 * the same parser, and has `buildDynamicValidations` to turn it into something the engine runs. The
 * difference between the two is not that one is data and the other is behaviour; both are described
 * as behaviour, and one of them has a way to become it.
 */

import { buildDynamicValidations, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Every effect the contract declares. */
const EFFECTS = Object.freeze(["visible", "hidden", "enabled", "disabled"]);

const document = (rules) => ({
  version: 2,
  id: "invoice",
  fields: [
    {
      name: "customerType",
      kind: "select",
      label: "Type",
      options: [{ value: "person", label: "Person" }, { value: "business", label: "Business" }],
    },
    { name: "vatNumber", kind: "text", label: "VAT number" },
  ],
  layout: [{ kind: "section", id: "identity", children: ["customerType", "vatNumber"] }],
  rules,
});

const ruleFor = (effect) => ({
  effect,
  target: "vatNumber",
  when: { field: "customerType", operator: "equals", value: "business" },
});

battle(
  {
    claims: ["DYN-004", "DYN-001"],
    title: "the parser guards a rule as behaviour and accepts it in the strictest mode there is",
    environments: ["node"],
  },
  async (ctx) => {
    // Refused, one reason at a time. A parser that passed rules through as opaque data would accept
    // all four of these, and the acceptance below would mean nothing.
    const refusals = [
      ["an effect nobody declared", { ...ruleFor("hidden"), effect: "sparkle" }],
      ["an operator nobody declared", { ...ruleFor("hidden"), when: { field: "customerType", operator: "rhymesWith", value: "x" } }],
      ["a target that is not a field", { ...ruleFor("hidden"), target: "nothingCalledThis" }],
      ["a condition on a field that is not there", { ...ruleFor("hidden"), when: { field: "nothingCalledThis", operator: "equals", value: "x" } }],
    ];

    for (const [what, rule] of refusals) {
      const parsed = parseDynamicForm(document([rule]), { mode: "strict" });
      ctx.log.note("a rule the parser will not have", { what, ok: parsed.ok, codes: parsed.diagnostics.map((each) => each.code) });

      expectClaim(parsed.ok === false && parsed.diagnostics.some((each) => each.code === "MDY_DYNAMIC_INVALID_RULE"), {
        claimIds: ["DYN-004"],
        what: `${what} was accepted, so the parser does not read rules as behaviour`,
        detail: JSON.stringify(parsed.diagnostics),
      });
    }

    // And accepted, for every effect the contract declares, with nothing to report.
    for (const effect of EFFECTS) {
      const parsed = parseDynamicForm(document([ruleFor(effect)]), { mode: "strict" });
      ctx.log.note("a rule the parser accepts", { effect, ok: parsed.ok, kept: parsed.rules.length });

      expectClaim(parsed.ok === true && parsed.diagnostics.length === 0 && parsed.rules.length === 1, {
        claimIds: ["DYN-004"],
        what: `a well-formed ${effect} rule was not accepted in strict mode`,
        detail: JSON.stringify(parsed.diagnostics),
      });

      // The document the parser accepted carries the rule nowhere else: not on the field it names,
      // not on the layout that places it. Whatever applies it has only the array to go on.
      const named = parsed.fields.find((each) => each.name === "vatNumber");
      expectEqual(named, { name: "vatNumber", kind: "text", label: "VAT number" }, {
        claimIds: ["DYN-004"],
        what: `a ${effect} rule left a mark on the field it names, so it is not carried only by the array`,
      });
    }
  },
);

battle(
  {
    claims: ["DYN-004"],
    title: "the other slot of the same contract version has a way to become behaviour",
    environments: ["node"],
  },
  async (ctx) => {
    // `validations` is the control: same contract version, same parser, same description as
    // behaviour — and a published function that turns it into what the engine runs.
    const compiled = buildDynamicValidations(
      [{ when: { op: "equals", operands: [{ path: "customerType" }, "business"] }, message: "VAT required", target: "vatNumber" }],
      ["customerType", "vatNumber"],
    );
    ctx.log.note("the sibling slot, compiled", { produced: compiled === null ? null : Object.keys(compiled).length });

    expectClaim(compiled !== null && typeof compiled === "object", {
      claimIds: ["DYN-004"],
      what: "the sibling slot produced nothing, so it is not the control this battle takes it for",
      detail: JSON.stringify(compiled),
    });
  },
);
