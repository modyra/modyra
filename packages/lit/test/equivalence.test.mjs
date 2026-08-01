/**
 * This renderer, against the canonical observation every renderer must produce.
 *
 * The expectation lives in `@modyra/widgets/testing`, declared once. This file only mounts the
 * element and hands over the root — an expectation written here would be one of three that happen to
 * agree today.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
const { canonicalWidgetSnapshot, compareToCanonical, MDY_CANONICAL_AT_REST } =
  await import("../../widgets/dist/testing/index.js");

defineMdyElements();

/** The element each kind answers to, and the initial value it accepts. */
const ELEMENT_FOR = {
  text: ["mdy-text-field", ""], email: ["mdy-text-field", ""], password: ["mdy-text-field", ""],
  textarea: ["mdy-textarea-field", ""], number: ["mdy-number-field", 0], slider: ["mdy-slider-field", 0],
  checkbox: ["mdy-checkbox-field", false], toggle: ["mdy-toggle-field", false],
  radio: ["mdy-radio-group-field", null], segmented: ["mdy-segmented-field", null],
  select: ["mdy-select-field", null], multiselect: ["mdy-multiselect-field", []],
  datepicker: ["mdy-datepicker-field", null], daterange: ["mdy-daterange-field", null],
  timepicker: ["mdy-timepicker-field", null], colors: ["mdy-colors-field", null],
  file: ["mdy-file-field", null],
};

/** Divergences this renderer is allowed, each with the reason it is not a defect. */
const KNOWN_DIVERGENCES = {};

for (const [kind, expectation] of Object.entries(MDY_CANONICAL_AT_REST)) {
  test(`${kind} produces the canonical observation at rest`, async () => {
    const [tag, initial] = ELEMENT_FOR[kind];
    const form = createLitForm({ value: field(initial) });
    const element = await mount(tag, (el) => {
      el.field = form.f.value;
      el.label = "F";
      if (kind === "email" || kind === "password") el.type = kind;
      if (["radio", "segmented", "select", "multiselect"].includes(kind)) {
        el.options = [{ value: "a", label: "A" }];
      }
    });
    try {
      const portalRoots = Array.from(document.body.children).filter(
        (node) => !element.contains(node) && node.querySelector?.("[class*='__dropdown']"),
      );
      const snapshot = canonicalWidgetSnapshot(element, kind, {
        value: form.f.value.value(),
        portalRoots,
      });
      assert.deepEqual(
        compareToCanonical(snapshot, expectation),
        KNOWN_DIVERGENCES[kind] ?? [],
      );
    } finally {
      element.remove();
    }
  });
}
