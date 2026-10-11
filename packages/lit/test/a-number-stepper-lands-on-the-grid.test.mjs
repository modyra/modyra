/**
 * A stepper press lands where the box's own arrow key would: on the grid that starts at `min`, at
 * the step's own precision, and never through a bound.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
const { MDY_WIDGET_CONTRACTS } = await import("../../widgets/dist/index.js");

defineMdyElements();
const { increment, decrement } = MDY_WIDGET_CONTRACTS.number.parts;

const draw = async (initial, rules) => {
  const form = createLitForm({ f: field(initial) });
  const element = await mount("mdy-number-field", (el) => {
    el.field = form.f.f;
    el.label = "F";
    Object.assign(el, rules);
  });
  const press = async (part) => {
    element.querySelector(`.${part.classes.join(".")}`).click();
    await element.updateComplete;
  };
  return { form, press };
};

test("an off-grid value moves onto the grid that starts at min", async () => {
  const view = await draw(3, { min: 1, step: 5 });
  await view.press(increment);
  assert.equal(view.form.f.f.value(), 6);
});

test("a decimal step carries no binary error", async () => {
  const view = await draw(0.1, { step: 0.1 });
  await view.press(increment);
  await view.press(increment);
  assert.equal(view.form.f.f.value(), 0.3);
});

test("a value above max comes down to the grid, and further up stays put", async () => {
  const view = await draw(10, { max: 7, step: 3 });
  await view.press(increment);
  assert.equal(view.form.f.f.value(), 10);
  await view.press(decrement);
  assert.equal(view.form.f.f.value(), 6);
});
