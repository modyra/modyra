/**
 * Ten operators a document may use, and the six the only published evaluator knows.
 *
 * `spec/dynamic-form-v3.schema.json` closes `rule.when.operator` over ten names. The parser enforces
 * that enum exactly: all ten are accepted, anything else is refused with a diagnostic. A document
 * carrying a rule therefore parses clean, and an author has every reason to think it works.
 *
 * Applying it is, by the guides' own words, the host's part — no renderer applies `rules`. So a host
 * takes the parse result and reaches for the published evaluator, which is `evaluateExpression` and
 * its checker `validateExpression`. Those speak a different vocabulary: `equals`, `notEquals`,
 * `isEmpty`, `isNotEmpty`, `greaterThan`, `lessThan`, `not`, `and`, `or`, `matches`.
 *
 * Four of the enum's ten are not among them — `in`, `notIn`, `greaterThanOrEqual`, `lessThanOrEqual`
 * are rejected by name as unknown operators. Nothing else in the workspace handles them: they appear
 * in the parser and nowhere else, and no package reads a parse result's `rules` at all.
 *
 * A host can still implement them — `in` is a disjunction of equalities, `greaterThanOrEqual` is the
 * negation of `lessThan` — but it has to decide those semantics itself, for operators the contract
 * declares and nothing defines. Two hosts will not decide them the same way, and the contract has no
 * position from which to say which is right.
 *
 * This battle is red on its last assertion. It goes green when every operator the contract offers a
 * document can be answered by something the contract publishes.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { parseDynamicForm, validateExpression } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const SPEC = resolve(HERE, "..", "..", "..", "spec", "dynamic-form-v3.schema.json");

/** The operators a document may write, read from the published schema rather than listed here. */
function declaredOperators() {
  const schema = JSON.parse(readFileSync(SPEC, "utf8"));
  return schema.$defs.rule.properties.when.properties.operator.enum;
}

/** A rule using `operator`, in a document that is otherwise beyond reproach. */
const documentUsing = (operator) => ({
  version: 3,
  fields: [{ name: "a", kind: "text", label: "A" }, { name: "b", kind: "text", label: "B" }],
  rules: [{
    effect: "hidden",
    target: "b",
    when: { field: "a", operator, value: ["in", "notIn"].includes(operator) ? ["x"] : "x" },
  }],
});

/** Whether the published checker accepts an expression built around `operator`. */
function evaluatorKnows(operator) {
  const unary = ["isEmpty", "isNotEmpty"].includes(operator);
  const expression = unary
    ? { op: operator, operands: [{ path: "a" }] }
    : { op: operator, operands: [{ path: "a" }, "x"] };
  const issues = validateExpression(expression, ["a", "b"]);
  return Array.isArray(issues) ? issues.length === 0 : issues === true;
}

battle(
  {
    claims: ["DYN-001", "DYN-002"],
    title: "the operators a document may write are the ones the parser enforces",
    environments: ["node"],
  },
  async (ctx) => {
    const declared = declaredOperators();
    ctx.log.note("operators the published schema declares", { declared });

    expectClaim(Array.isArray(declared) && declared.length > 0, {
      claimIds: ["DYN-001"],
      what: "the schema declares no rule operators, so there is nothing to compare against",
      detail: JSON.stringify(declared),
    });

    // Every declared operator is accepted, which is what makes a rule using one look like a rule
    // that works.
    for (const operator of declared) {
      const parsed = parseDynamicForm(documentUsing(operator), { mode: "strict" });
      expectClaim(parsed.ok === true && (parsed.rules ?? []).length === 1, {
        claimIds: ["DYN-001"],
        what: `a document using the declared operator ${JSON.stringify(operator)} was refused`,
        detail: JSON.stringify((parsed.diagnostics ?? []).map((each) => each.code)),
      });
    }

    // The control: the enum is enforced rather than ignored, so acceptance above means something.
    const invented = parseDynamicForm(documentUsing("approximately"), { mode: "strict" });
    ctx.log.note("an operator nobody declared", {
      ok: invented.ok,
      diagnostics: (invented.diagnostics ?? []).map((each) => each.code),
    });

    expectClaim(invented.ok === false, {
      claimIds: ["DYN-001"],
      what: "an operator the schema does not declare was accepted, so the enum is not enforced",
    });
  },
);

battle(
  {
    claims: ["DYN-001", "DYN-002"],
    title: "every operator a document may write can be answered by something published",
    environments: ["node"],
  },
  async (ctx) => {
    const declared = declaredOperators();

    // The control: the evaluator is real and does accept operators, so a rejection below is the
    // operator rather than a checker that refuses everything.
    expectClaim(evaluatorKnows("equals") && evaluatorKnows("isEmpty"), {
      claimIds: ["DYN-002"],
      what: "the published expression checker rejects even its own operators, so nothing here is measurable",
    });

    const unanswerable = declared.filter((operator) => !evaluatorKnows(operator));
    ctx.log.note("declared operators the published evaluator does not know", { unanswerable });

    expectEqual(unanswerable, [], {
      claimIds: ["DYN-001", "DYN-002"],
      what: "a document may write operators that nothing published can evaluate, leaving each host to invent their meaning",
      detail: JSON.stringify({ declared, unanswerable }),
    });
  },
);
