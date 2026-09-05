/**
 * A control shows the value the model holds, however the value got there.
 *
 * The box showed only what a person had typed into it. A value arriving from anywhere else — a draft
 * restored, a server correction, a cross-field rule, another control's answer — reached the form and
 * never the screen. That is the whole of what a field handle is for.
 *
 * It stayed invisible while nothing else displayed the value. The moment the slider's readout started
 * working, the widget began contradicting itself: the number said 53 and the thumb sat at 50, which
 * is worse than the empty readout it replaced.
 *
 * **Both directions.** A control bound to the model can fight the person using it — the classic shape
 * is a box that erases what somebody is halfway through typing — so the typing is asserted here too,
 * and a repair that made the field obedient at the cost of being usable fails on the second test.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

const draw = async (component, initial, extra = {}) => {
  const form = m.createVueForm({ value: field(initial) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({ render: () => h(component, { field: form.f.value, widgetId: "c", label: "Given", ...extra }) });
  app.mount(host);
  await settle();
  return { host, form, input: host.querySelector("input"), dispose: () => { app.unmount(); host.remove(); } };
};

for (const [name, component, initial, next, extra] of [
  ["text", () => m.MdyTextField, "a", "b", { kind: "text" }],
  ["slider", () => m.MdySliderField, 50, 53, { min: 0, max: 100 }],
]) {
  test(`${name}: a value set from outside reaches the control`, async () => {
    const view = await draw(component(), initial, extra);
    try {
      assert.equal(String(view.input.value), String(initial), `${name} did not show the value it was built with`);
      view.form.f.value.set(next);
      await settle();
      assert.equal(
        String(view.input.value), String(next),
        `${name}: the model holds ${next} and the control still shows ${view.input.value} — a value from anywhere but the keyboard never arrives`,
      );
    } finally {
      view.dispose();
    }
  });
}

test("and the control does not fight the person typing in it", async () => {
  const view = await draw(m.MdyTextField, "", { kind: "text" });
  try {
    view.input.value = "half a word";
    view.input.dispatchEvent(new window.Event("input", { bubbles: true }));
    await settle();
    assert.equal(view.input.value, "half a word", "the box erased what somebody was halfway through typing");
    assert.equal(view.form.f.value.value(), "half a word", "and the form did not hear it either");
  } finally {
    view.dispose();
  }
});
