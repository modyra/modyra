/**
 * A stepper press lands where the box's own arrow key would: on the grid that starts at `min`, at
 * the step's own precision, and never through a bound.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { renderField } = await import("../dist/index.js");
const { createForm, field } = await import("../../core/dist/index.js");
const { MDY_WIDGET_CONTRACTS } = await import("../../widgets/dist/index.js");

const { increment, decrement } = MDY_WIDGET_CONTRACTS.number.parts;

const draw = (initial, rules) => {
  const form = createForm({ f: field(initial) });
  const host = document.createElement("div");
  document.body.append(host);
  const dispose = renderField(host, { name: "f", kind: "number", label: "F", ...rules }, form.f.f);
  // A press reads the box, and the box is redrawn after the press that came before it settles.
  const press = async (part) => {
    host.querySelector(`.${part.classes.join(".")}`).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { form, press, dispose: () => { dispose(); host.remove(); } };
};

test("an off-grid value moves onto the grid that starts at min", async () => {
  const view = draw(3, { min: 1, step: 5 });
  await view.press(increment);
  assert.equal(view.form.f.f.value(), 6);
  view.dispose();
});

test("a decimal step carries no binary error", async () => {
  const view = draw(0.1, { step: 0.1 });
  await view.press(increment);
  await view.press(increment);
  assert.equal(view.form.f.f.value(), 0.3);
  view.dispose();
});

test("a value above max comes down to the grid, and further up stays put", async () => {
  const view = draw(10, { max: 7, step: 3 });
  await view.press(increment);
  assert.equal(view.form.f.f.value(), 10);
  await view.press(decrement);
  assert.equal(view.form.f.f.value(), 6);
  view.dispose();
});
