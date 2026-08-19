/**
 * Two options that say the same value, and the parser that keeps both.
 *
 * Two fields sharing a name are refused: `MDY_DYNAMIC_DUPLICATE_NAME`, the second dropped, and the
 * reason is that a name builds an id and two ids that collide stop being addressable. An option's
 * value builds an id the same way — `s__option__pro` — and nothing checks it.
 *
 * So a document declaring `[{pro, "Pro monthly"}, {pro, "Pro yearly"}, {lite, "Lite"}]` parses
 * cleanly, keeps three options, and renders two. The browser half of this is in
 * `browser/an-option-that-never-appears.spec.ts`; this half is the parser saying nothing.
 *
 * The value itself is the other half of the damage and needs no renderer to see: `oneOf` accepts
 * `"pro"`, and `"pro"` names two different things. A form holding it cannot say which the person
 * chose, and neither can whatever receives the submission.
 */

import { oneOf, parseDynamicFields, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const PLANS = Object.freeze([
  { value: "pro", label: "Pro monthly" },
  { value: "pro", label: "Pro yearly" },
  { value: "lite", label: "Lite" },
]);

battle(
  {
    claims: ["DYN-003", "DYN-001"],
    title: "a document that offers one value twice is told so",
    open: "reported, not enforced: finding 48, open in battle-tests/reports/open-findings.md",
    environments: ["node"],
  },
  async (ctx) => {
    // The precedent, asserted: a duplicate name is refused, by name, with a code.
    const names = parseDynamicForm(
      { version: 3, fields: [{ name: "a", kind: "text" }, { name: "a", kind: "text" }] },
      { mode: "strict" },
    );
    expectClaim(!names.ok && names.diagnostics.some((each) => each.code === "MDY_DYNAMIC_DUPLICATE_NAME"), {
      claimIds: ["DYN-003"],
      what: "a duplicate field name is not refused, so there is no precedent to hold option values to",
      detail: JSON.stringify(names.diagnostics),
    });

    const options = parseDynamicForm(
      { version: 3, fields: [{ name: "s", kind: "select", label: "Plan", options: [...PLANS] }] },
      { mode: "strict" },
    );
    const kept = parseDynamicFields([{ name: "s", kind: "select", label: "Plan", options: [...PLANS] }]);
    ctx.log.note("what the parser made of two options sharing a value", {
      ok: options.ok,
      codes: options.diagnostics.map((each) => each.code),
      kept: kept[0]?.options?.length,
    });

    expectClaim(!options.ok || options.diagnostics.length > 0, {
      claimIds: ["DYN-003"],
      what: "a document offering one value under two labels parses clean, and the page it builds shows one of them",
      detail: JSON.stringify({ kept: kept[0]?.options }),
    });
  },
);

battle(
  {
    claims: ["DYN-001", "SEC-001"],
    title: "a value a form holds names one option",
    environments: ["node"],
  },
  async (ctx) => {
    // What the form is given, rather than what the document offered: the parser drops a duplicate
    // value and says so, so the options a control renders are the ones to ask the question of.
    const kept = parseDynamicFields([{ name: "s", kind: "select", label: "Plan", options: [...PLANS] }])[0]?.options ?? [];
    const guard = oneOf(kept.map((option) => option.value));
    const matching = kept.filter((option) => option.value === "pro");
    ctx.log.note("what one accepted value names", { offered: PLANS.length, kept: kept.length, accepted: guard("pro").length === 0, matching });

    // Two controls. The guard answers at all, and the value under test is one the form takes —
    // without the second, a parser that dropped *both* copies would satisfy the assertion below by
    // leaving nothing to name.
    expectClaim(guard("enterprise").length > 0, {
      claimIds: ["SEC-001"],
      what: "the guard accepts a value that was never offered, which is a different finding",
    });
    expectClaim(guard("pro").length === 0, {
      claimIds: ["DYN-001"],
      what: "the value the document offered twice is not accepted at all, so the count below is about a value nobody can choose",
      detail: JSON.stringify(kept),
    });

    expectEqual(matching.length, 1, {
      claimIds: ["DYN-001"],
      what: "a value the form accepts names more than one option, so neither the control nor the submission can say which was chosen",
      detail: JSON.stringify(matching),
    });
  },
);
