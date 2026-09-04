/**
 * The select's panel: what opens it, where focus goes, and which key it is allowed to keep.
 *
 * Every expectation here is read from the same door the component reads, so a contract that changes
 * its mind moves the renderer and the test together. Asserting a key by name would let the two
 * drift, and the test would still be green while the field answered the wrong key.
 *
 * The Tab case is the one with teeth. `popupHoldsAnAction("select")` is `false` — this panel has
 * nothing in it worth staying for — so Tab must close the panel *and be left alone*, or the field
 * becomes a place a person can enter and not leave.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h } = await import("vue");
const { MdySelectField, createVueForm } = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { partClasses, focusPartOnOpen, keyBindingFor, popupHoldsAnAction } = await import("../../widgets/dist/index.js");

const OPTIONS = [{ value: "a", label: "First" }, { value: "b", label: "Second" }];
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const cls = (part) => partClasses("select", part)[0];

const draw = () => {
  const form = createVueForm({ value: field(null) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(MdySelectField, { field: form.f.value, widgetId: "s", label: "Pick", options: OPTIONS }),
  });
  app.mount(host);
  return { host, form, trigger: host.querySelector(`.${cls("trigger")}`), dispose: () => { app.unmount(); host.remove(); } };
};

test("the panel opens, and focus lands on the part the contract names", async () => {
  const { host, trigger, dispose } = draw();
  assert.equal(trigger.getAttribute("aria-expanded"), "false", "it was already open, so opening proves nothing");

  trigger.click();
  await settle();

  assert.equal(trigger.getAttribute("aria-expanded"), "true", "the trigger was clicked and the panel did not open");
  const landing = focusPartOnOpen("select", { searchable: true });
  assert.equal(landing, "search", "the contract now lands focus elsewhere, so this test asserts the wrong part");
  assert.ok(
    document.activeElement?.classList?.contains(cls(landing)),
    `focus is on .${document.activeElement?.className || "nothing"} rather than the declared ${landing}`,
  );
  dispose();
});

test("the key the contract declares for opening opens it", async () => {
  const { trigger, dispose } = draw();
  const opener = ["ArrowDown", "Enter"].find((key) => keyBindingFor("select", { key }, false)?.intent === "open");
  assert.ok(opener, "no declared key opens this kind any more");

  trigger.dispatchEvent(new KeyboardEvent("keydown", { key: opener, bubbles: true, cancelable: true }));
  await settle();

  assert.equal(trigger.getAttribute("aria-expanded"), "true", `${opener} is declared to open and did not`);
  dispose();
});

test("Escape closes the panel and is consumed", async () => {
  const { trigger, dispose } = draw();
  trigger.click();
  await settle();
  assert.equal(keyBindingFor("select", { key: "Escape" }, true)?.intent, "cancel");

  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  document.activeElement.dispatchEvent(event);
  await settle();

  assert.equal(trigger.getAttribute("aria-expanded"), "false", "Escape left the panel open");
  assert.equal(event.defaultPrevented, true, "Escape was not consumed, so it also reaches whatever is behind");
  dispose();
});

test("Tab closes the panel and is left to the browser", async () => {
  const { trigger, dispose } = draw();
  trigger.click();
  await settle();
  assert.equal(popupHoldsAnAction("select"), false,
    "this panel now holds an action of its own, so Tab is no longer expected to leave");

  const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  document.activeElement.dispatchEvent(event);
  await settle();

  assert.equal(trigger.getAttribute("aria-expanded"), "false", "Tab left the panel open behind the person");
  assert.equal(
    event.defaultPrevented, false,
    "Tab was swallowed: the panel closed and focus never moved on, which is a field you cannot leave",
  );
  dispose();
});

test("the panel is still referenced when it is shut", () => {
  const { host, trigger, dispose } = draw();

  // `aria-controls` names the list whether the panel shows or not, so the list has to exist while
  // shut. Removing it on close leaves the trigger pointing at nothing.
  const controls = trigger.getAttribute("aria-controls");
  assert.ok(controls, "the trigger names no list at all");
  assert.ok(host.ownerDocument.getElementById(controls), `aria-controls points at ${controls}, which is not in the document`);
  dispose();
});
