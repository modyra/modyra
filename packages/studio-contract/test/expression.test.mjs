/**
 * The boundary where a Studio node id becomes a contract path — and the check that moving the
 * evaluator into core did not leave two implementations of one expression tree.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateExpression } from "@modyra/core";
import { compileExpressionToJs } from "../../studio-codegen/dist/index.js";
import { toContractExpression, UnresolvedNodeError } from "../dist/index.js";

const PATHS = new Map([
  ["root", ""],
  ["items", "items"],
  ["qty", "items.qty"],
  ["city", "shipping.city"],
]);

test("a node reference becomes the path it resolves to", () => {
  assert.deepEqual(
    toContractExpression({ op: "equals", operands: [{ nodeId: "city" }, "Rome"] }, PATHS),
    { op: "equals", operands: [{ path: "shipping.city" }, "Rome"] },
  );
});

test("the singular `operand` spelling is normalised to `operands`", () => {
  assert.deepEqual(
    toContractExpression({ op: "isEmpty", operand: { nodeId: "items" } }, PATHS),
    { op: "isEmpty", operands: [{ path: "items" }] },
  );
});

test("nesting is translated all the way down, and literals are left alone", () => {
  const studio = {
    op: "and",
    operands: [
      { op: "notEquals", operands: [{ nodeId: "city" }, "Rome"] },
      { op: "or", operands: [{ op: "isEmpty", operand: { nodeId: "items" } }, true, null, 7] },
    ],
  };
  assert.deepEqual(toContractExpression(studio, PATHS), {
    op: "and",
    operands: [
      { op: "notEquals", operands: [{ path: "shipping.city" }, "Rome"] },
      { op: "or", operands: [{ op: "isEmpty", operands: [{ path: "items" }] }, true, null, 7] },
    ],
  });
});

test("a reference to a deleted node is refused, not quietly turned into a path that reads nothing", () => {
  // Compiling it to some plausible path would produce a condition that silently never fires, which
  // is the failure mode this exists to prevent.
  assert.throws(
    () => toContractExpression({ op: "isEmpty", operand: { nodeId: "gone" } }, PATHS),
    (error) => error instanceof UnresolvedNodeError && error.nodeId === "gone",
  );
});

test("the root node resolves to the empty path, which reads the whole value", () => {
  const translated = toContractExpression({ op: "isNotEmpty", operand: { nodeId: "root" } }, PATHS);
  assert.deepEqual(translated, { op: "isNotEmpty", operands: [{ path: "" }] });
  assert.equal(evaluateExpression(translated, { a: 1 }), true);
});

/**
 * The falsification for relocating the evaluator into core.
 *
 * There are two implementations of these operators: core interprets the tree directly, and
 * `studio-codegen` prints it as JavaScript source for a generated target. Two implementations of one
 * semantics is exactly the defect this move risked introducing, so they are run against the same
 * inputs and required to agree — a divergence means a generated form validates differently from the
 * one the designer previewed.
 */
test("core's interpreter and studio-codegen's compiler agree, operator by operator", () => {
  const pathOf = (nodeId) => PATHS.get(nodeId) ?? nodeId;
  const run = (expr, value) => new Function("value", `return (${compileExpressionToJs(expr, pathOf)});`)(value);

  const cases = [
    [{ op: "equals", operands: [{ nodeId: "city" }, "Rome"] }, { shipping: { city: "Rome" } }],
    [{ op: "equals", operands: [{ nodeId: "city" }, "Rome"] }, { shipping: { city: "Milan" } }],
    [{ op: "notEquals", operands: [{ nodeId: "city" }, "Rome"] }, { shipping: { city: "Milan" } }],
    [{ op: "isEmpty", operand: { nodeId: "items" } }, { items: [] }],
    [{ op: "isEmpty", operand: { nodeId: "items" } }, { items: [1] }],
    [{ op: "isEmpty", operand: { nodeId: "items" } }, { items: "" }],
    [{ op: "isEmpty", operand: { nodeId: "items" } }, { items: null }],
    [{ op: "isEmpty", operand: { nodeId: "items" } }, {}],
    [{ op: "isNotEmpty", operand: { nodeId: "items" } }, { items: [1] }],
    // Every comparison is exercised **on its boundary** as well as either side of it. Without the
    // equal case, `<` and `<=` produce identical answers and a swapped operator goes unnoticed —
    // which is exactly what happened when this check was first written.
    [{ op: "lengthAtLeast", operands: [{ nodeId: "items" }, 1] }, { items: [1] }],
    [{ op: "lengthAtLeast", operands: [{ nodeId: "items" }, 1] }, { items: [] }],
    [{ op: "lengthAtLeast", operands: [{ nodeId: "items" }, 2] }, { items: [1, 2, 3] }],
    [{ op: "lengthAtMost", operands: [{ nodeId: "items" }, 2] }, { items: [1, 2] }],
    [{ op: "lengthAtMost", operands: [{ nodeId: "items" }, 2] }, { items: [1] }],
    [{ op: "lengthAtMost", operands: [{ nodeId: "items" }, 2] }, { items: [1, 2, 3] }],
    [{ op: "greaterThan", operands: [{ nodeId: "qty" }, 2] }, { items: { qty: 3 } }],
    [{ op: "greaterThan", operands: [{ nodeId: "qty" }, 2] }, { items: { qty: 2 } }],
    [{ op: "greaterThan", operands: [{ nodeId: "qty" }, 2] }, { items: { qty: 1 } }],
    [{ op: "lessThan", operands: [{ nodeId: "qty" }, 2] }, { items: { qty: 1 } }],
    [{ op: "lessThan", operands: [{ nodeId: "qty" }, 2] }, { items: { qty: 2 } }],
    [{ op: "lessThan", operands: [{ nodeId: "qty" }, 2] }, { items: { qty: 3 } }],
    [{ op: "matches", operands: [{ nodeId: "city" }, "^Ro"] }, { shipping: { city: "Rome" } }],
    [{ op: "matches", operands: [{ nodeId: "city" }, "^Ro"] }, { shipping: { city: "Milan" } }],
    [{ op: "not", operand: { op: "isEmpty", operand: { nodeId: "items" } } }, { items: [1] }],
    [
      { op: "and", operands: [{ op: "isNotEmpty", operand: { nodeId: "items" } }, { op: "greaterThan", operands: [{ nodeId: "qty" }, 0] }] },
      { items: [1], "items.qty": 1 },
    ],
    [
      { op: "or", operands: [{ op: "isEmpty", operand: { nodeId: "items" } }, { op: "equals", operands: [{ nodeId: "city" }, "Rome"] }] },
      { items: [], shipping: { city: "Milan" } },
    ],
  ];

  for (const [studio, value] of cases) {
    const interpreted = evaluateExpression(toContractExpression(studio, PATHS), value);
    const compiled = run(studio, value);
    assert.equal(
      interpreted,
      compiled,
      `disagreement on ${JSON.stringify(studio)} against ${JSON.stringify(value)}: core says ${interpreted}, codegen says ${compiled}`,
    );
  }
});
