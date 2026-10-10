/**
 * A multiselect keys its options the way the controller does, names its way back, and answers the
 * keys the table declares for it.
 *
 * - **Keys.** The controller keys an option with `defaultOptionKey`, which tells two objects apart
 *   by content. A renderer that keys with `String(value)` turns every object into `[object Object]`,
 *   finds no option for what is held and draws no chip: a value submitted and invisible.
 * - **The way back's name.** The button is on the page whether or not something can be put back, so
 *   its name says what pressing it restores. A bare "Undo" beside "Clear all" leaves a person unable
 *   to tell the restore from the destroy without trying it.
 * - **Keys the table declares.** A printable key at an open list without a filter box moves the
 *   cursor to the option it starts; the primary-modifier `z` reaches the way back while there is one,
 *   and is left to the page while there is not.
 * - **Parts under a condition.** The placeholder stands in for the chips only while nothing is held;
 *   a chip's count is owed whenever a value is.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const {
  MDY_I18N_MESSAGES_DEFAULT, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD, partClasses, partIsOwed,
} = await import("../../widgets/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };
const selector = (part) => partClasses("multiselect", part).map((one) => `.${one}`).join("");

const CITIES = ["Roma", "Milano", "Napoli", "Torino"].map((label) => ({ value: label.toLowerCase(), label }));

const draw = async ({ initial = [], options = CITIES, props = {} } = {}) => {
  const form = m.createVueForm({ value: field(initial) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(m.MdyMultiselectField, { field: form.f.value, options, label: "Città", widgetId: "ms", ...props }),
  });
  app.mount(host);
  await settle();
  return {
    host,
    handle: form.f.value,
    find: (part) => document.querySelector(selector(part)),
    findAll: (part) => [...document.querySelectorAll(selector(part))],
    dispose: () => { app.unmount(); host.remove(); document.body.innerHTML = ""; },
  };
};

const press = (element, key, extra = {}) => {
  const event = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra });
  element.dispatchEvent(event);
  return event;
};

test("a fresh copy of an object option's value is drawn as that option's chip", async () => {
  const plans = [{ value: { id: 1 }, label: "Free" }, { value: { id: 2 }, label: "Team" }];
  const view = await draw({ initial: [{ id: 2 }], options: plans });
  try {
    const chips = view.findAll("chip").map((chip) => chip.querySelector(selector("chipLabel"))?.textContent);
    assert.deepEqual(chips, ["Team"]);
  } finally {
    view.dispose();
  }
});

test("the way back is named for what it would bring back", async () => {
  const view = await draw({ initial: ["roma", "milano"] });
  try {
    const back = view.find("wayBackAction");
    assert.equal(back.getAttribute("aria-label"), MDY_I18N_MESSAGES_DEFAULT.wayBackLabel, "nothing to restore, so the name is the bare label");

    view.findAll("chipRemove")[0].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await settle();
    const name = view.find("wayBackAction").getAttribute("aria-label") ?? "";
    assert.ok(name.startsWith(MDY_I18N_MESSAGES_DEFAULT.wayBackLabel) && name.includes("Roma"), `the way back is named ${JSON.stringify(name)}`);
    assert.equal(view.find("wayBackAction").getAttribute("title"), name, "a pointer user reads the same words");
  } finally {
    view.dispose();
  }
});

test("a letter typed at the open list moves the cursor to the option it starts", async () => {
  const typeahead = MDY_WIDGET_KEYBOARD.multiselect.find((binding) => binding.intent === "typeahead");
  assert.ok(typeahead, "the table declares no typeahead for a multiselect, so this asks for nothing");

  const view = await draw();
  try {
    view.find("trigger").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await settle();
    const pressed = press(view.find("popup"), "m");
    await settle();
    const active = view.find("trigger").getAttribute("aria-activedescendant");
    const landed = active === null ? null : document.getElementById(active);
    assert.equal(landed?.querySelector(selector("optionLabel"))?.textContent, "Milano");
    assert.equal(pressed.defaultPrevented, true);
  } finally {
    view.dispose();
  }
});

test("a letter typed into the filter box is the filter's", async () => {
  const view = await draw({ props: { searchable: true } });
  try {
    view.find("trigger").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await settle();
    const pressed = press(view.find("search"), "m");
    assert.equal(pressed.defaultPrevented, false, "the key never reached the box a person was typing in");
  } finally {
    view.dispose();
  }
});

test("the undo shortcut reaches the way back, and only while there is one", async () => {
  const undo = MDY_WIDGET_KEYBOARD.multiselect.find((binding) => binding.intent === "undo");
  assert.ok(undo, "the table declares no undo key for a multiselect");

  const view = await draw({ initial: ["roma", "milano"] });
  try {
    const idle = press(view.host.firstElementChild, undo.key, { ctrlKey: true, metaKey: true });
    assert.equal(idle.defaultPrevented, false, "nothing to undo, and the page's own undo was taken anyway");

    view.findAll("chipRemove")[0].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await settle();
    assert.deepEqual([...view.handle.value()], ["milano"]);
    const pressed = press(view.host.firstElementChild, undo.key, { ctrlKey: true, metaKey: true });
    await settle();
    assert.equal(pressed.defaultPrevented, true);
    assert.deepEqual([...view.handle.value()], ["roma", "milano"]);
  } finally {
    view.dispose();
  }
});

for (const [held, initial] of [["nothing held", []], ["a value held", ["roma"]]]) {
  test(`with ${held}, the conditional parts are drawn exactly when owed`, async () => {
    const view = await draw({ initial });
    try {
      for (const part of ["placeholder", "chipCount"]) {
        const node = MDY_WIDGET_CONTRACTS.multiselect.structure.nodes.find((one) => one.part === part);
        const owed = partIsOwed(node, {
          holds: (condition) => (condition === "valueIsPresent" ? initial.length > 0 : condition === "valueIsAbsent" ? initial.length === 0 : false),
          offers: () => false,
        });
        assert.equal(view.find(part) !== null, owed, `${part} is ${owed ? "owed and missing" : "drawn and not owed"}`);
      }
    } finally {
      view.dispose();
    }
  });
}

test("inside the filter box the undo shortcut is the box's own", async () => {
  const undo = MDY_WIDGET_KEYBOARD.multiselect.find((binding) => binding.intent === "undo");
  const view = await draw({ initial: ["roma", "milano"], props: { searchable: true } });
  try {
    view.findAll("chipRemove")[0].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await settle();
    view.find("trigger").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await settle();
    const pressed = press(view.find("search"), undo.key, { ctrlKey: true, metaKey: true });
    await settle();
    assert.equal(pressed.defaultPrevented, false, "the platform's undo of what was typed was taken");
    assert.deepEqual([...view.handle.value()], ["milano"], "a removed value came back from inside a text box");
  } finally {
    view.dispose();
  }
});
