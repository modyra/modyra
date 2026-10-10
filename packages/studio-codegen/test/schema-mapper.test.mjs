import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFormModule, buildStubsModule } from "../dist/index.js";

const PROFILE = { factoryImportSource: "@modyra/core", createCallName: "createForm" };

function field(id, name, extra = {}) {
  return { node: "field", id, name, fieldKind: "text", valueType: "string", initialValue: "", validators: [], ...extra };
}

function project({ children, implementations = {}, formValidators = [] }) {
  return {
    studioVersion: 1, id: "p", name: "P",
    schema: { node: "group", id: "root", name: "root", children },
    formValidators, behaviors: {}, implementations, presentation: {}, targets: {}, metadata: {},
  };
}

const SERVER_IMPL = { impl_s: { id: "impl_s", role: "serverValidator", displayName: "checkCoupon", mode: "stub" } };

function couponProject(skipWhen) {
  return project({
    children: [field("nd_c", "coupon", {
      serverValidator: { id: "val_s", kind: "server", implementationRef: "impl_s", dependencies: [], skipWhen, errorMessage: "no" },
    })],
    implementations: SERVER_IMPL,
  });
}

function build(p) {
  return buildFormModule(p, buildStubsModule(p).nameFor, PROFILE);
}

test("skipWhen X emits a `when` that runs the validator exactly when X is false", () => {
  const { code, diagnostics } = build(couponProject({ op: "isEmpty", operand: { nodeId: "nd_c" } }));
  assert.deepEqual(diagnostics, []);
  const source = /when: (\(value\) => [^\n]*?),?\n/.exec(code)?.[1];
  assert.ok(source, `no when in:\n${code}`);
  const when = new Function(`return ${source};`)();
  assert.equal(when(""), false, "an empty coupon is skipped, so the validator does not run");
  assert.equal(when("SAVE10"), true, "a filled coupon runs the validator");
});

test("an expression the compiler refuses becomes a diagnostic on a skipWhen, not an exception", () => {
  const p = couponProject({ op: "equals", operands: [{ nodeId: "nd_c" }, ["x"]] });
  let result;
  assert.doesNotThrow(() => { result = build(p); });
  const found = result.diagnostics.filter((d) => d.code === "INVALID_EXPRESSION");
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, "error");
  assert.equal(found[0].nodeId, "nd_c");
  assert.doesNotMatch(result.code, /when:/);
});

test("an expression the compiler refuses becomes a diagnostic on a form validator, not an exception", () => {
  const p = project({
    children: [field("nd_a", "a")],
    formValidators: [{
      id: "val_f", kind: "form", dependencies: [{ nodeId: "nd_a" }],
      condition: { op: "equals", operands: [{ nodeId: "nd_a" }, Number.NaN] },
      message: "bad",
    }],
  });
  let result;
  assert.doesNotThrow(() => { result = build(p); });
  const found = result.diagnostics.filter((d) => d.code === "INVALID_EXPRESSION");
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, "error");
  assert.doesNotMatch(result.code, /crossField/);
});

test("a form validator that compiles is still emitted", () => {
  const p = project({
    children: [field("nd_a", "a")],
    formValidators: [{
      id: "val_f", kind: "form", dependencies: [{ nodeId: "nd_a" }],
      condition: { op: "isNotEmpty", operand: { nodeId: "nd_a" } }, message: "need a",
    }],
  });
  const { code, diagnostics } = build(p);
  assert.deepEqual(diagnostics, []);
  assert.match(code, /crossField\(/);
});
