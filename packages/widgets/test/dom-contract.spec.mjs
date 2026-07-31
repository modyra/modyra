/**
 * The DOM conformance runner is the gate every adapter is held to, so it is tested against
 * hand-built DOM that is deliberately right and deliberately wrong — a gate that cannot fail
 * proves nothing.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { assertWidgetDomContract, inspectWidgetDom } from "../dist/testing/index.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const document = dom.window.document;

function el(tag, className, attributes = {}) {
  const node = document.createElement(tag);
  if (className) node.setAttribute("class", className);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

/** A conforming text field: shell classes, ordered parts, a resolvable aria-describedby. */
function buildTextField({ errorId = "f1-errors" } = {}) {
  const root = el("div", "mdy-renderer mdy-renderer--text");
  const label = el("label", "mdy-label");
  const marker = el("span", "mdy-label__required");
  label.append(marker);
  const wrapper = el("div", "mdy-input-wrapper");
  const inliner = el("div", "mdy-input-wrapper__inliner");
  const control = el("input", null, { "aria-describedby": errorId, "aria-invalid": "true" });
  inliner.append(control);
  wrapper.append(inliner);
  const supporting = el("p", "mdy-supporting-text");
  const errors = el("ul", "mdy-control__errors", { id: errorId });
  const errorItem = el("li", "mdy-control__error");
  errors.append(errorItem);
  root.append(label, wrapper, supporting, errors);
  document.body.append(root);
  return {
    root,
    parts: { label, requiredMarker: marker, inputWrapper: wrapper, control, supportingText: supporting, errors, errorItem },
  };
}

test("a conforming field passes", () => {
  const { root, parts } = buildTextField();
  assert.deepEqual(inspectWidgetDom(root, "text", { parts }), []);
  assertWidgetDomContract(root, "text", { parts });
  root.remove();
});

test("a missing root class is reported", () => {
  const { root, parts } = buildTextField();
  root.setAttribute("class", "mdy-renderer");
  const issues = inspectWidgetDom(root, "text", { parts });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "ROOT_CLASS_MISSING");
  root.remove();
});

test("an adapter-invented shell class is reported under strictClasses", () => {
  const { root, parts } = buildTextField();
  parts.supportingText.setAttribute("class", "mdy-description");
  const issues = inspectWidgetDom(root, "text", { parts, strictClasses: true });
  assert.ok(issues.some((issue) => issue.code === "INVENTED_CLASS" && issue.message.includes("mdy-description")));
  // A state modifier of a canonical class is not an invention.
  parts.supportingText.setAttribute("class", "mdy-supporting-text mdy-supporting-text--muted");
  assert.deepEqual(inspectWidgetDom(root, "text", { parts, strictClasses: true }), []);
  root.remove();
});

test("a dangling aria reference is reported", () => {
  const { root, parts } = buildTextField({ errorId: "f2-errors" });
  parts.control.setAttribute("aria-describedby", "nowhere");
  const issues = inspectWidgetDom(root, "text", { parts });
  assert.ok(issues.some((issue) => issue.code === "ARIA_DANGLING_REF"));
  root.remove();
});

test("an aria state that is not a string boolean is reported", () => {
  const { root, parts } = buildTextField({ errorId: "f3-errors" });
  parts.control.setAttribute("aria-required", "");
  const issues = inspectWidgetDom(root, "text", { parts });
  assert.ok(issues.some((issue) => issue.code === "ARIA_NON_STRING_STATE"));
  root.remove();
});

test("a part rendered outside its contract parent is reported", () => {
  const { root, parts } = buildTextField({ errorId: "f4-errors" });
  root.append(parts.control); // control belongs inside the input wrapper
  const issues = inspectWidgetDom(root, "text", { parts });
  assert.ok(issues.some((issue) => issue.code === "PART_NOT_CONTAINED" && issue.part === "control"));
  root.remove();
});

test("parts rendered out of contract order are reported", () => {
  const { root, parts } = buildTextField({ errorId: "f5-errors" });
  root.insertBefore(parts.errors, parts.label); // errors must follow the shell, not lead it
  const issues = inspectWidgetDom(root, "text", { parts });
  assert.ok(issues.some((issue) => issue.code === "PART_ORDER"));
  root.remove();
});

test("optional parts may be absent, required ones may not", () => {
  const { root, parts } = buildTextField({ errorId: "f6-errors" });
  const { control, ...withoutControl } = parts;
  control.remove();
  const issues = inspectWidgetDom(root, "text", { parts: withoutControl });
  assert.ok(issues.some((issue) => issue.code === "PART_MISSING" && issue.part === "control"));
  assert.ok(!issues.some((issue) => issue.part === "prefix"), "prefix is optional");
  root.remove();
});

test("assert throws one error listing every violation", () => {
  const { root, parts } = buildTextField({ errorId: "f7-errors" });
  root.setAttribute("class", "mdy-renderer");
  parts.control.setAttribute("aria-describedby", "nowhere");
  assert.throws(() => assertWidgetDomContract(root, "text", { parts }), (error) => {
    assert.match(error.message, /ROOT_CLASS_MISSING/);
    assert.match(error.message, /ARIA_DANGLING_REF/);
    return true;
  });
  root.remove();
});

/* ── F-01: `absentParts` must not be a free bypass ──────────────────────────────
 * The contract decides what may be missing, not the caller. Probes from the audit of
 * 2026-07-30, each of which passed against the code before this gate existed. */

test("absentParts cannot silence a part the contract requires", () => {
  const root = el("div", "mdy-renderer mdy-renderer--text");
  document.body.append(root);
  const issues = inspectWidgetDom(root, "text", { absentParts: ["control", "inputWrapper"] });
  assert.ok(issues.length > 0, "an empty root passed by naming its required parts absent");
  const codes = issues.map((issue) => issue.code);
  assert.ok(codes.includes("ABSENT_PART_NOT_OPTIONAL"), `expected ABSENT_PART_NOT_OPTIONAL, got ${codes.join(", ")}`);
  root.remove();
});

test("a part declared absent must actually be absent from the DOM", () => {
  const { root, parts } = buildTextField();
  const issues = inspectWidgetDom(root, "text", { parts, absentParts: ["errors"] });
  const codes = issues.map((issue) => issue.code);
  assert.ok(codes.includes("ABSENT_PART_PRESENT"), `expected ABSENT_PART_PRESENT, got ${codes.join(", ")}`);
  root.remove();
});

test("declaring an optional part absent is still fine when it really is", () => {
  const { root, parts } = buildTextField();
  parts.supportingText.remove();
  const trimmed = { ...parts };
  delete trimmed.supportingText;
  assert.deepEqual(inspectWidgetDom(root, "text", { parts: trimmed, absentParts: ["supportingText"] }), []);
  root.remove();
});

/* ── F-02: cardinality is normative ────────────────────────────────────────────
 * The model had `repeated` and the inspector took the first match. Probed in the audit:
 * two `.mdy-control` elements passed as `control`. */

test("a singular part rendered twice is reported", () => {
  const { root, parts } = buildTextField();
  const twin = el("input", null, {});
  parts.inputWrapper.append(twin);
  const issues = inspectWidgetDom(root, "text", { parts: { ...parts, control: [parts.control, twin] } });
  const codes = issues.map((issue) => issue.code);
  assert.ok(codes.includes("PART_CARDINALITY"), `expected PART_CARDINALITY, got ${codes.join(", ")}`);
  root.remove();
});

test("a declared count that the DOM does not match is reported", () => {
  const { root, parts } = buildTextField();
  const issues = inspectWidgetDom(root, "text", { parts, counts: { errorItem: 3 } });
  const codes = issues.map((issue) => issue.code);
  assert.ok(codes.includes("PART_CARDINALITY"), `expected PART_CARDINALITY, got ${codes.join(", ")}`);
  root.remove();
});

test("a declared count the DOM does match passes", () => {
  const { root, parts } = buildTextField();
  assert.deepEqual(inspectWidgetDom(root, "text", { parts, counts: { errorItem: 1 } }), []);
  root.remove();
});
