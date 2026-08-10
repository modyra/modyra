/**
 * The same rule, offered by a different renderer.
 *
 * The bound belongs to the field, so every renderer of the contract reaches the same answer without
 * being told it twice; an attribute on the element narrows what this control offers.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field, max, min } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");

defineMdyElements();

const inputOf = (element) => element.querySelector("input");

test("the input offers the range the field's validators state", async () => {
  const form = createLitForm({ quantity: field(0, [min(0), max(255)]) });

  const element = await mount("mdy-number-field", (el) => {
    el.field = form.f.quantity;
  });

  assert.equal(inputOf(element).getAttribute("min"), "0");
  assert.equal(inputOf(element).getAttribute("max"), "255");
});

test("an attribute narrows what this control offers", async () => {
  const form = createLitForm({ quantity: field(0, [min(0), max(255)]) });

  const element = await mount("mdy-number-field", (el) => {
    el.field = form.f.quantity;
    el.min = 10;
  });

  assert.equal(inputOf(element).getAttribute("min"), "10", "the control asks for less");
  assert.equal(inputOf(element).getAttribute("max"), "255", "and inherits the rest");
});

test("a field with no rule offers no constraint", async () => {
  const form = createLitForm({ quantity: field(0) });

  const element = await mount("mdy-number-field", (el) => {
    el.field = form.f.quantity;
  });

  assert.equal(inputOf(element).getAttribute("min"), null);
  assert.equal(inputOf(element).getAttribute("max"), null);
});
