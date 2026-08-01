/**
 * The chip primitive and its variants.
 *
 * Every renderer asks this one function what classes a chip carries, so these assertions are the
 * reason a theme can style `.mdy-chip--selected` once and have it apply to every chip on screen,
 * whichever renderer drew it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MDY_CHIP_CLASSES, MDY_WIDGET_CONTRACTS, multiselectChipClasses } from "../dist/index.js";

test("the chip vocabulary is fixed and namespaced", () => {
  assert.deepEqual(MDY_CHIP_CLASSES, {
    block: "mdy-chip",
    centered: "mdy-chip--centered",
    counter: "mdy-chip--counter",
    value: "mdy-chip--value",
    selected: "mdy-chip--selected",
    check: "mdy-chip__check",
    label: "mdy-chip__label",
    count: "mdy-chip__count",
    step: "mdy-chip__btn",
    wrapper: "mdy-chip-wrapper",
  });
});

test("the mode picks the variant, and selection is a state on top of it", () => {
  assert.deepEqual(multiselectChipClasses(), ["mdy-chip", "mdy-chip--centered"]);
  assert.deepEqual(multiselectChipClasses({ mode: "multi" }), ["mdy-chip", "mdy-chip--counter"]);
  // Selected is never a variant of its own: one rule paints a taken chip in either mode.
  assert.deepEqual(multiselectChipClasses({ selected: true }), ["mdy-chip", "mdy-chip--centered", "mdy-chip--selected"]);
  assert.deepEqual(multiselectChipClasses({ mode: "multi", selected: true }), ["mdy-chip", "mdy-chip--counter", "mdy-chip--selected"]);
});

test("a value chip stands for something taken, whatever the mode", () => {
  assert.deepEqual(multiselectChipClasses({ role: "value" }), ["mdy-chip", "mdy-chip--value"]);
  assert.deepEqual(multiselectChipClasses({ role: "value", mode: "multi" }), ["mdy-chip", "mdy-chip--value"]);
});

test("the primitive comes first, so a variant can only ever refine it", () => {
  for (const appearance of [{}, { mode: "multi" }, { role: "value" }, { selected: true }]) {
    assert.equal(multiselectChipClasses(appearance)[0], MDY_CHIP_CLASSES.block);
  }
});

test("the multiselect's chip parts are the chip vocabulary, not names of their own", () => {
  const { parts } = MDY_WIDGET_CONTRACTS.multiselect;
  assert.deepEqual(parts.option.classes, [MDY_CHIP_CLASSES.block]);
  assert.deepEqual(parts.optionCheck.classes, [MDY_CHIP_CLASSES.check]);
  assert.deepEqual(parts.optionLabel.classes, [MDY_CHIP_CLASSES.label]);
  assert.deepEqual(parts.optionCount.classes, [MDY_CHIP_CLASSES.count]);
  assert.deepEqual(parts.optionStep.classes, [MDY_CHIP_CLASSES.step]);
  assert.deepEqual(parts.optionWrapper.classes, [MDY_CHIP_CLASSES.wrapper]);
  assert.deepEqual(parts.chip.classes, [MDY_CHIP_CLASSES.block, MDY_CHIP_CLASSES.value]);
});

test("the field carries the options, and the popup the same grid with the overlay class", () => {
  // The anatomy: the chips are in the field, and the search button opens a popup holding the
  // same grid over a filter box. The shared class is what lets one rule lay out both.
  const { parts, structure } = MDY_WIDGET_CONTRACTS.multiselect;
  assert.deepEqual(parts.options.classes, ["mdy-multiselect__options"]);
  assert.deepEqual(parts.listbox.classes, ["mdy-multiselect__options", "mdy-multiselect-overlay__grid"]);
  const parentOf = (part) => structure.nodes.find((node) => node.part === part)?.parent;
  assert.equal(parentOf("options"), "root");
  assert.equal(parentOf("searchButton"), "header");
  assert.equal(parentOf("header"), "inputWrapper");
  assert.equal(parentOf("listbox"), "popup");
  assert.equal(parentOf("search"), "popup");
});
