import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildDynamicValidations,
  createForm,
  evaluateExpression,
  expressionPaths,
  field,
  parseDynamicForm,
  validateExpression,
} from "../dist/index.js";

const value = {
  country: "IT",
  coupon: "",
  total: 120,
  items: ["a", "b"],
  shipping: { city: "Roma", zip: "" },
};

test("operators read the value they are given, by path", () => {
  assert.equal(evaluateExpression({ op: "equals", operands: [{ path: "country" }, "IT"] }, value), true);
  assert.equal(evaluateExpression({ op: "notEquals", operands: [{ path: "country" }, "IT"] }, value), false);
  assert.equal(evaluateExpression({ op: "isEmpty", operand: { path: "coupon" } }, value), true);
  assert.equal(evaluateExpression({ op: "isNotEmpty", operand: { path: "country" } }, value), true);
  assert.equal(evaluateExpression({ op: "greaterThan", operands: [{ path: "total" }, 100] }, value), true);
  assert.equal(evaluateExpression({ op: "lessThan", operands: [{ path: "total" }, 100] }, value), false);
  assert.equal(evaluateExpression({ op: "lengthAtLeast", operands: [{ path: "items" }, 2] }, value), true);
  assert.equal(evaluateExpression({ op: "lengthAtMost", operands: [{ path: "items" }, 1] }, value), false);
  assert.equal(evaluateExpression({ op: "matches", operands: [{ path: "country" }, "^I"] }, value), true);
});

test("a nested path reaches into a group, and a path off the end is undefined rather than a throw", () => {
  assert.equal(evaluateExpression({ op: "equals", operands: [{ path: "shipping.city" }, "Roma"] }, value), true);
  assert.equal(evaluateExpression({ op: "isEmpty", operand: { path: "shipping.zip" } }, value), true);
  // The interesting one: a partially filled form is asked about a field that is not there yet.
  assert.equal(evaluateExpression({ op: "isEmpty", operand: { path: "billing.city" } }, value), true);
});

test("and/or/not compose, so a condition can span three fields", () => {
  const expr = {
    op: "and",
    operands: [
      { op: "notEquals", operands: [{ path: "country" }, "IT"] },
      { op: "greaterThan", operands: [{ path: "total" }, 100] },
    ],
  };
  assert.equal(evaluateExpression(expr, value), false, "country is IT, so the conjunction fails");
  assert.equal(evaluateExpression(expr, { ...value, country: "FR" }), true);
  assert.equal(evaluateExpression({ op: "not", operand: expr }, value), true);
  assert.equal(evaluateExpression({ op: "or", operands: [expr, { op: "isEmpty", operand: { path: "coupon" } }] }, value), true);
});

test("`0` and `false` are answers, not emptiness", () => {
  assert.equal(evaluateExpression({ op: "isEmpty", operand: { path: "n" } }, { n: 0 }), false);
  assert.equal(evaluateExpression({ op: "isEmpty", operand: { path: "b" } }, { b: false }), false);
  // A user who typed only a space has not filled the field in.
  assert.equal(evaluateExpression({ op: "isEmpty", operand: { path: "s" } }, { s: "   " }), true);
});

test("a form's data cannot choose the regular expression", () => {
  // `matches` takes its pattern from the literal only. Were a path allowed here, a value in the
  // document could supply a catastrophically backtracking pattern.
  //
  // The proof is that a data-supplied pattern has *no effect*: `^Z` would not match "IT", yet the
  // result is the empty pattern's, which matches everything. The value was never consulted.
  const fromData = { op: "matches", operands: [{ path: "country" }, { path: "attackerControlled" }] };
  assert.equal(evaluateExpression(fromData, { country: "IT", attackerControlled: "^Z" }), true);
  // And a literal pattern really is applied, so the case above is not passing for want of any regex.
  assert.equal(evaluateExpression({ op: "matches", operands: [{ path: "country" }, "^Z"] }, { country: "IT" }), false);
});

test("expressionPaths finds every field a condition reads, however deeply nested", () => {
  const expr = {
    op: "or",
    operands: [
      { op: "and", operands: [{ path: "a" }, { op: "isEmpty", operand: { path: "b" } }] },
      { op: "equals", operands: [{ path: "c.d" }, "x"] },
      "a literal",
    ],
  };
  assert.deepEqual([...expressionPaths(expr)].sort(), ["a", "b", "c.d"]);
});

test("validateExpression reports a malformed expression instead of letting it fail silently", () => {
  assert.deepEqual(validateExpression({ op: "equals", operands: [{ path: "a" }, 1] }, "x"), []);
  assert.match(validateExpression({ op: "nope", operands: [1] }, "x")[0], /unknown operator/);
  assert.match(validateExpression({ op: "equals" }, "x")[0], /no operands/);
  assert.match(validateExpression("not an object", "x")[0], /expected an expression/);
  assert.match(validateExpression({ op: "matches", operands: [{ path: "a" }, "("] }, "x")[0], /not a valid regular expression/);
  assert.match(validateExpression({ op: "matches", operands: [{ path: "a" }, { path: "b" }] }, "x")[0], /literal string pattern/);
  assert.match(validateExpression({ op: "equals", operands: [{ nodeId: "n1" }, 1] }, "x")[0], /must be \{path\}/);
  // Nested problems are reported with the position that has them.
  assert.match(validateExpression({ op: "and", operands: [{ op: "bogus", operands: [1] }] }, "x")[0], /x\.operands\[0\]/);
});

// ─── The contract slot ───────────────────────────────────────────────────────

const twoFields = [
  { kind: "text", name: "password" },
  { kind: "text", name: "confirm" },
];

test("a document may declare cross-field validation, and it survives parsing", () => {
  const parsed = parseDynamicForm({
    version: 2,
    fields: twoFields,
    validations: [
      { when: { op: "notEquals", operands: [{ path: "password" }, { path: "confirm" }] }, message: "Passwords do not match", target: "confirm" },
    ],
  });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.diagnostics, []);
  assert.equal(parsed.validations.length, 1);
});

test("a malformed expression is reported, not thrown", () => {
  for (const validations of [
    [{ when: { op: "nope", operands: [1] }, message: "m" }],
    [{ when: "not an expression", message: "m" }],
    [{ when: { op: "equals", operands: [{ path: "password" }, 1] }, message: "" }],
    [{ when: { op: "equals", operands: [{ path: "password" }, 1] }, message: "m", target: "nonexistent" }],
    [{ when: { op: "equals", operands: [{ path: "nonexistent" }, 1] }, message: "m" }],
    ["not an object"],
  ]) {
    const parsed = parseDynamicForm({ version: 2, fields: twoFields, validations });
    assert.equal(parsed.validations.length, 0, `rejected: ${JSON.stringify(validations)}`);
    assert.ok(parsed.diagnostics.length > 0, `reported: ${JSON.stringify(validations)}`);
  }
  // And the whole slot being the wrong shape is one diagnostic, not a crash.
  const parsed = parseDynamicForm({ version: 2, fields: twoFields, validations: "nope" });
  assert.ok(parsed.diagnostics.some((d) => d.path === "/validations"));
});

test("a document with no validations parses exactly as it did before the slot existed", () => {
  const parsed = parseDynamicForm({ version: 2, fields: twoFields });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.validations, []);
});

test("a declared validation becomes a real error on the real form", () => {
  const parsed = parseDynamicForm({
    version: 2,
    fields: twoFields,
    validations: [
      { when: { op: "notEquals", operands: [{ path: "password" }, { path: "confirm" }] }, message: "Passwords do not match", target: "confirm" },
    ],
  });
  const form = createForm(
    { password: field(""), confirm: field("") },
    { validators: buildDynamicValidations(parsed.validations) },
  );

  assert.equal(form.state.valid(), true, "equal at rest");
  form.f.password.set("hunter2");
  assert.equal(form.state.valid(), false);
  assert.deepEqual(form.f.confirm.errors().map((e) => e.message), ["Passwords do not match"], "the error lands on the target");

  form.f.confirm.set("hunter2");
  assert.equal(form.state.valid(), true);
});

test("without a target the error is form-level, and the dependencies come from the condition", () => {
  const parsed = parseDynamicForm({
    version: 2,
    fields: twoFields,
    validations: [
      { when: { op: "isEmpty", operand: { path: "password" } }, message: "Password required" },
    ],
  });
  const form = createForm(
    { password: field(""), confirm: field("") },
    { validators: buildDynamicValidations(parsed.validations) },
  );
  assert.equal(form.state.valid(), false);
  // Attributed to the path the condition reads, not to nothing.
  assert.deepEqual(form.f.password.errors().map((e) => e.message), ["Password required"]);
  form.f.password.set("x");
  assert.equal(form.state.valid(), true);
});

test("an expression has a bottom: past it the parser reports instead of throwing", () => {
  // A document is untrusted input, and a deep one need not be large: a few tens of kilobytes of
  // nested `and` exhausts the call stack. JSON.parse walks deeper than this parser did, so the
  // document arrives intact and the failure lands here — where a diagnostic belongs, not a throw.
  const deepJson = (levels) => {
    const inner = JSON.stringify({ op: "isNotEmpty", operands: [{ path: "a" }] });
    return '{"op":"and","operands":['.repeat(levels) + inner + "]}".repeat(levels);
  };
  const documentJson = (levels) =>
    '{"version":3,"schema":{"node":"group","children":{"a":{"node":"field","field":{"kind":"text"}}}},' +
    '"validations":[{"target":"a","message":"x","when":' + deepJson(levels) + "}]}";

  const shallow = parseDynamicForm(JSON.parse(documentJson(3)));
  assert.deepEqual(shallow.diagnostics, [], "an ordinary condition was refused");
  assert.equal(shallow.validations.length, 1);

  for (const levels of [40, 2000]) {
    const parsed = parseDynamicForm(JSON.parse(documentJson(levels)));
    assert.deepEqual(
      parsed.diagnostics.map((d) => d.code),
      ["MDY_DYNAMIC_INVALID_VALIDATION"],
      `a condition ${levels} deep was not reported`,
    );
    assert.equal(parsed.validations.length, 0, "the unusable validation was kept");
  }
});

test("a cyclic expression meets the bottom instead of spinning", () => {
  // JSON cannot express a cycle, but an object graph handed straight to the parser can.
  const cyclic = { op: "and", operands: [{ op: "isNotEmpty", operands: [{ path: "a" }] }] };
  cyclic.operands.push(cyclic);

  assert.ok(validateExpression(cyclic, "t").length > 0, "a cycle was accepted");
  assert.deepEqual(expressionPaths(cyclic), ["a"], "reading a cycle's paths did not terminate");
  // The depth cap is a limit on what a *document* may carry, not on what a caller may evaluate, so
  // meeting the bottom is not the unreadability ADR 0069 answers with `false`.
  assert.equal(evaluateExpression(cyclic, { a: "x" }), true, "an unreadable rule must not fire");
});

test("the bottom is far below anything an author writes", () => {
  // The check that matters for a limit: the shape it must not refuse.
  const real = {
    op: "and",
    operands: [
      {
        op: "or",
        operands: [
          { op: "isNotEmpty", operands: [{ path: "a" }] },
          { op: "not", operands: [{ op: "isEmpty", operands: [{ path: "b" }] }] },
        ],
      },
      { op: "equals", operands: [{ path: "c" }, 3] },
    ],
  };
  assert.deepEqual(validateExpression(real, "t"), []);
  assert.deepEqual([...expressionPaths(real)].sort(), ["a", "b", "c"]);
  assert.equal(evaluateExpression(real, { a: "", b: "x", c: 3 }), true);
});

test("a path an expression may not read is refused where the document is read", () => {
  // An expression arrives through the same doors a field name does, and it was the only one that
  // did not consult the path guard: a document could ask about `constructor` and be answered from
  // the prototype behind the form, choosing which branch applies by naming something no field
  // declares. Nothing is written and nothing is polluted — what moves is which rule fires.
  for (const path of ["__proto__", "prototype", "constructor"]) {
    const expr = { op: "isNotEmpty", operand: { path } };
    assert.equal(validateExpression(expr, "document").length, 1, `${path} was accepted`);
    assert.equal(evaluateExpression(expr, {}), false, `${path} was answered`);
    assert.deepEqual(expressionPaths(expr), [], `${path} was offered as a dependency`);
  }

  // A nested operand is reached the same way, and a document carrying one is refused as a whole.
  const nested = {
    op: "and",
    operands: [
      { op: "equals", operands: [{ path: "country" }, "IT"] },
      { op: "isNotEmpty", operands: [{ path: "shipping.constructor" }] },
    ],
  };
  assert.equal(validateExpression(nested, "document").length, 1);
  assert.deepEqual(expressionPaths(nested), ["country"]);
});

test("a member the value inherits is not an answer the form gave", () => {
  // The guard above refuses the spellings the engine knows. This is the layer under it: a value
  // whose prototype carries a name a field also uses answers from its own data or not at all.
  const inherited = Object.create({ secret: "from the prototype" });
  inherited.own = "from the form";
  assert.equal(evaluateExpression({ op: "equals", operands: [{ path: "own" }, "from the form"] }, inherited), true);
  assert.equal(evaluateExpression({ op: "isNotEmpty", operand: { path: "secret" } }, inherited), false);
});

test("the root reference still reads the whole value", () => {
  // `""` is not a field path and never was: it is the root, which is how a form-level rule asks
  // about the object itself. The guard must not take it away.
  assert.deepEqual(validateExpression({ op: "isNotEmpty", operand: { path: "" } }, "t"), []);
  assert.deepEqual(expressionPaths({ op: "isNotEmpty", operand: { path: "" } }), [""]);
  assert.equal(evaluateExpression({ op: "isEmpty", operand: { path: "" } }, null), true);
});
