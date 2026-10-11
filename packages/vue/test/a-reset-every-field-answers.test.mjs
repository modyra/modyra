/**
 * A form's reset returns every field to what it was given, whichever kind of field it is.
 *
 * A Cancel button is `type="reset"`, and the browser's reset returns each box to its `value`
 * attribute, which this renderer never writes. Every field kind binds the reset of its own form, so
 * the model returns to its initial values and what is drawn follows it.
 *
 * **One field per form.** Each field's binding resets the whole form, so in a form of several fields
 * one that never bound is reset by its neighbours and looks as though it answered. Alone in its form,
 * a kind that does not bind keeps the changed value and is red here.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const vue = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

const OPTIONS = [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }];
const aFile = () => new document.defaultView.File(["x"], "a.txt", { type: "text/plain" });

/** The kind, its component, what it needs besides a field, what it starts with and what it changes to. */
const KINDS = [
  ["text", "MdyTextField", { kind: "text" }, "Ada", "Grace"],
  ["boolean", "MdyBooleanField", {}, false, true],
  ["slider", "MdySliderField", { min: 0, max: 10 }, 2, 7],
  ["file", "MdyFileField", {}, [], () => [aFile()]],
  ["option", "MdyOptionField", { kind: "radio", options: OPTIONS }, "a", "b"],
  ["select", "MdySelectField", { options: OPTIONS }, "a", "b"],
  ["datepicker", "MdyDatepickerField", {}, "2026-01-01", "2026-06-06"],
  ["daterange", "MdyDaterangeField", {}, { start: "2026-01-01", end: "2026-01-10" }, { start: "2026-06-06", end: "2026-06-20" }],
  ["timepicker", "MdyTimepickerField", {}, "09:30", "17:45"],
  ["colors", "MdyColorsField", {}, "#112233", "#ff0000"],
  ["multiselect", "MdyMultiselectField", { options: OPTIONS, mode: "multi" }, ["a"], ["a", "b"]],
];

for (const [name, component, extra, initial, changed] of KINDS) {
  test(`${name}: the reset of the form it sits in returns it to what it was given`, async () => {
    const form = vue.createVueForm({ value: field(initial) });
    const element = document.createElement("form");
    const host = document.createElement("div");
    element.append(host);
    document.body.append(element);
    const app = createApp({
      render: () => h(vue[component], { field: form.f.value, widgetId: name, label: "Field", ...extra }),
    });
    app.mount(host);
    await settle();
    try {
      form.f.value.set(typeof changed === "function" ? changed() : changed);
      await settle();
      // The premise: the value really moved, or a reset that restores nothing would pass.
      assert.notDeepEqual(form.f.value.value(), initial, "the value did not change, so the reset proves nothing");

      element.reset();
      await settle();

      assert.deepEqual(
        form.f.value.value(), initial,
        `${name} kept the changed value after the form it sits in was reset, so Cancel did nothing`,
      );
    } finally {
      app.unmount();
      element.remove();
    }
  });
}
