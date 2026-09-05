/**
 * A value of the wrong shape takes nothing off the page.
 *
 * The engine holds what a document hands it and reports the field invalid — the value stays in the
 * model, `canSubmit` is false, and the control is supposed to *show* that verdict. A projection that
 * assumes its kind's declared shape throws instead, and the component that was going to explain the
 * problem is the thing that disappears.
 *
 * The file field arrived that way: handed a string, the prompt read it as a list of files.
 *
 * The roster is derived from the package's own door, so a component added to it is measured here
 * without anyone remembering to add it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

/** Values no document should produce, one per shape a component might assume it has. */
const WRONG = ["a name", 7, {}, [], true];

/** Every field component the package offers, by the name it offers it under. */
const FIELDS = Object.entries(m).filter(([name, value]) => /^Mdy\w+Field$/.test(name) && value !== undefined);

test("the roster is the package's own, and it is not empty", () => {
  // A derivation that silently found nothing would make everything below vacuously green.
  assert.ok(FIELDS.length >= 10, `only ${FIELDS.length} field components reached from the barrel`);
});

for (const [name, component] of FIELDS) {
  test(`${name} stays on the page whatever the model was handed`, async () => {
    for (const wrong of WRONG) {
      const form = m.createVueForm({ value: field(wrong) });
      const host = document.createElement("div");
      document.body.append(host);
      const broke = [];
      const app = createApp({
        render: () => h(component, {
          field: form.f.value, widgetId: "v", label: "Given",
          options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
        }),
      });
      app.config.errorHandler = (error) => broke.push(String(error?.message ?? error));
      try {
        app.mount(host);
        await settle();
        assert.deepEqual(broke, [], `${name} threw on ${JSON.stringify(wrong)}`);
        assert.ok(
          host.querySelector("input, select, textarea, button") !== null,
          `${name} handed ${JSON.stringify(wrong)} drew no control at all, so there is nothing left to show the verdict on`,
        );
      } finally {
        app.unmount();
        host.remove();
        document.body.innerHTML = "";
      }
    }
  });
}
