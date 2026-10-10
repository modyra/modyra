/**
 * A date limit a document declares is one the calendar keeps.
 *
 * `minDate` and `maxDate` are part of the date kinds' declaration and the controllers take them.
 * A renderer that has no way to be handed them draws every day as available, and a press on a day
 * past the limit puts it in the field: the limit was declared, parsed and then dropped.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { defaultWidgetIdFactory } = await import("../../widgets/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

const CASES = [
  { kind: "datepicker", component: () => m.MdyDatepickerField, held: "2026-06-05", empty: null, read: (value) => value },
  { kind: "daterange", component: () => m.MdyDaterangeField, held: { start: "2026-06-05", end: "2026-06-06" }, empty: { start: null, end: null }, read: (value) => value?.start ?? null },
];

for (const one of CASES) {
  test(`${one.kind}: a day past the declared limit is refused and drawn as refused`, async () => {
    const form = m.createVueForm({ when: field(one.held) });
    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp({
      render: () => h(one.component(), { field: form.f.when, label: "Quando", widgetId: "w", minDate: "2026-06-03", maxDate: "2026-06-10" }),
    });
    app.mount(host);
    await settle();
    try {
      host.querySelector("button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await settle();
      const day = (iso) => document.getElementById(defaultWidgetIdFactory.item("w", "day", iso));
      const late = day("2026-06-25");
      assert.ok(late, "the month holding the limit was not drawn");
      assert.equal(late.disabled, true, "a day after the limit is offered as available");
      assert.equal(day("2026-06-08").disabled, false, "a day inside the limit is refused");
      late.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await settle();
      assert.equal(one.read(form.f.when.value()), one.read(one.held), "a day after the limit was taken");
    } finally {
      app.unmount();
      host.remove();
      document.body.innerHTML = "";
    }
  });
}
