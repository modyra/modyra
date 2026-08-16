/**
 * A rule the parser throws away, and the silence that follows it out.
 *
 * The Dynamic Form Contract is data from somewhere that is not the application, so the parser's job
 * is to decide what it can accept and to say what it could not. It does exactly that for fields: an
 * unknown kind is dropped, counted in `rejectedCount`, and reported as `MDY_DYNAMIC_UNKNOWN_KIND`.
 * The published lint rule exists to surface those findings at authoring time, and its own
 * description is *"report the Modyra Dynamic Form Contract's diagnostics for a form document written
 * as a literal"*.
 *
 * Rules go out the other way. An effect that is not one of the four, an operator that is not one of
 * the ten, a target naming no field — each is discarded, and `diagnostics` is empty, `rejectedCount`
 * does not move, and `ok` is `true`.
 *
 * So an author who writes `effect: "explode"` gets a form where that field never reacts: nothing at
 * lint time, because there is no diagnostic to report; nothing at parse time; nothing at runtime,
 * because the rule is no longer there to fail. The behaviour they declared is gone and every
 * instrument says the document is fine.
 *
 * The control is the field in the same call. One document carrying both a bad field and a bad rule
 * separates "the parser does not report" from "this parser reports nothing".
 *
 * Filed under DYN-003 alone. DYN-004 is about a slot the parser *accepts* and nothing reads, which is
 * an integrity question and carries its severity; this is a slot the parser *rejects* without saying
 * so, and borrowing that claim would report it a band higher than it is.
 */

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** One of each way a rule can be unusable, each legal JSON and none of them the contract's. */
const UNUSABLE = Object.freeze([
  { what: "an effect the contract does not declare",
    rule: { effect: "explode", target: "x", when: { field: "x", operator: "equals", value: 1 } } },
  { what: "an operator the contract does not declare",
    rule: { effect: "show", target: "x", when: { field: "x", operator: "teleports", value: 1 } } },
  { what: "a target naming no field",
    rule: { effect: "show", target: "ghost", when: { field: "x", operator: "equals", value: 1 } } },
  { what: "a condition reading no field",
    rule: { effect: "show", target: "x", when: { field: "ghost", operator: "equals", value: 1 } } },
]);

const documentWith = (rules, fields = [{ name: "x", kind: "text", label: "X" }]) =>
  ({ version: 1, id: "doc", fields, rules });

battle(
  {
    claims: ["DYN-003"],
    title: "a rule the parser will not keep is one it says it did not keep",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, first and in one call: a field the parser refuses is dropped, counted and named.
    // Without it, an empty `diagnostics` below would say the parser reports nothing at all.
    const mixed = parseDynamicForm(documentWith(
      [UNUSABLE[0].rule],
      [{ name: "x", kind: "text", label: "X" }, { name: "y", kind: "wormhole", label: "Y" }],
    ));
    ctx.log.note("a bad field and a bad rule in one document", {
      fields: mixed.fields.map((each) => each.name),
      rules: mixed.rules.length,
      rejectedCount: mixed.rejectedCount,
      diagnostics: mixed.diagnostics.map((each) => each.code),
    });

    expectEqual(mixed.diagnostics.map((each) => each.code), ["MDY_DYNAMIC_UNKNOWN_KIND"], {
      claimIds: ["DYN-003"],
      what: "the parser did not report the field it dropped, so its reporting is not what this battle is about",
    });

    expectEqual(mixed.rejectedCount, 1, {
      claimIds: ["DYN-003"],
      what: "the parser did not count the field it dropped",
    });

    // And each unusable rule on its own.
    for (const { what, rule } of UNUSABLE) {
      const parsed = parseDynamicForm(documentWith([rule]));
      ctx.log.note("a rule the parser cannot use", {
        what,
        kept: parsed.rules.length,
        ok: parsed.ok,
        rejectedCount: parsed.rejectedCount,
        diagnostics: parsed.diagnostics.map((each) => each.code),
      });

      // The premise: it really is discarded. A rule that survived would be a different question —
      // one about what it does, not about what was said when it went.
      expectEqual(parsed.rules.length, 0, {
        claimIds: ["DYN-003"],
        what: `${what} was kept, so this battle is not measuring a discarded rule`,
      });

      expectClaim(parsed.diagnostics.length > 0, {
        claimIds: ["DYN-003"],
        what: `${what} was discarded and the parser reported nothing`,
        detail: () => JSON.stringify({ ok: parsed.ok, rejectedCount: parsed.rejectedCount }),
      });
    }
  },
);
