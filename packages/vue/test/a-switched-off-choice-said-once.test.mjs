/**
 * A switched-off choice says so once, on the element that is switched off.
 *
 * Each choice is a native radio, and its native `disabled` is what tells assistive technology it is
 * off. The control part declares the states it may assert; an `aria-disabled` it does not declare is
 * a second, unchecked statement of the same fact on an element that already makes it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { MDY_WIDGET_CONTRACTS } = await import("../../widgets/dist/index.js");

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B", disabled: true }, { value: "c", label: "C" }];

for (const kind of ["radio", "segmented"]) {
  test(`${kind}: a switched-off option is disabled and asserts no state its control does not declare`, async () => {
    const form = m.createVueForm({ choice: field(null) });
    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp({ render: () => h(m.MdyOptionField, { field: form.f.choice, label: "L", kind, options: OPTIONS }) });
    app.mount(host);
    await nextTick();
    try {
      const inputs = [...host.querySelectorAll("input[type=radio]")];
      assert.deepEqual(inputs.map((input) => input.disabled), [false, true, false]);
      const declared = MDY_WIDGET_CONTRACTS[kind].parts.optionControl?.states ?? [];
      const asserted = inputs.map((input) => input.getAttribute("aria-disabled"));
      assert.deepEqual(asserted, declared.includes("disabled") ? ["false", "true", "false"] : [null, null, null]);
    } finally {
      app.unmount();
      host.remove();
    }
  });
}
