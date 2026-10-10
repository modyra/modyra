/**
 * The time field shows the time it holds, takes a typed time as a time, and commits the dialog on
 * the key the contract declares.
 *
 * - **Shown.** The box shows what the controller says to show: the held time in the field's
 *   notation, or the keystrokes it could not read. Bound to the unread keystrokes alone, the box is
 *   blank for every time the field holds, so a value given by the model changes nothing on screen.
 * - **Typed.** A typed entry is judged by the controller: readable commits, unreadable is kept and
 *   explained. Handed over as a draft instead, a readable time vanishes from the box and never
 *   reaches the field.
 * - **Committed.** Enter inside the dialog confirms the draft, as the contract's `commit` binding
 *   says. A button answers Enter for itself, so the dialog speaks only for the rest of it.
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
const selector = (part) => partClasses("timepicker", part).map((one) => `.${one}`).join("");

const draw = async (initial = null) => {
  const form = m.createVueForm({ at: field(initial) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({ render: () => h(m.MdyTimepickerField, { field: form.f.at, label: "Ora", format: "24h" }) });
  app.mount(host);
  await settle();
  return {
    handle: form.f.at,
    control: host.querySelector(selector("control")),
    find: (part) => document.querySelector(selector(part)),
    dispose: () => { app.unmount(); host.remove(); document.body.innerHTML = ""; },
  };
};

test("a time the model was given is the time the box shows", async () => {
  const view = await draw();
  try {
    view.handle.set("09:30");
    await settle();
    assert.equal(view.control.value, "09:30");
  } finally {
    view.dispose();
  }
});

test("a readable time typed into the box is the field's value and stays shown", async () => {
  const view = await draw();
  try {
    view.control.value = "14:45";
    view.control.dispatchEvent(new window.Event("change", { bubbles: true }));
    await settle();
    assert.equal(view.handle.value(), "14:45");
    assert.equal(view.control.value, "14:45");
  } finally {
    view.dispose();
  }
});

test("an unreadable entry is kept on screen and leaves the field empty", async () => {
  const view = await draw("08:00");
  try {
    view.control.value = "presto";
    view.control.dispatchEvent(new window.Event("change", { bubbles: true }));
    await settle();
    assert.equal(view.handle.value(), null);
    assert.equal(view.control.value, "presto");
  } finally {
    view.dispose();
  }
});

test("the commit key inside the dialog confirms the draft", async () => {
  const commit = MDY_WIDGET_KEYBOARD.timepicker.find((binding) => binding.intent === "commit" && binding.when === "open");
  assert.ok(commit, "the contract declares no commit key for an open time dialog");
  const view = await draw();
  try {
    view.control.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await settle();
    const hour = view.find("hourControl");
    assert.ok(hour, "the dialog has no hour box to stand in");
    hour.focus();
    const pressed = new window.KeyboardEvent("keydown", { key: commit.key, bubbles: true, cancelable: true });
    hour.dispatchEvent(pressed);
    await settle();
    assert.equal(pressed.defaultPrevented, true);
    assert.notEqual(view.handle.value(), null, "the draft was never committed");
    assert.equal(view.control.getAttribute("aria-expanded"), "false", "the dialog stayed open after committing");
  } finally {
    view.dispose();
  }
});
