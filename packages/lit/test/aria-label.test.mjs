/**
 * Naming a Lit control that has no visible label.
 *
 * The host takes `aria-label` because that is what an author writes; the element moves it onto the
 * control, because the name belongs to the thing the user operates — and lets it go when a visible
 * label arrives, so the two never disagree.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");

defineMdyElements();

test("the name given to the element lands on the control", async () => {
  const form = createLitForm({ n: field("") });
  const element = await mount("mdy-text-field", (el) => {
    el.field = form.f.n;
    el.setAttribute("aria-label", "Item, row 12");
  });

  assert.equal(element.querySelector("input").getAttribute("aria-label"), "Item, row 12");
  assert.equal(
    element.hasAttribute("aria-label"),
    false,
    "and not on the element, which would be a second named thing",
  );
});

test("an explicit name wins over the visible label", async () => {
  const form = createLitForm({ n: field("") });
  const element = await mount("mdy-text-field", (el) => {
    el.field = form.f.n;
    el.setAttribute("aria-label", "Item, row 12");
    el.label = "Item";
  });

  assert.equal(element.querySelector("input").getAttribute("aria-label"), "Item, row 12");
  assert.match(element.querySelector("label").textContent, /Item/);
});

test("a labelled control is named by its label", async () => {
  const form = createLitForm({ n: field("") });
  const element = await mount("mdy-text-field", (el) => {
    el.field = form.f.n;
    el.label = "Item";
  });

  assert.equal(element.querySelector("input").getAttribute("aria-label"), "Item");
});
