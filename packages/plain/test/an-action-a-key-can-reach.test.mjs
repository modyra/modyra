/**
 * The action inside the colours panel is reachable from a keyboard.
 *
 * The panel holds a button for entering a custom tint. `Tab` used to close the panel before reaching
 * it and the arrows never leave the swatch grid by design, so that control was operable with a
 * pointer and with nothing else — for as long as the field has existed. ADR 0198.
 *
 * **Asserted by pressing the key, not by reading the element.** A `<button>` in the document is
 * "focusable in sequence" whatever else is true, so a check that asked the DOM whether the element
 * could take focus would have passed on every day of the defect: the element was always focusable,
 * and the panel was always gone before `Tab` arrived. The only question that separates the two is
 * where focus *is* after the press.
 *
 * The precondition comes first — the panel opened, and something in it holds focus — because a run
 * that never opened reports "focus is not on the custom entry" about a page that has no panel at all.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { partClasses, keyBindingFor } = await import("../../widgets/dist/index.js");

const settle = () => new Promise((resolve) => setTimeout(resolve, 40));
const ENTRY = partClasses("colors", "customEntry")[0];
const SWATCH = partClasses("colors", "swatch")[0];

async function openPanel() {
  const host = document.createElement("div");
  document.body.append(host);
  mountMdyForm(host, [{ name: "q", kind: "colors", label: "Q" }], { submitLabel: null });
  await settle();

  const opener = host.querySelector('[data-mdy-field="q"] [aria-expanded]');
  assert.ok(opener, "the field drew no opener, so nothing was opened");
  opener.focus();
  opener.click();
  await settle();
  assert.equal(opener.getAttribute("aria-expanded"), "true", "the panel did not open, so nothing below is about an open panel");
  assert.notEqual(document.activeElement, document.body, "the panel opened with focus nowhere, so a press has no origin");
  return { host, opener };
}

const press = async () => {
  document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
  await settle();
};

test("the contract declares that this panel keeps the key", () => {
  // The renderer's ring and the contract's declaration are one decision. Read here so a bench that
  // passes cannot be passing while the contract says the opposite.
  const binding = keyBindingFor("colors", { key: "Tab" }, true);
  assert.equal(binding?.intent, "move", "the contract no longer classes this panel with the ones that keep Tab");
});

test("Tab reaches the action in the panel, and the panel is still open", async () => {
  const { host, opener } = await openPanel();

  await press();

  assert.ok(
    document.activeElement?.classList?.contains(ENTRY),
    `Tab left focus on .${document.activeElement?.className} — the action in this panel is reachable `
    + "with a pointer and with nothing else",
  );
  assert.equal(opener.getAttribute("aria-expanded"), "true", "Tab closed the panel it was supposed to walk");
  host.remove();
});

test("a second Tab comes back to the swatches rather than out of the panel", async () => {
  const { host, opener } = await openPanel();

  await press();
  await press();

  assert.ok(
    document.activeElement?.classList?.contains(SWATCH),
    `the ring did not wrap: focus is on .${document.activeElement?.className}`,
  );
  assert.equal(opener.getAttribute("aria-expanded"), "true", "the ring let the panel close");
  host.remove();
});
