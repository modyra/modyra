/**
 * An open panel closes when a pointer interaction finishes somewhere else.
 *
 * Every overlay kind in the catalogue declares this, and until it was implemented no panel here
 * answered it: clicking the page behind an open list did nothing to the list, and the only way out
 * was to find the control again.
 *
 * **The half that is easy to get wrong is the one that must NOT close.** The panel is drawn in the
 * document body (ADR 0130), so a pointer inside the panel is outside the field's own element — a
 * rule written as `contains` on the field would dismiss on every click a person makes *in* the panel
 * they are using, which is worse than not dismissing at all. Both halves are asserted, and the
 * second is the one a repair breaks.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);

const { createApp, h } = await import("vue");
const { MdySelectField, createVueForm } = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { MDY_WIDGET_CONTRACTS, partClasses } = await import("../../widgets/dist/index.js");

const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

const draw = async () => {
  document.body.innerHTML = "";
  const form = createVueForm({ value: field(null) });
  const host = document.createElement("div");
  const elsewhere = document.createElement("button");
  elsewhere.textContent = "somewhere else";
  document.body.append(host, elsewhere);
  const app = createApp({
    render: () => h(MdySelectField, {
      field: form.f.value, widgetId: "s", label: "Pick", searchable: true, options: OPTIONS,
    }),
  });
  app.mount(host);
  const trigger = host.querySelector(`.${partClasses("select", "trigger")[0]}`);
  trigger.click();
  await settle();
  return { host, elsewhere, trigger, app };
};

/** A pointer interaction that starts and finishes on one element, as a person's click does. */
const clickOn = async (element) => {
  for (const type of ["pointerdown", "pointerup", "click"]) {
    element.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
  }
  await settle();
};

test("this kind declares that a pointer outside dismisses it", () => {
  // Read here so the assertions below cannot pass while the contract says the opposite — and so a
  // kind that stops declaring it fails loudly instead of asserting a rule it no longer has.
  //
  // Not a boolean: the capability names the interaction, and `capabilityOf` refuses to reduce it to
  // yes or no. What matters is that it is not the one value meaning "not this kind".
  assert.notEqual(
    MDY_WIDGET_CONTRACTS.select.capabilities.dismissOnOutsidePointer, false,
    "select no longer declares that a pointer outside dismisses it",
  );
});

test("a pointer finishing outside closes the panel", async () => {
  const { elsewhere, trigger, app } = await draw();
  assert.equal(trigger.getAttribute("aria-expanded"), "true", "it never opened, so closing proves nothing");

  await clickOn(elsewhere);

  assert.equal(trigger.getAttribute("aria-expanded"), "false", "the page behind the panel was pressed and the panel stayed");
  app.unmount();
});

test("a pointer inside the panel leaves it open, though the panel is not in the field", async () => {
  const { host, trigger, app } = await draw();
  const panel = document.querySelector(`.${MDY_WIDGET_CONTRACTS.select.parts.popup.classes[0]}`);
  assert.ok(panel, "no panel was drawn");
  // The premise this test exists for: a rule written as `contains` on the field would call this
  // "outside" and dismiss on it.
  assert.equal(host.contains(panel), false, "the panel is inside the field, so this asserts nothing");

  // The filter box, not an option: choosing an option closes the panel on purpose, and a test that
  // pressed one would be asserting that a choice does not take effect. What is under attack is a
  // press inside the panel that chooses *nothing* — which is most of a panel's surface.
  const filter = panel.querySelector(`.${partClasses("select", "search")[0]}`);
  assert.ok(filter, "the panel draws no filter box, so there is nothing here that chooses nothing");
  await clickOn(filter);

  assert.equal(trigger.getAttribute("aria-expanded"), "true", "using the panel dismissed it");
  app.unmount();
});

test("a closed panel is not paying for a document listener", async () => {
  const { elsewhere, trigger, app } = await draw();
  await clickOn(elsewhere);
  assert.equal(trigger.getAttribute("aria-expanded"), "false");

  // Pressing again with nothing open must be inert: a page holding a listener for every closed
  // widget on it pays for panels nobody opened.
  await clickOn(elsewhere);

  assert.equal(trigger.getAttribute("aria-expanded"), "false", "a closed panel reacted to a press");
  app.unmount();
});
