/**
 * What a document declares about a field has to arrive on the control a person operates.
 *
 * A slider whose `min`, `max` and `step` never reach its `<input type="range">` is not a slider with
 * a cosmetic gap: the platform then uses its own defaults, so Home writes 0, End writes 100 and one
 * arrow moves by 1 — values the document says are impossible. The form accepts them, because the
 * control produced them.
 *
 * **It survived because the default hides it.** A slider declared 0–100 with step 1 behaves
 * identically whether or not anything was passed, and that is the slider every fixture had. The
 * range below is deliberately none of those numbers.
 *
 * The route is the contract's: the controller is told the kind and the narrowing, and the projection
 * composes them onto the control part. A renderer that wrote the attributes itself would be a second
 * place where a bound is decided.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const { MdySliderField, MdyTextField, createVueForm } = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };
const RANGE = { min: 10, max: 20, step: 5 };

const draw = async (component, props, initial) => {
  const form = createVueForm({ value: field(initial) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({ render: () => h(component, { field: form.f.value, widgetId: "w", ...props }) });
  app.mount(host);
  await settle();
  return { host, form, dispose: () => { app.unmount(); host.remove(); } };
};

const withField = async (component, props, initial, body) => {
  const view = await draw(component, props, initial);
  try { await body(view); } finally { view.dispose(); }
};

test("a slider's declared bounds are on the control the platform reads", async () => {
  await withField(MdySliderField, { label: "Volume", ...RANGE }, 10, (view) => {
    const control = view.host.querySelector("input[type=range]");
    assert.ok(control, "the slider drew no range control");
    for (const [name, value] of Object.entries(RANGE)) {
      assert.equal(
        control.getAttribute(name), String(value),
        `the document declares ${name}=${value} and the control says ${control.getAttribute(name)} — `
        + "so the platform uses its own bound and writes values the document forbids",
      );
    }
  });
});

test("a slider with no visible caption still has a name", async () => {
  await withField(MdySliderField, { ariaLabel: "Volume", ...RANGE }, 10, (view) => {
    const control = view.host.querySelector("input[type=range]");
    assert.equal(control.getAttribute("aria-label"), "Volume");
  });
});

test("a number field's declared bounds and its placeholder reach the control", async () => {
  await withField(MdyTextField, { kind: "number", label: "Age", placeholder: "years", ...RANGE }, null, (view) => {
    const control = view.host.querySelector("input");
    for (const [name, value] of Object.entries(RANGE)) {
      assert.equal(control.getAttribute(name), String(value), `${name} did not reach the control`);
    }
    assert.equal(control.getAttribute("placeholder"), "years");
  });
});
