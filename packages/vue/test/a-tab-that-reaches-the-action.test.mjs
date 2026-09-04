/**
 * The colour panel keeps Tab, and this is the press that made the rule exist.
 *
 * The panel holds one action beside the choices — the entry for a colour that is no preset — and the
 * arrows never leave the swatch grid by design. So a `Tab` that dismissed the panel left that button
 * operable with a pointer and with nothing else, for as long as the field had existed. ADR 0198.
 *
 * **Asserted by pressing the key, not by reading the element.** A `<button>` in the document is
 * focusable whatever else is true, so a check that asked the DOM whether the entry *could* take
 * focus would have passed on every day of the defect: the element was always focusable, and the
 * panel was always gone before Tab arrived. The only question that separates the two is where focus
 * *is* after the press.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h } = await import("vue");
const { MdyColorsField, createVueForm } = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { partClasses, popupHoldsAnAction, keyBindingFor } = await import("../../widgets/dist/index.js");

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const cls = (part) => partClasses("colors", part)[0];

  // The panel is drawn outside the field — it leaves so it does not inherit an ancestor's
  // `overflow` or stacking (ADR 0130) — so what is inside it is looked for in the document,
  // not under the host. A query scoped to the host finds nothing and reads as "not drawn".
const draw = () => {
  const form = createVueForm({ value: field("#4361ee") });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(MdyColorsField, { field: form.f.value, widgetId: "c", label: "Tint" }),
  });
  app.mount(host);
  return { host, form, opener: host.querySelector("[aria-expanded]"), dispose: () => { app.unmount(); host.remove(); } };
};

const open = async (fixture) => {
  fixture.opener.click();
  await settle();
  assert.equal(fixture.opener.getAttribute("aria-expanded"), "true", "the panel did not open, so nothing below is about an open panel");
  assert.notEqual(document.activeElement, document.body, "the panel opened with focus nowhere, so a press has no origin");
};

const tab = async () => {
  const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  document.activeElement.dispatchEvent(event);
  await settle();
  return event;
};

test("the contract declares that this panel keeps the key", () => {
  assert.equal(popupHoldsAnAction("colors"), true, "this panel no longer holds an action of its own");
  // The renderer's ring and the contract's declaration are one decision, read here so a bench that
  // passes cannot be passing while the contract says the opposite.
  assert.equal(keyBindingFor("colors", { key: "Tab" }, true)?.intent, "move",
    "Tab is no longer declared a move while this panel is open");
});

test("Tab reaches the action in the panel, and the panel is still open", async () => {
  const fixture = draw();
  await open(fixture);

  const event = await tab();

  assert.equal(event.defaultPrevented, true, "Tab was let through, so it is taking focus out of the panel");
  assert.ok(
    document.activeElement?.classList?.contains(cls("customEntry")),
    `Tab left focus on .${document.activeElement?.className || "nothing"} — the action in this panel `
    + "is reachable with a pointer and with nothing else",
  );
  assert.equal(fixture.opener.getAttribute("aria-expanded"), "true", "Tab closed the panel it was supposed to walk");
  fixture.dispose();
});

test("a second Tab comes back to the swatches rather than out of the panel", async () => {
  const fixture = draw();
  await open(fixture);

  await tab();
  // The precondition, because without it this test passes when Tab does nothing at all: focus never
  // leaves the grid, and "it came back to the swatches" is true of a walk that never departed.
  assert.ok(
    document.activeElement?.classList?.contains(cls("customEntry")),
    "the first press did not leave the grid, so the second cannot be a return",
  );
  await tab();

  assert.ok(
    document.activeElement?.classList?.contains(cls("swatch")),
    `the ring did not wrap: focus is on .${document.activeElement?.className || "nothing"}`,
  );
  assert.equal(fixture.opener.getAttribute("aria-expanded"), "true", "the ring let the panel close");
  fixture.dispose();
});

test("the grid is one stop, not one per colour", async () => {
  const fixture = draw();
  await open(fixture);

  // The arrows are what move within the palette; a stop per swatch would make Tab the way to walk
  // colours, and reaching the action would take as many presses as there are presets.
  const reachable = [...document.querySelectorAll(`.${cls("swatch")}`)]
    .filter((swatch) => swatch.tabIndex === 0);
  assert.equal(reachable.length, 1, `${reachable.length} swatches are Tab stops; the grid is meant to be one`);
  fixture.dispose();
});

test("Escape is still the way out", async () => {
  const fixture = draw();
  await open(fixture);

  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  document.activeElement.dispatchEvent(event);
  await settle();

  assert.equal(fixture.opener.getAttribute("aria-expanded"), "false", "Escape did not close the panel");
  assert.equal(event.defaultPrevented, true, "Escape was not consumed, so it also reaches whatever is behind");
  fixture.dispose();
});
