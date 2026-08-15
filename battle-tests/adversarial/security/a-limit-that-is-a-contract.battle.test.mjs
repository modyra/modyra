/**
 * The expression depth limit, and what happens past it.
 *
 * `MDY_MAX_EXPRESSION_DEPTH` is 32 and `validateExpression` refuses anything deeper, so a document
 * carrying one is rejected at parse time with `MDY_DYNAMIC_INVALID_VALIDATION`. That is a limit on
 * what a *document* may say.
 *
 * It is not a safety limit, and the difference matters because `evaluateExpression` is exported: a
 * consumer can build an expression themselves and hand it over without ever validating it. If the
 * evaluator walked recursively, a nesting past the engine's stack would be a crash a document author
 * could arrange — and the guard would be in the wrong place, because the document was refused and the
 * direct caller was not.
 *
 * It does not. A hundred thousand levels evaluate without throwing and without measurable time, which
 * says the walk is iterative rather than recursive. That is the property worth holding: a refactor to
 * a recursive walk would turn a limit that is a contract into a limit that is load-bearing, and
 * nothing else would notice.
 */

import { MDY_MAX_EXPRESSION_DEPTH, evaluateExpression, expressionPaths, validateExpression } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** An expression nested `depth` levels deep in `and`. */
function nested(depth) {
  let expression = { op: "equals", operands: [{ path: "a" }, 1] };
  for (let level = 0; level < depth; level += 1) expression = { op: "and", operands: [expression] };
  return expression;
}

/** How deep it actually is, so the battle is not asserting against a shape it failed to build. */
function depthOf(expression) {
  let depth = 0;
  let node = expression;
  while (node?.op === "and") {
    depth += 1;
    node = node.operands[0];
  }
  return depth;
}

battle(
  {
    claims: ["SEC-004", "DYN-003"],
    title: "the depth limit refuses a document and does not decide what a caller may evaluate",
    environments: ["node"],
  },
  async (ctx) => {
    // The limit, at its edge.
    expectEqual(
      [validateExpression(nested(MDY_MAX_EXPRESSION_DEPTH), "probe").length, validateExpression(nested(MDY_MAX_EXPRESSION_DEPTH + 1), "probe").length > 0],
      [0, true],
      {
        claimIds: ["DYN-003"],
        what: `validation does not refuse exactly past ${MDY_MAX_EXPRESSION_DEPTH}, so the limit is not where it says it is`,
      },
    );

    // And past it, by a lot, through the two functions a caller can reach directly.
    const deep = nested(100_000);
    expectEqual(depthOf(deep), 100_000, {
      claimIds: ["SEC-004"],
      what: "the deep expression was not built as deep as this battle thinks, so nothing below is measured",
    });

    const started = Date.now();
    let answered = null;
    let threw = null;
    try {
      answered = evaluateExpression(deep, { a: 1 });
    } catch (error) {
      threw = `${error.constructor.name}: ${error.message}`;
    }
    const elapsed = Date.now() - started;
    ctx.log.note("a hundred thousand levels, evaluated", { answered, threw, ms: elapsed });

    expectClaim(threw === null, {
      claimIds: ["SEC-004"],
      what: "evaluating a deeply nested expression threw — a recursive walk turns a contract limit into a load-bearing one, and a caller who did not validate gets the crash",
      detail: String(threw),
    });

    expectEqual(answered, true, {
      claimIds: ["SEC-004"],
      what: "a deeply nested expression evaluated to something other than what its innermost comparison says",
    });

    // The same for the walk that collects paths, which a caller reaches just as directly.
    let pathsThrew = null;
    try {
      expressionPaths(deep);
    } catch (error) {
      pathsThrew = `${error.constructor.name}`;
    }
    expectClaim(pathsThrew === null, {
      claimIds: ["SEC-004"],
      what: "collecting the paths of a deeply nested expression threw",
      detail: String(pathsThrew),
    });
  },
);
