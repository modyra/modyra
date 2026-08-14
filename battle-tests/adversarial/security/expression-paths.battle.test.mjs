/**
 * A predicate from a document, naming a path the form does not have.
 *
 * `MdyExpression` is how a document says when a section applies. It arrives from a CMS, a model, a
 * saved project — the same places a hostile field name arrives from — and its operands name paths by
 * the same dotted grammar the rest of the engine uses.
 *
 * The engine has a guard for that grammar: `isSafeFieldPath` refuses `__proto__`, `constructor` and
 * the empty string, and every other door consults it. `validateExpression` does not, and evaluation
 * then reads the named path off the form's value with an ordinary property read — so a predicate can
 * ask about a member of `Object.prototype` and get an answer about the prototype rather than about
 * the form.
 *
 * The depth limit, by contrast, holds: `MDY_MAX_EXPRESSION_DEPTH` is 32, an expression one level
 * deeper is refused, and one half a million levels deep is refused too rather than exhausting the
 * stack — which is what makes the reading question the finding rather than the walking one.
 */

import {
  evaluateExpression,
  expressionPaths,
  isSafeFieldPath,
  MDY_MAX_EXPRESSION_DEPTH,
  validateExpression,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

/** Spellings the engine's own path guard refuses. */
const REFUSED_ELSEWHERE = Object.freeze(["__proto__", "constructor", "prototype", "a.__proto__.b", ""]);

const leaf = Object.freeze({ op: "equals", operands: [{ path: "a" }, 1] });

/** Built iteratively: a recursive builder overflows before the module under attack is reached. */
function nest(depth) {
  let expression = leaf;
  for (let level = 0; level < depth; level += 1) {
    expression = { op: "and", operands: [expression, leaf] };
  }
  return expression;
}

battle(
  {
    claims: ["SEC-001"],
    title: "a predicate reads the form's data and not the prototype behind it",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the engine really does refuse these spellings, so the comparison below is between
    // two doors of one system rather than against a rule nobody holds.
    expectClaim(REFUSED_ELSEWHERE.every((path) => !isSafeFieldPath(path)), {
      claimIds: ["SEC-001"],
      what: "the engine's path guard accepts a spelling this battle assumed it refuses",
      detail: JSON.stringify(REFUSED_ELSEWHERE.map((path) => [path, isSafeFieldPath(path)])),
    });

    // A predicate over an empty form may not find anything: an empty object has no cells, and every
    // answer about one has to be an answer about nothing.
    for (const path of REFUSED_ELSEWHERE) {
      const present = evaluateExpression({ op: "isNotEmpty", operand: { path } }, {});
      ctx.log.note("a predicate asking about a path the form does not have", { path, present });

      expectClaim(present === false, {
        claimIds: ["SEC-001"],
        what: `a predicate found ${JSON.stringify(path)} in a form that holds nothing`,
        detail: `isNotEmpty answered ${present}`,
      });
    }

    // And the door itself: an operand naming a path the engine refuses everywhere else is reported
    // where it is written, rather than accepted and answered later.
    for (const path of REFUSED_ELSEWHERE) {
      const issues = validateExpression({ op: "equals", operands: [{ path }, 1] }, "document");
      expectClaim(issues.length > 0, {
        claimIds: ["SEC-001"],
        what: `an operand naming ${JSON.stringify(path)} was accepted where the same path is refused`,
        detail: `${issues.length} issue(s), paths ${JSON.stringify(expressionPaths({ op: "equals", operands: [{ path }, 1] }))}`,
      });
    }
  },
);

battle(
  {
    claims: ["SEC-001"],
    title: "a predicate too deep to evaluate is refused rather than run",
    environments: ["node"],
  },
  async (ctx) => {
    expectClaim(validateExpression(nest(MDY_MAX_EXPRESSION_DEPTH - 1), "document").length === 0, {
      claimIds: ["SEC-001"],
      what: "an expression inside the declared depth was refused",
      detail: `limit ${MDY_MAX_EXPRESSION_DEPTH}`,
    });

    expectClaim(validateExpression(nest(MDY_MAX_EXPRESSION_DEPTH + 1), "document").length > 0, {
      claimIds: ["SEC-001"],
      what: "an expression past the declared depth was accepted",
      detail: `limit ${MDY_MAX_EXPRESSION_DEPTH}`,
    });

    // The guard has to survive the input it exists to refuse. A depth limit implemented by a walk
    // that overflows before it can report is not a limit — it is a way to crash the validator with
    // a document, which is the shape a denial of service takes here.
    const enormous = nest(500_000);
    ctx.log.note("a predicate half a million levels deep", {});

    for (const [name, run] of [
      ["validateExpression", () => validateExpression(enormous, "document").length > 0],
      ["expressionPaths", () => Array.isArray(expressionPaths(enormous))],
      ["evaluateExpression", () => typeof evaluateExpression(enormous, { a: 1 }) === "boolean"],
    ]) {
      let answered = false;
      let raised = null;
      try {
        answered = run();
      } catch (error) {
        raised = `${error.constructor.name}: ${error.message}`;
      }

      expectClaim(raised === null && answered, {
        claimIds: ["SEC-001"],
        what: `${name} did not survive a document deep enough to exhaust the stack`,
        detail: raised ?? `answered ${answered}`,
      });
    }
  },
);
