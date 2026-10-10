/**
 * The colours panel names each swatch the way its palette did, walks with the keys the contract
 * declares, and opens the platform's chooser from its custom entry.
 *
 * - **Names.** A palette entry may carry a label: the name a team uses for a colour is the only
 *   knowledge about it that exists, and a swatch announced by its hex value throws it away.
 * - **Walk.** The panel's swatches are a listbox. The arrows, Home and End the contract declares
 *   while open move the reading position across them; without them the role is a promise of a
 *   keyboard model nobody keeps.
 * - **The custom entry.** It is the way to a colour the palette does not hold, so pressing it asks
 *   the platform for its chooser and leaves the panel where it was. Closing the panel instead leaves
 *   no way to the eleventh colour except typing its hex value.
 * - **A drag is not a choice.** The platform's chooser reports every colour the pointer passes over
 *   as `input` and the one let go on as `change`. Only the second is the field's value.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { MDY_WIDGET_KEYBOARD, partClasses, rowRovingIndex } = await import("../../widgets/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };
const selector = (part) => partClasses("colors", part).map((one) => `.${one}`).join("");

const PALETTE = [
  { value: "#4361ee", label: "Marchio principale" },
  "#10b981",
  { value: "#e63946", label: "Allarme" },
  "#f59e0b",
];

const draw = async () => {
  const form = m.createVueForm({ value: field("#4361ee") });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(m.MdyColorsField, { field: form.f.value, label: "Colore", widgetId: "c", presets: PALETTE }),
  });
  app.mount(host);
  await settle();
  const find = (part) => document.querySelector(selector(part));
  const open = async () => {
    find("nativePicker").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await settle();
  };
  return {
    handle: form.f.value,
    find,
    findAll: (part) => [...document.querySelectorAll(selector(part))],
    open,
    isOpen: () => find("nativePicker").getAttribute("aria-expanded") === "true",
    dispose: () => { app.unmount(); host.remove(); document.body.innerHTML = ""; },
  };
};

test("each swatch is named by the palette's word for it, and by its value where it has none", async () => {
  const view = await draw();
  try {
    assert.deepEqual(
      view.findAll("swatch").map((swatch) => swatch.getAttribute("aria-label")),
      ["Marchio principale", "#10b981", "Allarme", "#f59e0b"],
    );
  } finally {
    view.dispose();
  }
});

test("the keys the contract declares for moving walk the swatches", async () => {
  const moves = MDY_WIDGET_KEYBOARD.colors.filter((binding) => binding.when === "open" && binding.intent === "move" && binding.key !== "Tab");
  assert.ok(moves.length > 0, "the contract declares no move within the palette, so this asks nothing");
  const view = await draw();
  try {
    await view.open();
    for (const binding of moves) {
      const swatches = view.findAll("swatch");
      swatches[1].focus();
      const event = new window.KeyboardEvent("keydown", { key: binding.key, bubbles: true, cancelable: true });
      swatches[1].dispatchEvent(event);
      await settle();
      const expected = rowRovingIndex(binding.key, 1, swatches.length, binding.by);
      assert.equal(swatches.indexOf(document.activeElement), expected, `${binding.key} did not move the reading position`);
      assert.equal(event.defaultPrevented, true, `${binding.key} was left to scroll the page as well`);
    }
  } finally {
    view.dispose();
  }
});

test("the custom entry asks the platform for its chooser and leaves the panel open", async () => {
  const view = await draw();
  try {
    await view.open();
    let asked = 0;
    view.find("control").addEventListener("click", () => { asked += 1; });
    view.find("customEntry").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await settle();
    assert.equal(asked, 1, "the platform's chooser was never asked for");
    assert.equal(view.isOpen(), true, "the panel closed under the chooser it opened");
  } finally {
    view.dispose();
  }
});

test("a colour passed over during a drag is not the field's value; the one let go on is", async () => {
  const view = await draw();
  try {
    const control = view.find("control");
    control.value = "#b91c1c";
    control.dispatchEvent(new window.Event("input", { bubbles: true }));
    await settle();
    assert.equal(view.handle.value(), "#4361ee", "a colour the pointer passed over became the value");
    control.dispatchEvent(new window.Event("change", { bubbles: true }));
    await settle();
    assert.equal(view.handle.value().toLowerCase(), "#b91c1c");
  } finally {
    view.dispose();
  }
});
