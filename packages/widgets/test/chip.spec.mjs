/**
 * The chip primitive and its variants.
 *
 * Every renderer asks this one function what classes a chip carries, so these assertions are the
 * reason a theme can style `.mdy-chip--selected` once and have it apply to every chip on screen,
 * whichever renderer drew it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chipRemoveName,
  MDY_CHIP_CLASSES,
  MDY_WIDGET_CONTRACTS,
  multiselectChipClasses,
} from "../dist/index.js";

test("the chip vocabulary is fixed and namespaced", () => {
  assert.deepEqual(MDY_CHIP_CLASSES, {
    block: "mdy-chip",
    centered: "mdy-chip--centered",
    counter: "mdy-chip--counter",
    value: "mdy-chip--value",
    selected: "mdy-chip--selected",
    removable: "mdy-chip--removable",
    check: "mdy-chip__check",
    label: "mdy-chip__label",
    count: "mdy-chip__count",
    step: "mdy-chip__btn",
    remove: "mdy-chip__remove",
    move: "mdy-chip__move",
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

test("the button that takes a chip off is named for the chip", () => {
  // The verb alone names eight controls the same on a strip of eight chips. The words are the
  // renderer's, so what is checked here is the rule: the object belongs in the name.
  assert.equal(chipRemoveName("Remove", "Alfa"), "Remove Alfa");
  assert.equal(chipRemoveName("Rimuovi", "Ferrovia"), "Rimuovi Ferrovia");
  // A chip with nothing to say its name by keeps the verb rather than gaining a trailing space:
  // a name ending in whitespace is a different string to anything matching on it exactly.
  assert.equal(chipRemoveName("Remove", ""), "Remove");
  assert.equal(chipRemoveName("Remove", "   "), "Remove");
});

test("the closed control carries what was chosen, and the popup carries the options", () => {
  // The anatomy: the field shows what was chosen, as chips in a strip inside the control a person
  // presses; the options are seen in the popup, where there is room for them. A second copy of the
  // options in the closed field put every one of them on the page twice and made the control's
  // height follow the catalogue.
  const { parts, structure } = MDY_WIDGET_CONTRACTS.multiselect;
  // One grid, one part. `listbox` existed to name the popup's copy of a grid the field also drew;
  // with the field's copy gone there is only one, and two names for it could only disagree.
  assert.deepEqual(parts.options.classes, ["mdy-multiselect__options", "mdy-multiselect-overlay__grid"]);
  assert.equal(parts.listbox, undefined);
  const parentOf = (part) => structure.nodes.find((node) => node.part === part)?.parent;
  assert.equal(parentOf("options"), "popup");
  assert.equal(parentOf("search"), "popup");
  assert.equal(parentOf("trigger"), "inputWrapper");
  // Beside the opener, not inside it (ADR 0142): a chip carries a button that takes a value off, and
  // a control that opens something may not contain a control that destroys something.
  assert.equal(parentOf("chips"), "inputWrapper");
  assert.equal(parentOf("chip"), "chips");
  // The chip is where a value is changed, so the control that takes it off belongs to the chip.
  assert.equal(parentOf("chipRemove"), "chip");
});
