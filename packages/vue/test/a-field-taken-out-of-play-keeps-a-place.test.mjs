/**
 * A field taken out of play does not leave the keyboard nowhere.
 *
 * Disabling a focused element blurs it — that is the platform, and every renderer here disables for
 * real: the property, the attribute and `aria-disabled`, none of them pretending. What follows is
 * this library's decision, and the reference renderers all take it the same way: the keyboard walks
 * forward to the next thing that can hold it. Left alone, the person who was typing is on `<body>`
 * and their next Tab starts at the top of the document.
 *
 * **It was unreachable until these components re-rendered.** A node that is never replaced never
 * takes anyone's place with it, so the defect could not be measured while the render was dead —
 * which is why it arrived as a new red on the run that repaired the render, rather than as a
 * regression.
 *
 * Two fields, because the claim is about where the keyboard *goes*: a bench with one field can only
 * say it did not stay, which is also what "nowhere" looks like.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const { MdyTextField, MdySliderField, createVueForm } = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

const twoFields = async (component, extra, initial) => {
  const form = createVueForm({ one: field(initial), two: field(initial) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h("div", [
      h(component, { field: form.f.one, widgetId: "one", label: "One", ...extra }),
      h(component, { field: form.f.two, widgetId: "two", label: "Two", ...extra }),
    ]),
  });
  app.mount(host);
  await settle();
  return { host, form, dispose: () => { app.unmount(); host.remove(); } };
};

for (const [name, component, extra, initial] of [
  ["text", () => MdyTextField, { kind: "text" }, ""],
  ["slider", () => MdySliderField, { min: 0, max: 10 }, 5],
]) {
  test(`${name}: the keyboard walks forward when the field it stood on leaves play`, async () => {
    const view = await twoFields(component(), extra, initial);
    try {
      const [first, second] = view.host.querySelectorAll("input");
      assert.ok(first && second, "the bench drew fewer than two controls");

      first.focus();
      // Asserted, not assumed: if the keyboard was never in the field, everything below is about
      // a person who was not standing there.
      assert.equal(document.activeElement, first, "the keyboard was not in the first field to begin with");

      // The setter takes a signal, so what is handed over is a source rather than a snapshot.
      view.form.setDisabled("one", () => true);
      await settle();

      assert.notEqual(
        document.activeElement, document.body,
        "the field left play and took the person's place with it: their next Tab starts at the top of the document",
      );
      assert.equal(document.activeElement, second, "the keyboard did not walk forward to the next field");
    } finally {
      view.dispose();
    }
  });
}
