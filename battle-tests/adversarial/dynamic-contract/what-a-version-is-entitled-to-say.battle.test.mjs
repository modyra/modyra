/**
 * What each version of the contract is entitled to say, and what happens to the rest.
 *
 * A document declares a version, and the version decides its vocabulary. Version 1 is the bare field
 * list — the same shape as handing the parser an array — and `layout`, `rules` and `validations` are
 * not members of it. Versions 2 and 3 are structured, 3 being 2 plus per-slot placement.
 *
 * That dispatch was never pinned, and not knowing it produced a false finding: documents were built
 * at version 1, every structured member came back empty, and the emptiness was read as the parser
 * discarding rules in silence. It discards nothing — there was nothing there — and at a version that
 * has rules it reports every unusable one by name.
 *
 * So this battle is built around the control that was missing. A valid rule at version 2 must
 * survive, with no diagnostic, before any assertion about a rejected one means anything. An
 * assertion that a bad input produces nothing is worth exactly as much as the proof that a good one
 * produces something.
 *
 * The effects are read from the parser's own vocabulary rather than guessed. `show` is not one of
 * them; `visible` is. Guessing that pair is what made a valid rule and an invalid one look alike.
 */

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const FIELDS = Object.freeze([
  {
    name: "customerType",
    kind: "select",
    label: "Type",
    options: [{ value: "person", label: "Person" }, { value: "business", label: "Business" }],
  },
  { name: "vatNumber", kind: "text", label: "VAT number" },
]);

const LAYOUT = Object.freeze([{ kind: "section", id: "identity", children: ["customerType", "vatNumber"] }]);

/** A rule the contract accepts: one of the four declared effects, over a field that exists. */
const GOOD_RULE = Object.freeze({
  effect: "visible",
  target: "vatNumber",
  when: { field: "customerType", operator: "equals", value: "business" },
});

const codesOf = (parsed) => parsed.diagnostics.map((each) => each.code);

battle(
  {
    claims: ["DYN-003", "DYN-001"],
    title: "a structured document keeps its rule, and every version says what it could not use",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, and the one whose absence produced a false finding: a good rule survives, whole,
    // with nothing reported. Every assertion below is about a refusal, and a refusal means nothing
    // unless acceptance is demonstrated first.
    const whole = parseDynamicForm({ version: 2, id: "invoice", fields: FIELDS, layout: LAYOUT, rules: [GOOD_RULE] });
    ctx.log.note("a structured document the parser accepts", {
      ok: whole.ok, fields: whole.fields.length, rules: whole.rules.length, diagnostics: codesOf(whole),
    });

    expectEqual([whole.ok, whole.fields.length, whole.rules.length, codesOf(whole)], [true, 2, 1, []], {
      claimIds: ["DYN-001"],
      what: "a valid structured document did not survive whole, so nothing below is a measurement of refusal",
    });

    // A rule the contract cannot use, at a version that has rules: named and counted.
    for (const [what, rule] of [
      ["an effect outside the four", { ...GOOD_RULE, effect: "explode" }],
      ["an operator outside the declared set", { ...GOOD_RULE, when: { ...GOOD_RULE.when, operator: "teleports" } }],
      ["a target naming no field", { ...GOOD_RULE, target: "ghost" }],
      ["a condition reading no field", { ...GOOD_RULE, when: { ...GOOD_RULE.when, field: "ghost" } }],
    ]) {
      const parsed = parseDynamicForm({ version: 2, id: "invoice", fields: FIELDS, layout: LAYOUT, rules: [rule] });
      ctx.log.note("a rule the parser refuses", { what, kept: parsed.rules.length, diagnostics: codesOf(parsed) });

      expectEqual([parsed.rules.length, codesOf(parsed)], [0, ["MDY_DYNAMIC_INVALID_RULE"]], {
        claimIds: ["DYN-003"],
        what: `${what} was not refused and named`,
      });

      expectClaim(parsed.rejectedCount > 0, {
        claimIds: ["DYN-003"],
        what: `${what} was refused without being counted`,
        detail: () => JSON.stringify({ rejectedCount: parsed.rejectedCount, ok: parsed.ok }),
      });
    }

    // Version 1 is the bare field list. Members outside its vocabulary are not silently dropped:
    // each is reported as belonging to a version this document did not declare.
    const legacy = parseDynamicForm({ version: 1, id: "invoice", fields: FIELDS, layout: LAYOUT, rules: [GOOD_RULE] });
    ctx.log.note("a flat document carrying structured members", {
      fields: legacy.fields.length, rules: legacy.rules.length, diagnostics: codesOf(legacy),
    });

    expectEqual(legacy.fields.length, 2, {
      claimIds: ["DYN-001"],
      what: "a version 1 document lost the fields that are its whole vocabulary",
    });

    expectEqual(codesOf(legacy), ["MDY_DYNAMIC_UNSUPPORTED_VERSION", "MDY_DYNAMIC_UNSUPPORTED_VERSION"], {
      claimIds: ["DYN-003"],
      what: "a version 1 document dropped its layout and rules without saying they belong to another version",
    });

    // And the same document with nothing outside its vocabulary says nothing, so the two diagnostics
    // above are the members rather than the version.
    expectEqual(codesOf(parseDynamicForm({ version: 1, id: "invoice", fields: FIELDS })), [], {
      claimIds: ["DYN-003"],
      what: "a version 1 document carrying only fields was reported against anyway",
    });

    // A version the parser does not know is refused whole rather than degraded quietly.
    for (const version of ["2", null, undefined, 2.5, 0]) {
      const unknown = parseDynamicForm({ version, id: "invoice", fields: FIELDS });
      expectEqual([unknown.ok, unknown.fields.length, codesOf(unknown)], [false, 0, ["MDY_DYNAMIC_UNSUPPORTED_VERSION"]], {
        claimIds: ["DYN-003"],
        what: `a document declaring version ${JSON.stringify(version)} was not refused as unsupported`,
      });
    }
  },
);
