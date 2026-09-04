/**
 * The time panel is the one that keeps Tab, and this file asserts it in the opposite direction from
 * every other overlay here.
 *
 * The rule is not written down twice. `popupHoldsAnAction` is read at the top of each test, so a
 * kind that stops holding an action makes these tests fail loudly rather than quietly assert the
 * wrong thing about a panel that now lets Tab through.
 *
 * The ring is read from the contract for the same reason, and because it is where the mistake
 * lives: `timepickerTabOrder` takes the *format*, and a twelve-hour field has an AM/PM stop a
 * twenty-four-hour one does not. Asked without it the answer is the same list either way — which is
 * a walk that silently skips a control a person has to reach.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h } = await import("vue");
const { MdyTimepickerField, createVueForm } = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { partClasses, popupHoldsAnAction, timepickerTabOrder, timepickerPartSelector } =
  await import("../../widgets/dist/index.js");

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const cls = (part) => partClasses("timepicker", part)[0];

const draw = () => {
  const form = createVueForm({ value: field(null) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(MdyTimepickerField, { field: form.f.value, widgetId: "t", label: "At" }),
  });
  app.mount(host);
  return { host, form, toggle: host.querySelector(`.${cls("toggle")}`), dispose: () => { app.unmount(); host.remove(); } };
};

const open = async (fixture) => { fixture.toggle.click(); await settle(); };
const tab = async (shiftKey = false) => {
  const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true });
  document.activeElement.dispatchEvent(event);
  await settle();
  return event;
};

test("this panel is one that keeps the key", () => {
  assert.equal(
    popupHoldsAnAction("timepicker"), true,
    "the time panel no longer holds an action of its own, so every assertion below is about the wrong rule",
  );
});

test("Tab is swallowed and walks inside the panel", async () => {
  const fixture = draw();
  await open(fixture);
  const started = document.activeElement;
  assert.ok(started && started !== document.body, "the panel opened with focus nowhere, so a press has no origin");

  const event = await tab();

  assert.equal(
    event.defaultPrevented, true,
    "Tab was let through: a person setting a time is put back on the page with the dialog still open",
  );
  assert.notEqual(document.activeElement, started, "Tab was swallowed and focus did not move, which is a dead end");
  assert.ok(fixture.host.contains(document.activeElement), "Tab moved focus out of the open panel");
  fixture.dispose();
});

test("the walk visits every stop the contract declares, and comes back", async () => {
  const fixture = draw();
  await open(fixture);

  // Built from the format the field is actually in, not from the default: the two differ by the
  // AM/PM stop, and that is the stop a walk written against the wrong list never reaches.
  const expected = timepickerTabOrder("12h")
    .map((part) => timepickerPartSelector(part))
    .filter((selector) => selector !== null && fixture.host.querySelector(selector) !== null);
  assert.ok(expected.length >= 3, `only ${expected.length} of the declared stops are on the page`);

  const seen = [document.activeElement];
  for (let step = 1; step < expected.length; step += 1) {
    await tab();
    seen.push(document.activeElement);
  }
  assert.equal(new Set(seen).size, expected.length,
    `the walk visited ${new Set(seen).size} distinct stops out of ${expected.length} declared`);

  // One more press comes back to where it started: a ring, not a dead end.
  await tab();
  assert.equal(document.activeElement, seen[0], "the walk did not come back round to its first stop");
  fixture.dispose();
});

test("Shift+Tab walks the other way and stays inside", async () => {
  const fixture = draw();
  await open(fixture);
  const started = document.activeElement;

  await tab();
  const event = await tab(true);

  assert.equal(event.defaultPrevented, true, "Shift+Tab was let through");
  assert.equal(document.activeElement, started, "Shift+Tab did not come back to the stop before");
  assert.ok(fixture.host.contains(document.activeElement), "Shift+Tab left the open panel");
  fixture.dispose();
});

test("the confirm button is reachable by keyboard alone", async () => {
  const fixture = draw();
  await open(fixture);

  // The reason the ring exists. Confirm is the last stop, and with Tab let through it is the one
  // control in this panel a person can only reach with a pointer.
  const confirm = fixture.host.querySelector(timepickerPartSelector("action--confirm"));
  assert.ok(confirm, "the panel draws no confirm button at all");

  let reached = false;
  for (let step = 0; step < timepickerTabOrder("12h").length + 1 && !reached; step += 1) {
    await tab();
    reached = document.activeElement === confirm;
  }
  assert.ok(reached, "the confirm button is never reached by pressing Tab");
  fixture.dispose();
});
