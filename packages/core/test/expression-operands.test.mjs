import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateExpression,
  expressionContextKeys,
  isContextRef,
  isRootRef,
  isSelfRef,
} from "../dist/index.js";

/**
 * The three operands a condition can read besides a path, and the questions asked about them.
 *
 * `{path}` names another field; these three name the value the clause is written on
 * (`{@link import("../dist/index.js").MdySelfRef}`), the whole form
 * (`{@link import("../dist/index.js").MdyRootRef}`) and a value the host supplies
 * (`{@link import("../dist/index.js").MdyContextRef}`). Each predicate has to recognise its own
 * shape and refuse the other two: they are read one after another while an expression is walked, so
 * one that answers `true` for a neighbour reads a form value as a context key.
 */
test("each operand predicate recognises its own shape and refuses every other", () => {
  const self = { self: true };
  const root = { root: true };
  const context = { context: "tier" };

  assert.equal(isSelfRef(self), true);
  assert.equal(isRootRef(root), true);
  assert.equal(isContextRef(context), true);

  for (const [predicate, name, mine] of [
    [isSelfRef, "isSelfRef", self],
    [isRootRef, "isRootRef", root],
    [isContextRef, "isContextRef", context],
  ]) {
    for (const other of [self, root, context, { path: "a" }, "a string", null, 42]) {
      if (other === mine) continue;
      assert.equal(predicate(other), false, `${name} accepted ${JSON.stringify(other)}`);
    }
  }
});

/**
 * The context keys a document reads, which is what `requiresContext` is held against.
 *
 * Nested, because a condition is a tree: a key read inside an `and` is read by the document, and a
 * reader that only looked at the top level would let a host arrive without a value the form needs.
 */
test("the context keys an expression reads are reported, however deep they are", () => {
  const nested = {
    op: "and",
    operands: [
      { op: "equals", operands: [{ context: "tier" }, "business"] },
      { op: "equals", operands: [{ context: "region" }, "eu"] },
    ],
  };
  assert.deepEqual([...expressionContextKeys(nested)].sort(), ["region", "tier"]);
  assert.deepEqual([...expressionContextKeys({ op: "isEmpty", operands: [{ path: "a" }] })], []);
});

/**
 * The scope an expression is evaluated in — `{@link import("../dist/index.js").MdyExpressionScope}`
 * — carries the three values those operands read.
 */
test("an expression reads the value it is written on, the whole form and the host's context", () => {
  /** @type {import("../dist/index.js").MdyExpressionScope} */
  const scope = { self: "business", root: { tier: "business", seats: 3 }, context: { tier: "business" } };

  assert.equal(evaluateExpression({ op: "equals", operands: [{ self: true }, "business"] }, {}, scope), true);
  assert.equal(evaluateExpression({ op: "equals", operands: [{ context: "tier" }, "business"] }, {}, scope), true);
  assert.equal(
    evaluateExpression({ op: "greaterThan", operands: [{ root: true, path: "" }, 0] }, {}, scope),
    false,
    "the whole form is not a number, and a comparison against one is false rather than an error",
  );
});
