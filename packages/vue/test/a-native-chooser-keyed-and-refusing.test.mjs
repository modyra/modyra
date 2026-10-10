/**
 * The platform's chooser lists the options the way the controller keys them, and says which are
 * unavailable.
 *
 * An `<option>`'s value is a string. Written with `String(value)`, every object-valued option reads
 * `[object Object]`: the browser cannot tell them apart and a choice resolves to whichever the
 * lookup meets first. And an option the document declared unavailable has to be `disabled` on the
 * page, or the platform offers it as a choice like any other.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { defaultOptionKey, variantOf } = await import("../../widgets/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

const PLANS = [
  { value: { id: 1 }, label: "Free" },
  { value: { id: 2 }, label: "Team", disabled: true },
  { value: { id: 3 }, label: "Scale" },
];

const draw = async () => {
  const form = m.createVueForm({ plan: field(null) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({ render: () => h(m.MdySelectField, { field: form.f.plan, label: "Plan", options: PLANS }) });
  app.mount(host);
  await settle();
  return {
    handle: form.f.plan,
    chooser: host.querySelector("select"),
    dispose: () => { app.unmount(); host.remove(); document.body.innerHTML = ""; },
  };
};

test("a select asked for nothing in particular is the platform's chooser", () => {
  assert.equal(variantOf("select", { searchable: false }), "native");
});

test("each option is keyed as the controller keys it, and an unavailable one is disabled", async () => {
  const view = await draw();
  try {
    assert.ok(view.chooser, "no native chooser was drawn");
    const listed = Array.from(view.chooser.options).filter((option) => option.value !== "");
    assert.deepEqual(listed.map((option) => option.value), PLANS.map((plan) => defaultOptionKey(plan.value)));
    assert.deepEqual(listed.map((option) => option.disabled), [false, true, false]);
  } finally {
    view.dispose();
  }
});

test("choosing an object option stores that option's value", async () => {
  const view = await draw();
  try {
    view.chooser.value = defaultOptionKey({ id: 3 });
    view.chooser.dispatchEvent(new window.Event("change", { bubbles: true }));
    await settle();
    assert.deepEqual(view.handle.value(), { id: 3 });
  } finally {
    view.dispose();
  }
});
