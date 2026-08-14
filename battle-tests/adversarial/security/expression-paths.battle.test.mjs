/**
 * A predicate from a document, naming a path the form does not have.
 *
 * `MdyExpression` is how a document says when a section applies. It arrives from a CMS, a model, a
 * saved project — the same places a hostile field name arrives from — and its operands name paths by
 * the same dotted grammar the rest of the engine uses.
 *
 * The engine has a guard for that grammar, and this door consults it: an operand naming `__proto__`,
 * `prototype` or `constructor` is refused where the document is read, omitted from the paths a
 * consumer is told to depend on, and answered as absent if a caller evaluates one anyway — because
 * `evaluateExpression` is exported and can be handed a value nobody validated. The root reference is
 * let through, being the one spelling the field guard refuses that an operand legitimately uses.
 *
 * The depth limit holds alongside it: `MDY_MAX_EXPRESSION_DEPTH` is 32, an expression one level
 * deeper is refused, and one half a million levels deep is refused rather than exhausting the stack.
 * A limit implemented by a walk that overflows before it can report is not a limit.
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

/** Spellings the engine's own path guard refuses, and that name no field a document may declare. */
const REFUSED_ELSEWHERE = Object.freeze(["__proto__", "constructor", "prototype", "a.__proto__.b"]);

/**
 * The empty path is not one of them, though `isSafeFieldPath` refuses it too.
 *
 * It refuses it as a *field* path, and an operand is not one: `MdyPathRef`'s own docblock says
 * `""` is the root value itself, which is how a form-level rule reads the whole object. Treating the
 * field guard as universal was this battle's own mistake, and it is written down here because the
 * two look identical and only one of them is a hostile spelling.
 */
const ROOT = "";

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

    // A predicate naming one of them over an empty form may not find anything: the path names no
    // field a document can declare, so every answer about it has to be an answer about nothing.
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

      // And it is not offered as a dependency: a path the engine will not register is not something
      // a consumer should be told to watch.
      expectClaim(expressionPaths({ op: "equals", operands: [{ path }, 1] }).length === 0, {
        claimIds: ["SEC-001"],
        what: `${JSON.stringify(path)} was reported as a path to depend on`,
      });
    }

    // The root, which the same guard has to let through. A form-level rule reads the whole object
    // this way, and refusing it would take the feature out with the attack.
    const rootRef = { op: "equals", operands: [{ path: ROOT }, 1] };
    expectClaim(validateExpression(rootRef, "document").length === 0, {
      claimIds: ["SEC-001"],
      what: "the root reference was refused along with the hostile spellings",
      detail: JSON.stringify(validateExpression(rootRef, "document")),
    });

    expectClaim(expressionPaths(rootRef).includes(ROOT), {
      claimIds: ["SEC-001"],
      what: "the root reference is not reported as the dependency it is",
      detail: JSON.stringify(expressionPaths(rootRef)),
    });

    // What the root answers is `isEmptyValue`'s contract rather than this battle's to decide: an
    // object is not empty, in the same sentence that makes `0` and `false` answers. So the root of
    // `{}` reads as not-empty. It is stated here because it is surprising and because a change to it
    // would change what `isEmpty` means for every group value in every document.
    expectClaim(evaluateExpression({ op: "isNotEmpty", operand: { path: ROOT } }, {}) === true, {
      claimIds: ["SEC-001"],
      what: "the root of an empty form stopped reading as a value that exists",
    });
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
