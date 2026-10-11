/**
 * A value that comes back from a draft, a refetch or an import is the option it copies.
 *
 * None of those hands back the option object the list was built from: an object option returns as a
 * new object, possibly with its keys in another order, and a number read from JSON returns as text.
 * Each is the same choice by `sameChoice`, and the select shows that option chosen and reports the
 * option's own value as the selection. Indexed by identity instead, it selected nothing while the
 * model held a value.
 */

import assert from "node:assert";
import test from "node:test";

import { createForm, field } from "@modyra/core";
import { createSelectController } from "../dist/select/index.js";
import { createOptionFieldController } from "../dist/field/index.js";

const milano = { id: 2, name: "Milano" };
const options = [
  { value: { id: 1, name: "Roma" }, label: "Roma" },
  { value: milano, label: "Milano" },
  { value: 7, label: "Seven" },
];

const controllerHolding = (value) => createSelectController({ widgetId: "city", options, value });

test("an object option's copy, keys reordered, selects that option", () => {
  const controller = controllerHolding({ name: "Milano", id: 2 });
  const state = controller.state();
  assert.notStrictEqual(state.selectedKey, null, "a copy of an option selected nothing");
  // The selection is the option's own value, so whatever validates it compares like with like.
  assert.strictEqual(state.selectedValue, milano);
});

test("a number held as text selects the option holding that number", () => {
  const controller = controllerHolding("7");
  assert.strictEqual(controller.state().selectedValue, 7);
});

test("setValue with a copy selects the same option as the original", () => {
  const controller = controllerHolding(null);
  controller.setValue({ id: 2, name: "Milano" });
  assert.strictEqual(controller.state().selectedValue, milano);
});

test("a copy adds no entry, and a value no option matches is kept as its own", () => {
  // The control of the three above: a resolver that matched anything would pass them too. A value
  // no option is keeps its unrecognised entry (ADR 0029), and a copy of an option gains none.
  const copy = controllerHolding({ name: "Milano", id: 2 }).state();
  assert.strictEqual(copy.options.length, options.length, "a copy of an option was listed a second time");
  const orphan = controllerHolding({ id: 3, name: "Napoli" }).state();
  assert.strictEqual(orphan.options.length, options.length + 1);
  assert.deepStrictEqual(orphan.selectedValue, { id: 3, name: "Napoli" });
});

test("a radio group holding a copy marks the option it copies", () => {
  // The same question asked by the option-group controller, which radio and segmented controls share.
  const form = createForm({ city: field({ name: "Milano", id: 2 }) });
  const controller = createOptionFieldController({ widgetId: "city", handle: form.f.city, options, variant: "radio" });
  const plain = createOptionFieldController({
    widgetId: "city2", handle: createForm({ city: field(milano) }).f.city, options, variant: "radio",
  });
  // Compared with the key the original option gets, so the copy lands on that option and no other.
  assert.notStrictEqual(plain.state().selectedKey, null);
  assert.strictEqual(controller.state().selectedKey, plain.state().selectedKey);
});
