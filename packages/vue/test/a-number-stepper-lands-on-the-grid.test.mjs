/**
 * A stepper press lands where the box's own arrow key would: on the grid that starts at `min`, at
 * the step's own precision, and never through a bound.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const { MdyTextField, createVueForm } = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { MDY_WIDGET_CONTRACTS } = await import("../../widgets/dist/index.js");

const { increment, decrement } = MDY_WIDGET_CONTRACTS.number.parts;
const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

const withField = async (initial, rules, body) => {
  const form = createVueForm({ f: field(initial) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({ render: () => h(MdyTextField, { kind: "number", label: "F", field: form.f.f, widgetId: "w", ...rules }) });
  app.mount(host);
  await settle();
  const press = async (part) => { host.querySelector(`.${part.classes.join(".")}`).click(); await settle(); };
  try { await body({ form, press }); } finally { app.unmount(); host.remove(); }
};

test("an off-grid value moves onto the grid that starts at min", async () => {
  await withField(3, { min: 1, step: 5 }, async ({ form, press }) => {
    await press(increment);
    assert.equal(form.f.f.value(), 6);
  });
});

test("a decimal step carries no binary error", async () => {
  await withField(0.1, { step: 0.1 }, async ({ form, press }) => {
    await press(increment);
    await press(increment);
    assert.equal(form.f.f.value(), 0.3);
  });
});

test("a value above max comes down to the grid, and further up stays put", async () => {
  await withField(10, { max: 7, step: 3 }, async ({ form, press }) => {
    await press(increment);
    assert.equal(form.f.f.value(), 10);
    await press(decrement);
    assert.equal(form.f.f.value(), 6);
  });
});
