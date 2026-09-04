/**
 * A component whose only reactivity is a Vue `computed` over the controller renders once and never
 * again — and the page then disagrees with the form about whether the field is answerable.
 *
 * The controller's signals belong to the runtime that owns the *handle*, not to Vue. A `computed`
 * has nothing of Vue's to track inside it, so the first render is correct and every later one is
 * stale. On screen that looks like nothing at all, because the control is uncontrolled: what a
 * person sees is what they typed, which the DOM already held. What never moves is everything only a
 * render can write — `aria-invalid`, `aria-required`, `aria-disabled`, every state class.
 *
 * So the assertion is not on the value. It is on an attribute the form knows and the page has to be
 * told, with the form's own verdict asserted first: a page that disagrees with a form that never
 * found a problem proves nothing.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const { MdyTextField, MdyBooleanField, MdySliderField, MdyFileField, MdyOptionField, createVueForm } =
  await import("../dist/index.js");
const { field, required } = await import("../../core/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

const mount = (component, extra, initial) => {
  const form = createVueForm({ value: field(initial, [required()]) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(component, { field: form.f.value, widgetId: "w", label: "Given", ...extra }),
  });
  app.mount(host);
  return { host, form, dispose: () => { app.unmount(); host.remove(); } };
};

/** Every component in this package that a person can make invalid by emptying it. */
const CASES = [
  { name: "text", component: () => MdyTextField, extra: { kind: "text" }, initial: "" },
  { name: "slider", component: () => MdySliderField, extra: {}, initial: null },
  { name: "file", component: () => MdyFileField, extra: {}, initial: [] },
  { name: "option", component: () => MdyOptionField, extra: { options: [{ value: "a", label: "A" }] }, initial: null },
  { name: "boolean", component: () => MdyBooleanField, extra: { kind: "checkbox" }, initial: false },
];

for (const testCase of CASES) {
  test(`${testCase.name}: the page is told what the form decided`, async () => {
    const view = mount(testCase.component(), testCase.extra, testCase.initial);
    try {
      await settle();
      view.form.f.value.markAsTouched();
      view.form.f.value.validate?.();
      await settle();

      // The form's verdict first. Without it, a page saying "valid" agrees with a form that never
      // found a problem, and the test passes on a renderer that renders nothing at all.
      assert.equal(view.form.f.value.valid(), false, `${testCase.name}: the form found nothing to report`);

      const control = view.host.querySelector("input, textarea, select, [role=radiogroup], [role=group]");
      assert.ok(control, `${testCase.name}: no control to carry the verdict`);
      const carrier = control.getAttribute("aria-invalid") === null
        ? view.host.querySelector("[aria-invalid]")
        : control;
      assert.ok(carrier, `${testCase.name}: nothing on the page carries aria-invalid at all`);
      assert.equal(
        carrier.getAttribute("aria-invalid"), "true",
        `${testCase.name}: the form is invalid and the page still says it is not`,
      );
    } finally {
      view.dispose();
    }
  });
}
