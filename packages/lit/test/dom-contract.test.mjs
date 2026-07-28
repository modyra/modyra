/**
 * Runtime contract conformance for the Lit elements.
 *
 * Same gate as the framework-free renderer: `assertWidgetDomContract` from `@modyra/widgets/testing`
 * reads the DOM these elements actually rendered and checks it against the catalog's classes,
 * containment, ordering and ARIA. Lit renders in light DOM, so there is nothing to pierce.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
const { inspectWidgetDom } = await import("../../widgets/dist/testing/index.js");

defineMdyElements();

const option = { value: "x", label: "X" };
const ELEMENTS = [
  ["mdy-text-field", "text", ""],
  ["mdy-textarea-field", "textarea", ""],
  ["mdy-number-field", "number", 0],
  ["mdy-checkbox-field", "checkbox", false],
  ["mdy-toggle-field", "toggle", false],
  ["mdy-slider-field", "slider", 0],
  ["mdy-radio-group-field", "radio", null],
  ["mdy-segmented-field", "segmented", null],
];

function partsOf(root, kind) {
  const q = (selector) => root.querySelector(selector);
  const shell = {
    label: q(".mdy-label, .mdy-toggle__label"),
    requiredMarker: q(".mdy-label__required"),
    inputWrapper: q(".mdy-input-wrapper, .mdy-checkbox, .mdy-toggle"),
    supportingText: q(".mdy-supporting-text"),
    errors: q(".mdy-control__errors"),
    errorItem: q(".mdy-control__error"),
  };
  switch (kind) {
    case "checkbox":
      return { ...shell, control: q('input[type="checkbox"]'), indicator: q(".mdy-checkbox__indicator") };
    case "toggle":
      return { ...shell, control: q('input[type="checkbox"]'), track: q(".mdy-toggle__track"), thumb: q(".mdy-toggle__thumb") };
    case "slider":
      return { ...shell, track: q(".mdy-slider-container"), control: q(".mdy-slider"), value: q(".mdy-slider-value") };
    case "radio":
    case "segmented":
      return kind === "segmented"
        ? { ...shell, group: q(".mdy-segmented"), option: q(".mdy-segmented__button"), optionCheck: q(".mdy-segmented__check"), optionText: q(".mdy-segmented__text") }
        : { ...shell, group: q(".mdy-radio-group"), option: q(".mdy-radio-item"), optionControl: q(".mdy-radio-circle"), optionLabel: q(".mdy-radio-label") };
    default:
      return { ...shell, control: q("input, textarea") };
  }
}

/**
 * Divergences the Lit elements still have from the contract, recorded rather than waived — the
 * assertion below matches this map exactly, so one can neither appear silently nor outlive its fix.
 */
const KNOWN_DIVERGENCES = {};

for (const [tag, kind, initial] of ELEMENTS) {
  test(`<${tag}> renders the ${kind} contract`, async () => {
    const form = createLitForm({ value: field(initial) });
    const element = await mount(tag, (el) => {
      el.field = form.f.value;
      el.label = "Label";
      if (kind === "radio" || kind === "segmented") el.options = [option];
    });

    const issues = inspectWidgetDom(element, kind, { parts: partsOf(element, kind) });
    assert.deepEqual(
      issues.map((issue) => `${issue.code}:${issue.part}`),
      KNOWN_DIVERGENCES[kind] ?? [],
      `${kind}: ${issues.map((issue) => issue.message).join(" / ")}`,
    );

    element.remove();
  });
}

test("every element takes its root classes from the catalog", async () => {
  const { MDY_WIDGET_CONTRACTS } = await import("../../widgets/dist/index.js");
  const form = createLitForm({ value: field("") });
  for (const [tag, kind] of ELEMENTS) {
    const element = await mount(tag, (el) => { el.field = form.f.value; });
    for (const className of MDY_WIDGET_CONTRACTS[kind].rootClasses) {
      assert.ok(element.classList.contains(className), `<${tag}> must carry ${className}`);
    }
    element.remove();
  }
});

test("a pointer outside an open Lit overlay dismisses it", async () => {
  const form = createLitForm({ value: field(null) });
  const element = await mount("mdy-datepicker-field", (el) => { el.field = form.f.value; el.label = "Date"; });
  const outside = document.createElement("button");
  document.body.append(outside);

  element.querySelector(".mdy-datepicker__toggle").click();
  await element.updateComplete;
  assert.equal(element._open, true);

  // The dismissal policy is the contract's; the element only reports where the pointer landed.
  outside.dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
  await element.updateComplete;
  assert.equal(element._open, false);

  outside.remove();
  element.remove();
});
