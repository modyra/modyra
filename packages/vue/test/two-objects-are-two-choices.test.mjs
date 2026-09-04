/**
 * A choice is identified by the key the contract derives, not by `String(value)`.
 *
 * Every plain object renders through `String` as `[object Object]`, so a list of object-valued
 * choices collapses to one key: two different options submit the same value, and a group holding one
 * of them marks both. For a primitive the contract's answer and `String`'s agree exactly, which is
 * why every fixture built on strings concurred and none could see it.
 *
 * The second claim is the comparison. `===` between the value a field holds and a fresh option
 * object is false for two structurally equal objects, so a group asked which of its choices is
 * selected answered "none" for a value it was holding. What decides is the key.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const { MdyOptionField, createVueForm } = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");

const OPTIONS = [
  { value: { id: 1 }, label: "One" },
  { value: { id: 2 }, label: "Two" },
];

const draw = (initial) => {
  const form = createVueForm({ value: field(initial) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(MdyOptionField, {
      field: form.f.value, widgetId: "obj", kind: "radio", label: "Pick", options: OPTIONS,
    }),
  });
  app.mount(host);
  return { host, form, dispose: () => { app.unmount(); host.remove(); } };
};

test("two object-valued options are two choices", () => {
  const { host, dispose } = draw(null);
  const inputs = [...host.querySelectorAll("input[type=radio]")];
  assert.equal(inputs.length, 2);
  assert.notEqual(inputs[0].value, inputs[1].value, "both choices submit under one key");
  dispose();
});

test("the group marks the option it is holding, compared by key", async () => {
  const { host, form, dispose } = draw(OPTIONS[1].value);
  await nextTick();
  const checked = [...host.querySelectorAll("input[type=radio]")].filter((one) => one.checked);
  assert.equal(checked.length, 1, "a held value marks exactly one choice");
  assert.equal(checked[0].value, host.querySelectorAll("input[type=radio]")[1].value);
  assert.equal(form.f.value.value(), OPTIONS[1].value);
  dispose();
});
