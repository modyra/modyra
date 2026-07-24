/**
 * Direct interpreter for StudioExpression (ADR-0005) — the live-preview
 * sibling of studio-codegen's compileExpressionToJs, same op semantics,
 * verified independently here rather than only through buildLiveForm.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateExpression } from "../dist/index.js";

const pathOf = (nodeId) => ({ root: "", items: "items", qty: "items.qty", city: "shipping.city" })[nodeId] ?? nodeId;

test("equals/notEquals compare a NodeRef against a literal", () => {
  const expr = { op: "equals", operands: [{ nodeId: "city" }, "Rome"] };
  assert.equal(evaluateExpression(expr, { shipping: { city: "Rome" } }, pathOf), true);
  assert.equal(evaluateExpression(expr, { shipping: { city: "Milan" } }, pathOf), false);
});

test("isEmpty/isNotEmpty handle string, array, null and undefined uniformly", () => {
  const isEmpty = { op: "isEmpty", operand: { nodeId: "items" } };
  assert.equal(evaluateExpression(isEmpty, { items: [] }, pathOf), true);
  assert.equal(evaluateExpression(isEmpty, { items: [1] }, pathOf), false);
  assert.equal(evaluateExpression(isEmpty, { items: "" }, pathOf), true);
  assert.equal(evaluateExpression(isEmpty, { items: null }, pathOf), true);
  const isNotEmpty = { op: "isNotEmpty", operand: { nodeId: "items" } };
  assert.equal(evaluateExpression(isNotEmpty, { items: [1] }, pathOf), true);
});

test("lengthAtLeast/lengthAtMost match checkout's real items.length >= 1 semantics", () => {
  const expr = { op: "lengthAtLeast", operands: [{ nodeId: "items" }, 1] };
  assert.equal(evaluateExpression(expr, { items: [] }, pathOf), false);
  assert.equal(evaluateExpression(expr, { items: [{ sku: "X" }] }, pathOf), true);
});

test("greaterThan/lessThan compare a NodeRef against a literal number", () => {
  assert.equal(evaluateExpression({ op: "greaterThan", operands: [{ nodeId: "qty" }, 0] }, { items: { qty: 2 } }, pathOf), true);
  assert.equal(evaluateExpression({ op: "lessThan", operands: [{ nodeId: "qty" }, 0] }, { items: { qty: 2 } }, pathOf), false);
});

test("matches builds a real RegExp from the portable pattern string", () => {
  const expr = { op: "matches", operands: [{ nodeId: "city" }, "^\\d{5}$"] };
  assert.equal(evaluateExpression(expr, { shipping: { city: "00100" } }, pathOf), true);
  assert.equal(evaluateExpression(expr, { shipping: { city: "Rome" } }, pathOf), false);
});

test("and/or/not compose sub-expressions, including nested ones", () => {
  const notEmpty = { op: "isNotEmpty", operand: { nodeId: "items" } };
  const cityRome = { op: "equals", operands: [{ nodeId: "city" }, "Rome"] };
  assert.equal(evaluateExpression({ op: "and", operands: [notEmpty, cityRome] }, { items: [1], shipping: { city: "Rome" } }, pathOf), true);
  assert.equal(evaluateExpression({ op: "and", operands: [notEmpty, cityRome] }, { items: [], shipping: { city: "Rome" } }, pathOf), false);
  assert.equal(evaluateExpression({ op: "or", operands: [notEmpty, cityRome] }, { items: [], shipping: { city: "Rome" } }, pathOf), true);
  assert.equal(evaluateExpression({ op: "not", operand: notEmpty }, { items: [] }, pathOf), true);
});

test("a root NodeRef (empty-string path) resolves to the whole value object, not a property of it", () => {
  assert.equal(evaluateExpression({ op: "isNotEmpty", operand: { nodeId: "root" } }, { anything: true }, pathOf), true);
  assert.equal(evaluateExpression({ op: "isEmpty", operand: { nodeId: "root" } }, {}, pathOf), false);
});
