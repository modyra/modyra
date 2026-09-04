/**
 * A key the catalogue declares on a part belongs to that part.
 *
 * The pickers' key handler serves both the field and the panel, and it forwarded everything: a press
 * on the *control* was answered with a binding declared `on: "gridcell"`. `Space` is that key — it
 * commits the day a calendar is on — so pressing it on the field consumed the press and closed the
 * panel, for a meaning the contract states nowhere.
 *
 * It became reachable when the control started opening the panel: before that, nobody could be
 * standing on the control with a panel open. A repair making a defect reachable is the ordinary shape
 * of a structural fix, and this is that defect.
 *
 * Both directions are asserted, because a handler that stops forwarding everything is one press away
 * from forwarding nothing: the key the widget itself declares still works from the same element.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { MDY_WIDGET_KEYBOARD, partClasses } = await import("../../widgets/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

const open = async (kind, component, empty) => {
  const form = m.createVueForm({ value: field(empty) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({ render: () => h(component, { field: form.f.value, widgetId: `k-${kind}`, label: "When" }) });
  app.mount(host);
  await settle();
  host.querySelector("button[aria-expanded]").click();
  await settle();
  const opener = host.querySelector(`.${partClasses(kind, "control")[0]}`) ?? host.querySelector("[aria-expanded]");
  assert.equal(opener.getAttribute("aria-expanded"), "true", `${kind} never opened, so nothing below is a measurement`);
  return { host, opener, dispose: () => { app.unmount(); host.remove(); document.body.innerHTML = ""; } };
};

const press = (element, key) => {
  const event = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
};

test("a key declared on a part is not taken from the control", async () => {
  // Asked of the table: the claim is about a key this kind declares *somewhere else*, and if it
  // stopped declaring one this test would be about nothing.
  const scoped = (MDY_WIDGET_KEYBOARD.datepicker ?? []).find((binding) => binding.on !== undefined && binding.when === "open");
  assert.ok(scoped, "this kind declares no key on a part, so there is nothing to keep off the control");

  const view = await open("datepicker", m.MdyDatepickerField, null);
  try {
    const event = press(view.opener, scoped.key);
    await settle();
    assert.equal(
      event.defaultPrevented, false,
      `${JSON.stringify(scoped.key)} is declared on ${scoped.on} and was taken from the control instead`,
    );
    assert.equal(view.opener.getAttribute("aria-expanded"), "true", "and it closed the panel while it was at it");
  } finally {
    view.dispose();
  }
});

test("a key the widget itself declares is still taken from the control", async () => {
  const own = (MDY_WIDGET_KEYBOARD.datepicker ?? [])
    .find((binding) => binding.on === undefined && binding.when === "open" && binding.intent === "cancel");
  assert.ok(own, "this kind declares no widget-level key while open, so the other half cannot be checked");

  const view = await open("datepicker", m.MdyDatepickerField, null);
  try {
    press(view.opener, own.key);
    await settle();
    assert.equal(
      view.opener.getAttribute("aria-expanded"), "false",
      `${JSON.stringify(own.key)} is the widget's own key and pressing it did nothing`,
    );
  } finally {
    view.dispose();
  }
});
