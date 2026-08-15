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
    // No renderer needed for this half. The guard's job is to answer whether a value is one of the
    // offered ones; with a duplicate, "yes" does not say which.
    const guard = oneOf(PLANS.map((option) => option.value));
    const matching = PLANS.filter((option) => option.value === "pro");
    ctx.log.note("what one accepted value names", { accepted: guard("pro").length === 0, matching });

    // The control: the guard works at all.
    expectClaim(guard("enterprise").length > 0, {
      claimIds: ["SEC-001"],
      what: "the guard accepts a value that was never offered, which is a different finding",
    });

    expectEqual(matching.length, 1, {
      claimIds: ["DYN-001"],
      what: "a value the form accepts names more than one option, so neither the control nor the submission can say which was chosen",
      detail: JSON.stringify(matching),
    });
  },
);
