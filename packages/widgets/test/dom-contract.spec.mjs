/**
 * The DOM conformance runner is the gate every adapter is held to, so it is tested against
 * hand-built DOM that is deliberately right and deliberately wrong — a gate that cannot fail
 * proves nothing.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { assertWidgetDomContract, inspectWidgetDom } from "../dist/testing/index.js";
import {
  MDY_FIELD_SHELL_CLASSES,
  MDY_FIELD_STATE_CLASSES,
  MDY_POPUP_OPENERS,
  MDY_WIDGET_CONTRACTS,
} from "../dist/index.js";

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
  const label = el("label", "mdy-label", { for: "f1-control" });
  const marker = el("span", "mdy-label__required");
  label.append(marker);
  const wrapper = el("div", "mdy-input-wrapper");
  const inliner = el("div", "mdy-input-wrapper__inliner");
  const control = el("input", null, { id: "f1-control", "aria-describedby": errorId, "aria-invalid": "true" });
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

/* ── F-03: `semanticElement` is enforced ───────────────────────────────────────
 * The catalog says what element a part is; nothing checked tag or effective role, so a part
 * with the right class and the wrong tag was green with its keyboard behaviour gone. */

test("a control that is a div, not an input, is reported", () => {
  const { root, parts } = buildTextField();
  const impostor = el("div", null, {});
  parts.control.replaceWith(impostor);
  const issues = inspectWidgetDom(root, "text", { parts: { ...parts, control: impostor } });
  const codes = issues.map((issue) => issue.code);
  assert.ok(codes.includes("PART_ELEMENT"), `expected PART_ELEMENT, got ${codes.join(", ")}`);
  root.remove();
});

test("a label that is a span, not a label, is reported", () => {
  const { root, parts } = buildTextField();
  const impostor = el("span", "mdy-label", {});
  parts.label.replaceWith(impostor);
  const issues = inspectWidgetDom(root, "text", { parts: { ...parts, label: impostor, requiredMarker: undefined } });
  const codes = issues.map((issue) => issue.code);
  assert.ok(codes.includes("PART_ELEMENT"), `expected PART_ELEMENT, got ${codes.join(", ")}`);
  root.remove();
});

test("an explicit role satisfies the semantic element without the tag", () => {
  const { root, parts } = buildTextField();
  const divControl = el("div", null, { role: "textbox", "aria-describedby": "f1-errors" });
  parts.control.replaceWith(divControl);
  const issues = inspectWidgetDom(root, "text", { parts: { ...parts, control: divControl } });
  assert.deepEqual(issues.filter((issue) => issue.code === "PART_ELEMENT"), []);
  root.remove();
});

test("every declared opener relation names parts the contract actually has", () => {
  // The relation is contract data pointing at contract data. A part named here and missing from the
  // catalogue produces an `aria-controls` naming an id no part is responsible for rendering, and
  // nothing downstream can tell that from a renderer that simply forgot.
  for (const [kind, relation] of Object.entries(MDY_POPUP_OPENERS)) {
    const parts = MDY_WIDGET_CONTRACTS[kind].parts;
    assert.ok(relation.opener in parts, `${kind}: opener "${relation.opener}" is not a declared part`);
    assert.ok(relation.controls in parts, `${kind}: controls "${relation.controls}" is not a declared part`);
  }
});

test("no projection invents a class the contract does not know", async () => {
  // The projections and the catalogue are one vocabulary. A class literal here that the catalogue
  // cannot account for is a second one, which is how a renderer ends up emitting something no theme
  // can enumerate and no check can recognise.
  const { readFileSync, readdirSync } = await import("node:fs");
  const dir = new URL("../src/field/", import.meta.url);
  const files = readdirSync(dir).filter((name) => name.endsWith("a11y.ts"));
  files.push("../select/select-a11y.ts");

  const canonical = new Set();
  for (const kind of Object.keys(MDY_WIDGET_CONTRACTS)) {
    const d = MDY_WIDGET_CONTRACTS[kind];
    for (const c of d.rootClasses) canonical.add(c);
    for (const part of Object.values(d.parts)) {
      for (const c of part.classes) {
        canonical.add(c);
        for (const state of part.states ?? []) canonical.add(`${c}--${state}`);
      }
    }
  }
  for (const c of Object.values(MDY_FIELD_SHELL_CLASSES)) canonical.add(c);
  const S = MDY_FIELD_STATE_CLASSES;
  canonical.add(S.field).add(S.control).add(S.rendererOpen);
  for (const state of S.fieldStates) canonical.add(`${S.field}--${state}`);
  for (const state of S.controlStates) canonical.add(`${S.control}--${state}`);

  const invented = new Set();
  for (const file of files) {
    const source = readFileSync(new URL(file, dir), "utf8");
    for (const [, className] of source.matchAll(/"(mdy-[\w-]+)"/g)) {
      if (!canonical.has(className)) invented.add(`${file}: ${className}`);
    }
  }
  assert.deepEqual([...invented], [], "a projection names a class the catalogue cannot account for");
});

/* ── The value-chip presentation ────────────────────────────────────────────────
 * `chips`/`chip` describe the compact multiselect: the taken values shown on the control instead of
 * only as chosen options in the grid. The catalogue declares them optional because a renderer may
 * offer either, and no first-party renderer offers this one — which left the anatomy declared and
 * never once built. A part nothing constructs is a part whose parents, classes and order have never
 * been answered, so this builds it and holds it to the same gate as everything else.
 */
function buildCompactMultiselect({ chipClasses = "mdy-chip mdy-chip--value" } = {}) {
  const root = el("div", "mdy-renderer mdy-renderer--multiselect");
  const wrapper = el("div", "mdy-multiselect");
  // The control a person presses, which holds the field's value — so the contract gives it the
  // combobox role rather than leaving `aria-invalid` and `aria-required` on a bare button.
  const trigger = el("button", "mdy-multiselect__trigger", { role: "combobox" });
  const chips = el("div", "mdy-multiselect__chips");
  // A container, because it holds controls: the label, how many, and what takes the value off.
  const chip = el("div", chipClasses);
  const chipRemove = el("button", "mdy-chip__remove", { type: "button" });
  chip.append(chipRemove);
  chips.append(chip);
  const arrow = el("span", "mdy-multiselect__arrow", { "aria-hidden": "true" });
  trigger.append(chips, arrow);
  wrapper.append(trigger);
  root.append(wrapper);
  document.body.append(root);
  return {
    root,
    parts: { inputWrapper: wrapper, trigger, chips, chip, chipRemove, arrow },
  };
}

/**
 * Parts of the multiselect this presentation does not put on screen.
 *
 * The options among them: they live in the popup now, and this fixture is a closed control. What a
 * closed control shows is what was chosen.
 */
const COMPACT_ABSENT = ["popup", "search", "loading", "empty", "options", "optionWrapper", "optionCheck", "optionLabel", "optionStep", "optionCount", "placeholder"];

test("the value-chip presentation the catalogue declares actually conforms", () => {
  const { root, parts } = buildCompactMultiselect();
  assert.deepEqual(
    inspectWidgetDom(root, "multiselect", { parts, absentParts: COMPACT_ABSENT, strictClasses: true }),
    [],
  );
});

test("a value chip missing its variant is not a value chip", () => {
  const { root, parts } = buildCompactMultiselect({ chipClasses: "mdy-chip" });
  const codes = inspectWidgetDom(root, "multiselect", { parts, absentParts: COMPACT_ABSENT }).map((i) => i.code);
  assert.ok(codes.includes("PART_CLASS_MISSING"), `expected PART_CLASS_MISSING, got ${codes.join(", ") || "nothing"}`);
});
