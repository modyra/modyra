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

  // The panel is drawn outside the field — it leaves so it does not inherit an ancestor's
  // `overflow` or stacking (ADR 0130) — so what is inside it is looked for in the document,
  // not under the host. A query scoped to the host finds nothing and reads as "not drawn".
const draw = () => {
  const form = createVueForm({ value: field(null) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    // The shape with a panel. A select is non-filtering by default — that is the contract's
    // default and this package follows it — so a fixture that wants the combobox asks for it.
    render: () => h(MdySelectField, { field: form.f.value, widgetId: "s", label: "Pick", options: OPTIONS, searchable: true }),
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

/**
 * The other shape: the chooser the platform draws.
 *
 * `variantOf` decides it — a select that does not filter is native — and the contract is explicit
 * about what it must not do: *"nothing may carry `aria-expanded`, `aria-controls` or
 * `aria-haspopup` — a `<select>` that claims to be a combobox is lying about what it is."* That is
 * asserted here rather than trusted, because those attributes arrive from a shared projection and
 * would be invisible in a rendering that otherwise looks right.
 */
const drawNative = () => {
  const form = createVueForm({ value: field(null) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(MdySelectField, {
      field: form.f.value, widgetId: "n", label: "Pick", options: OPTIONS, searchable: false,
    }),
  });
  app.mount(host);
  return { host, dispose: () => { app.unmount(); host.remove(); } };
};

test("a select that does not filter is the platform's chooser", () => {
  const { host, dispose } = drawNative();

  const chooser = host.querySelector("select");
  assert.ok(chooser, "no native chooser was drawn for a field that does not filter");
  assert.ok(chooser.classList.contains(cls("trigger")), "the chooser is not the declared trigger part");
  dispose();
});

test("the chooser does not claim to be a combobox", () => {
  const { host, dispose } = drawNative();

  const chooser = host.querySelector("select");
  for (const attribute of ["aria-expanded", "aria-controls", "aria-haspopup"]) {
    assert.equal(
      chooser.getAttribute(attribute), null,
      `the chooser carries ${attribute}, which describes a combobox that is not there`,
    );
  }
  dispose();
});

test("the chooser has an entry for nothing chosen, and it cannot be chosen back into", () => {
  const { host, dispose } = drawNative();

  // Without it, index 0 is a real option: the control reads the first label while the form holds
  // nothing, which is a field that looks answered and is not.
  const placeholder = host.querySelector(`.${cls("placeholder")}`);
  assert.ok(placeholder, "the chooser has no entry standing for an unanswered field");
  assert.equal(placeholder.tagName, "OPTION", "the placeholder is not inside the chooser");
  assert.equal(placeholder.disabled, true, "the placeholder can be chosen, so 'nothing' is a value");
  dispose();
});
