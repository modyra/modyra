/**
 * A rule pointed at something the document has, and a refusal that says it has not.
 *
 * A rule names a `target` and a `when.field`. The published schema puts no restriction on either —
 * `"target": { "type": "string" }`, no description, and no guide sentence anywhere about what a rule
 * may point at. The parser is stricter than that: a target inside a collection, or a collection
 * itself, is refused.
 *
 * Refusing may well be right — a rule that hid one row's cell would have to say which row. What is
 * wrong is what the author is told. `MDY_DYNAMIC_INVALID_RULE` carries one message for every case:
 *
 *     rule has an unsupported effect/operator or references an unknown field.
 *
 * For `target: "rows"`, where `rows` is declared four lines up in the same document, that sentence is
 * false in all three of its branches. The effect is supported, the operator is supported, and the
 * field is not unknown — it is a collection, which is the one thing the sentence does not offer. An
 * author reads it and goes looking for a typo that is not there, which is finding 26's shape arriving
 * at a different door.
 *
 * The battle accepts either repair: keep the rule, or keep refusing it and say why. It asks only that
 * a name the document declares is not reported as one it does not.
 */

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const leaf = { node: "field", field: { kind: "text", label: "L" } };

/** A document declaring a top-level field, a collection, and a cell inside it. */
const schema = () => ({
  node: "group",
  children: {
    top: leaf,
    rows: { node: "record", label: "R", item: { node: "group", children: { c: leaf } } },
  },
});

const ruleTargeting = (target) => ({
  version: 3,
  schema: schema(),
  rules: [{ effect: "hidden", target, when: { field: "top", operator: "equals", value: "x" } }],
});

/** Names this document declares, and one it does not. */
const DECLARED = Object.freeze(["top", "rows", "rows.c"]);
const ABSENT = "NOTHERE";

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "a rule refused for a name the document declares does not call that name unknown",
    environments: ["node"],
  },
  async (ctx) => {
    // The control at one end: a rule on a top-level field is kept, so the parser does accept rules.
    const kept = parseDynamicForm(ruleTargeting("top"), { mode: "strict" });
    expectEqual((kept.rules ?? []).length, 1, {
      claimIds: ["DYN-001"],
      what: "a rule targeting an ordinary field was not kept, so this battle cannot tell a refusal from a parser that keeps no rules",
      detail: JSON.stringify((kept.diagnostics ?? []).map((each) => each.code)),
    });

    // The control at the other: a name the document really does not have is refused, and saying it is
    // unknown is right there.
    const absent = parseDynamicForm(ruleTargeting(ABSENT), { mode: "strict" });
    expectClaim((absent.diagnostics ?? []).length > 0, {
      claimIds: ["DYN-003"],
      what: "a rule targeting a name nothing declares was accepted, so the refusal below is not about names at all",
    });

    const misnamed = [];
    for (const target of DECLARED) {
      const parsed = parseDynamicForm(ruleTargeting(target), { mode: "strict" });
      const said = (parsed.diagnostics ?? []).map((each) => ({ code: each.code, message: each.message ?? "" }));
      const survived = (parsed.rules ?? []).length > 0;
      ctx.log.note("a rule pointed at a name the document declares", { target, survived, said });

      if (survived) continue;
      // Refusing is allowed. Telling the author the name is unknown, when the document declares it,
      // is not.
      if (said.some((each) => /unknown field/i.test(each.message))) {
        misnamed.push({ target, said });
      }
    }

    expectEqual(misnamed, [], {
      claimIds: ["DYN-001", "DYN-003"],
      what: "a rule was refused with a message calling a name unknown that the same document declares",
    });
  },
);
