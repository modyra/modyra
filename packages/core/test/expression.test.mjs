import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyDynamicRules,
  buildDynamicValidations,
  buildFlatFormSchema,
  createForm,
  evaluateExpression,
  evaluateRuleCondition,
  expressionContextKeys,
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

test("a rule's condition is answered for every operator the contract declares", () => {
  // The rule slot's predicate is flat — one field, one operator, one value — and its vocabulary is
  // wider than the tree's: `in`, `notIn` and the two "or equal" comparisons exist only here. A kind
  // of question the tree cannot ask is still a question the document is allowed to write.
  const held = { plan: "pro", seats: 12, name: "", when: "2026-08-15", tags: ["a"] };
  const answers = (operator, field, value) => evaluateRuleCondition({ field, operator, value }, held);

  assert.equal(answers("equals", "plan", "pro"), true);
  assert.equal(answers("notEquals", "plan", "pro"), false);
  assert.equal(answers("in", "plan", ["free", "pro"]), true);
  assert.equal(answers("in", "plan", ["free"]), false);
  assert.equal(answers("notIn", "plan", ["free"]), true);
  // A membership test against something that is not a list is not "everything matches": it is a
  // question with no answer, which is `false` for the same reason an unknown operator is.
  assert.equal(answers("in", "plan", "pro"), false);
  assert.equal(answers("isEmpty", "name"), true);
  assert.equal(answers("isNotEmpty", "name"), false);
  assert.equal(answers("isEmpty", "tags"), false);
  assert.equal(answers("greaterThan", "seats", 10), true);
  assert.equal(answers("greaterThanOrEqual", "seats", 12), true);
  assert.equal(answers("greaterThan", "seats", 12), false);
  assert.equal(answers("lessThan", "seats", 12), false);
  assert.equal(answers("lessThanOrEqual", "seats", 12), true);
  // ISO dates sort as strings, which is what makes a date rule work without a date type.
  assert.equal(answers("greaterThan", "when", "2026-01-01"), true);
  // Two things with no order between them are not ordered by coercing one of them.
  assert.equal(answers("greaterThan", "seats", "10"), false);
  // An operator nobody declared answers false, as an expression's does.
  assert.equal(answers("startsWith", "plan", "p"), false);
  // A field the value does not have reads as absent, and `equals` is strict — so a rule naming no
  // value at all is true about a field that is not there. The parser is what stops a document
  // getting here: a condition on a field the document did not declare is refused with
  // `MDY_DYNAMIC_INVALID_RULE`, and in strict mode the document goes with it.
  assert.equal(answers("equals", "nothing", undefined), true);
  assert.equal(answers("equals", "nothing", "something"), false);
  assert.equal(answers("isEmpty", "nothing"), true);
});

test("a document's rules reach the form, and both effects mean what they say", async () => {
  const envelope = {
    version: 2,
    id: "invoice",
    fields: [
      { name: "customerType", kind: "select", label: "Type", options: [{ value: "person", label: "P" }, { value: "business", label: "B" }] },
      { name: "vatNumber", kind: "text", label: "VAT" },
      { name: "taxId", kind: "text", label: "Tax id" },
    ],
    rules: [
      { effect: "visible", target: "vatNumber", when: { field: "customerType", operator: "equals", value: "business" } },
      { effect: "disabled", target: "taxId", when: { field: "customerType", operator: "equals", value: "person" } },
    ],
  };
  const parsed = parseDynamicForm(envelope, { mode: "strict" });
  assert.equal(parsed.ok, true);

  const form = createForm(buildFlatFormSchema(parsed.fields), { devWarnings: false });
  applyDynamicRules(form, parsed.rules);
  form.patchValue({ customerType: "person", vatNumber: "IT123", taxId: "SSN-1" });

  // Out of play and disabled are different promises, and both keep the value out of the payload —
  // which is the half that matters: a rule saying "disable the tax id for a private customer" is
  // the difference between a value being sent and not.
  assert.deepEqual(form.submitValue(), { customerType: "person" });

  form.patchValue({ customerType: "business" });
  assert.deepEqual(form.submitValue(), { customerType: "business", vatNumber: "IT123", taxId: "SSN-1" });

  // The control: without the rules the same document sends everything, so the exclusion above is
  // the rule rather than a field that was never there.
  const bare = createForm(buildFlatFormSchema(parsed.fields), { devWarnings: false });
  bare.patchValue({ customerType: "person", vatNumber: "IT123", taxId: "SSN-1" });
  assert.deepEqual(bare.submitValue(), { customerType: "person", vatNumber: "IT123", taxId: "SSN-1" });

  form.destroy();
  bare.destroy();
});

test("several rules over one field compose rather than replace each other", () => {
  // The engine's binding replaces: two rules on one field, applied one after the other, would leave
  // only the last. They are composed into one signal per field per effect, so a field is out while
  // *any* of the rules that name it says it is.
  const form = createForm(
    { plan: field("free"), seats: field(1), addon: field("x") },
    { devWarnings: false },
  );
  applyDynamicRules(form, [
    { effect: "visible", target: "addon", when: { field: "plan", operator: "equals", value: "pro" } },
    { effect: "hidden", target: "addon", when: { field: "seats", operator: "lessThan", value: 5 } },
  ]);

  assert.deepEqual(form.submitValue(), { plan: "free", seats: 1 });
  form.f.plan.set("pro");
  assert.deepEqual(form.submitValue(), { plan: "pro", seats: 1 }, "the second rule still holds it out");
  form.f.seats.set(10);
  assert.deepEqual(form.submitValue(), { plan: "pro", seats: 10, addon: "x" });
  form.destroy();
});

test("a rule's value is checked against the operator that will read it", () => {
  // Four of a rule's five members were guarded and this one was not, so a rule that could never fire
  // parsed clean in the strictest mode there is. A field with a rule that cannot fire looks exactly
  // like a field with no rule, except that its author believes they wrote one.
  const document = (operator, value) => ({
    version: 2,
    id: "f",
    fields: [
      { name: "when", kind: "datepicker", label: "W" },
      { name: "seats", kind: "number", label: "S" },
      { name: "extra", kind: "text", label: "E" },
    ],
    rules: [{ effect: "hidden", target: "extra", when: { field: operator === "greaterThanOrEqual" ? "seats" : "when", operator, value } }],
  });
  const refused = (operator, value) => {
    const parsed = parseDynamicForm(document(operator, value), { mode: "strict" });
    return parsed.ok === false && parsed.diagnostics.some((each) => each.code === "MDY_DYNAMIC_INVALID_RULE");
  };

  assert.equal(refused("greaterThan", {}), true, "an object has no order");
  assert.equal(refused("in", "not a list"), true, "membership of a string is not membership");
  assert.equal(refused("notIn", 42), true);
  // A unary operator reads no value, so one written beside it is noise rather than a rule that
  // cannot fire — and a generator emitting one shape for every operator writes one.
  assert.equal(refused("isEmpty", "something"), false, "a value nothing reads is not a refusal");
  // Comparing dates is comparing strings, and that holds only while every string is the same shape:
  // "2026-2-01" sorts before "2026-1-10" because "2" sorts after "1" and the padding is what hides it.
  assert.equal(refused("greaterThan", "2026-1-10"), true);
  assert.equal(refused("greaterThan", "2026-01-10"), false, "a full ISO date is what the check asks for");
  assert.equal(refused("greaterThanOrEqual", 10), false, "a number against a number field is fine");

  // And the pair that was not one: `notIn` is `in` negated, so the careful spelling does not answer
  // the same as the one it was written to be safer than.
  const held = { plan: "pro" };
  assert.equal(evaluateRuleCondition({ field: "plan", operator: "in", value: "pro" }, held), false);
  assert.equal(evaluateRuleCondition({ field: "plan", operator: "notIn", value: "pro" }, held), true);
});

test("the three operands that are not paths read what encloses the clause", () => {
  const form = { kind: "company", rows: { a: { qty: 0 } } };

  // `{self}` is how a clause written once for the item of a collection reads its own value: the row
  // has no name until somebody creates it, so a path cannot say this.
  assert.equal(
    evaluateExpression({ op: "notEquals", operands: [{ self: true }, 0] }, form, { self: 3 }),
    true,
  );
  assert.equal(
    evaluateExpression({ op: "notEquals", operands: [{ self: true }, 0] }, form, { self: 0 }),
    false,
  );

  // `{root}` is how a condition evaluated against a row reaches back out to the form.
  assert.equal(
    evaluateExpression(
      { op: "equals", operands: [{ op: "equals", operands: [{ root: true }, null] }, false] },
      { qty: 1 },
      { root: form },
    ),
    true,
  );

  // `{context}` is a fact the host supplies, once for the application.
  const roleIsAdmin = { op: "equals", operands: [{ context: "role" }, "admin"] };
  assert.equal(evaluateExpression(roleIsAdmin, form, { context: { role: "admin" } }), true);
  assert.equal(evaluateExpression(roleIsAdmin, form, { context: { role: "editor" } }), false);
});

test("a reference the scope does not carry closes rather than opens", () => {
  // The direction matters more than the answer. `undefined` would make `isEmpty` true and `notEquals`
  // true — a clause that cannot be read would *show* the field it was written to hide, and a value
  // nobody meant to send would reach the payload.
  const form = { kind: "company" };
  assert.equal(evaluateExpression({ op: "notEquals", operands: [{ self: true }, 0] }, form), false);
  assert.equal(evaluateExpression({ op: "isEmpty", operand: { self: true } }, form), false);
  assert.equal(evaluateExpression({ op: "equals", operands: [{ context: "role" }, "admin"] }, form, { context: {} }), false);
  // And inside a join: a member nobody can read is not a member that holds.
  assert.equal(
    evaluateExpression({
      op: "and",
      operands: [
        { op: "equals", operands: [{ path: "kind" }, "company"] },
        { op: "equals", operands: [{ context: "role" }, "admin"] },
      ],
    }, form),
    false,
  );
});

test("what a caller has to be given, and what it does not", () => {
  const expression = {
    op: "or",
    operands: [
      { op: "equals", operands: [{ path: "kind" }, "company"] },
      { op: "equals", operands: [{ context: "role" }, "admin"] },
      { op: "isNotEmpty", operand: { self: true } },
    ],
  };

  // Context keys are an API between the host and whoever authors documents, so they are askable
  // before a form exists.
  assert.deepEqual(expressionContextKeys(expression), ["role"]);
  // And the three are not field paths: nothing subscribes to them.
  assert.deepEqual(expressionPaths(expression), ["kind"]);

  assert.deepEqual(validateExpression({ op: "equals", operands: [{ self: true }, 1] }, "w"), []);
  assert.deepEqual(validateExpression({ op: "equals", operands: [{ root: true }, 1] }, "w"), []);
  assert.deepEqual(
    validateExpression({ op: "equals", operands: [{ context: "" }, 1] }, "w"),
    ["w.operands[0]: a context key cannot be empty"],
  );
});

test("equality is SameValueZero wherever it is spelled", () => {
  // A number field holding text it cannot read is NaN, which the engine documents; -0 is what a
  // minus in front of a zero parses to. Both are answers a form holds, and the four doors gave three
  // different verdicts about them.
  const held = { n: Number.NaN, zero: -0 };
  const both = (field, value) => [
    evaluateExpression({ op: "equals", operands: [{ path: field }, value] }, held),
    evaluateRuleCondition({ field, operator: "equals", value }, held),
    evaluateExpression({ op: "in", operands: [{ path: field }, [value]] }, held),
    evaluateRuleCondition({ field, operator: "in", value: [value] }, held),
  ];

  assert.deepEqual(both("n", Number.NaN), [true, true, true, true], "NaN is the answer the field holds");
  assert.deepEqual(both("zero", 0), [true, true, true, true], "-0 and 0 are one answer");
  assert.deepEqual(both("zero", 1), [false, false, false, false], "the control: different values still differ");
});

test("an operand that claims to be a reference and is not decides nothing", () => {
  const held = { n: 1, plan: { tier: "pro" } };
  // The dual of the rule this module already holds for operators. These reached the literal branch
  // and were compared as the objects they are — never empty, never equal — so a section governed by
  // a misspelled operand was shown to everyone and the values inside it went into the payload.
  for (const operand of [{ context: 123 }, { self: "yes" }, { root: 1 }, { path: 4 }]) {
    assert.equal(evaluateExpression({ op: "isNotEmpty", operand }, held), false, JSON.stringify(operand));
    assert.equal(evaluateExpression({ op: "equals", operands: [operand, 1] }, held), false, JSON.stringify(operand));
    assert.notDeepEqual(validateExpression({ op: "isNotEmpty", operand }, "w"), []);
  }

  // And the control, which is why the rule is about a *claim* rather than about objects: a
  // membership list is an array and an option's value may be an object.
  assert.equal(evaluateExpression({ op: "in", operands: [{ path: "n" }, [1, 2]] }, held), true);
  assert.equal(evaluateExpression({ op: "isNotEmpty", operand: { field: "n" } }, held), true);
});

test("a context the host supplies cannot take the read down with it", () => {
  // The bag belongs to the application: in a real one it is a store, a signal or a Proxy, so reading
  // a key is a property access that can throw. A condition is read every time the form is read.
  const hostile = new Proxy({}, {
    get() { throw new Error("the store exploded"); },
    has: () => true,
    ownKeys: () => ["role"],
    getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true, value: 1 }),
  });
  assert.equal(
    evaluateExpression({ op: "equals", operands: [{ context: "role" }, "admin"] }, {}, { context: hostile }),
    false,
  );
});
