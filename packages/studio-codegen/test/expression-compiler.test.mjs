/**
 * Compile-to-source, not eval () — each compiled expression is executed
 * here via `new Function("value", "return " + js)` purely as the test's own
 * verification oracle (never how a generated target actually runs it).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { compileExpressionToJs } from "../dist/index.js";

const pathOf = (nodeId) => ({ root: "", items: "items", qty: "items.qty", city: "shipping.city" })[nodeId] ?? nodeId;
const run = (expr, value) => new Function("value", `return (${compileExpressionToJs(expr, pathOf)});`)(value);

test("equals/notEquals compare a NodeRef against a literal", () => {
  const expr = { op: "equals", operands: [{ nodeId: "city" }, "Rome"] };
  assert.equal(run(expr, { shipping: { city: "Rome" } }), true);
  assert.equal(run(expr, { shipping: { city: "Milan" } }), false);
});

test("isEmpty/isNotEmpty handle string, array, null and undefined uniformly", () => {
  const isEmpty = { op: "isEmpty", operand: { nodeId: "items" } };
  assert.equal(run(isEmpty, { items: [] }), true);
  assert.equal(run(isEmpty, { items: [1] }), false);
  assert.equal(run(isEmpty, { items: "" }), true);
  assert.equal(run(isEmpty, { items: null }), true);
  const isNotEmpty = { op: "isNotEmpty", operand: { nodeId: "items" } };
  assert.equal(run(isNotEmpty, { items: [1] }), true);
});

test("lengthAtLeast/lengthAtMost compile checkout's real items.length >= 1 semantics", () => {
  const expr = { op: "lengthAtLeast", operands: [{ nodeId: "items" }, 1] };
  assert.equal(run(expr, { items: [] }), false);
  assert.equal(run(expr, { items: [{ sku: "X" }] }), true);
});

test("greaterThan/lessThan compare a NodeRef against a literal number", () => {
  assert.equal(run({ op: "greaterThan", operands: [{ nodeId: "qty" }, 0] }, { items: { qty: 2 } }), true);
  assert.equal(run({ op: "lessThan", operands: [{ nodeId: "qty" }, 0] }, { items: { qty: 2 } }), false);
});

test("matches compiles a portable pattern string into a RegExp, never a bare literal", () => {
  const expr = { op: "matches", operands: [{ nodeId: "city" }, "^\\d{5}$"] };
  const js = compileExpressionToJs(expr, pathOf);
  assert.match(js, /new RegExp\(/);
  assert.equal(run(expr, { shipping: { city: "00100" } }), true);
  assert.equal(run(expr, { shipping: { city: "Rome" } }), false);
});

test("and/or/not compose sub-expressions, including nested ones", () => {
  const notEmpty = { op: "isNotEmpty", operand: { nodeId: "items" } };
  const cityRome = { op: "equals", operands: [{ nodeId: "city" }, "Rome"] };
  assert.equal(run({ op: "and", operands: [notEmpty, cityRome] }, { items: [1], shipping: { city: "Rome" } }), true);
  assert.equal(run({ op: "and", operands: [notEmpty, cityRome] }, { items: [], shipping: { city: "Rome" } }), false);
  assert.equal(run({ op: "or", operands: [notEmpty, cityRome] }, { items: [], shipping: { city: "Rome" } }), true);
  assert.equal(run({ op: "not", operand: notEmpty }, { items: [] }), true);
});

test("a root NodeRef (empty-string path) resolves to the whole value object, not a property of it", () => {
  const expr = { op: "isNotEmpty", operand: { nodeId: "root" } };
  assert.equal(compileExpressionToJs(expr, pathOf).includes("value["), false);
});

test("a value outside the operand type is refused rather than printed", () => {
  // A condition is compiled into source a consumer builds, and a literal operand was printed with
  // `String(operand)`. An array is its own join, so `["globalThis.taken = 1"]` reached the emitted
  // expression unquoted: `value["a"] === globalThis.taken = 1`, an assignment in generated code
  // decided by a project file. An object gave `[object Object]` — the same defect, failing loudly.
  const condition = (operand) => ({ op: "equals", operands: [{ nodeId: "nd_a" }, operand] });

  for (const operand of [["globalThis.taken = 1"], { toString: () => "1 + 1" }, () => "x", Symbol("s")]) {
    assert.throws(
      () => compileExpressionToJs(condition(operand), () => "a"),
      /not one of the kinds a condition may hold/,
      `${String(operand)} was printed instead of refused`,
    );
  }

  // NaN and Infinity have a number's type and are not values a condition can hold.
  assert.throws(() => compileExpressionToJs(condition(Number.NaN), () => "a"), /not a value a condition can hold/);
  assert.throws(() => compileExpressionToJs(condition(Number.POSITIVE_INFINITY), () => "a"), /not a value a condition can hold/);
});

test("the four kinds a condition does hold compile exactly as they did", () => {
  // The boundary: a string operand is a string literal, properly escaped, and the rest compile to
  // themselves. A fix that reached further would rewrite conditions that were always correct.
  const compiled = (operand) =>
    compileExpressionToJs({ op: "equals", operands: [{ nodeId: "nd_a" }, operand] }, () => "a");

  assert.equal(compiled("1; globalThis.taken = 1"), 'value["a"] === "1; globalThis.taken = 1"');
  assert.equal(compiled(42), 'value["a"] === 42');
  assert.equal(compiled(-0.5), 'value["a"] === -0.5');
  assert.equal(compiled(true), 'value["a"] === true');
  assert.equal(compiled(null), 'value["a"] === null');
});
