/** The same range, resolved the same way, in a third renderer. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field, max, min } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");

defineMdyElements();

const inputOf = (element) => element.querySelector("input");

test("the track spans the range the field's rules state", async () => {
  const form = createLitForm({ level: field(30, [min(10), max(50)]) });

  const element = await mount("mdy-slider-field", (el) => {
    el.field = form.f.level;
    el.label = "Level";
  });

  assert.equal(inputOf(element).getAttribute("min"), "10");
  assert.equal(inputOf(element).getAttribute("max"), "50");
});

test("with no rule the track is what a bare range input assumes", async () => {
  const form = createLitForm({ level: field(50) });

  const element = await mount("mdy-slider-field", (el) => {
    el.field = form.f.level;
    el.label = "Level";
  });

  assert.equal(inputOf(element).getAttribute("min"), "0");
  assert.equal(inputOf(element).getAttribute("max"), "100");
});

test("an attribute narrows the track without touching the rule", async () => {
  const form = createLitForm({ level: field(30, [min(10), max(50)]) });

  const element = await mount("mdy-slider-field", (el) => {
    el.field = form.f.level;
    el.label = "Level";
    el.min = 20;
  });

  assert.equal(inputOf(element).getAttribute("min"), "20");
  assert.equal(inputOf(element).getAttribute("max"), "50");
});
