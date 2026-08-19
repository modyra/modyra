/**
 * The same rules, the same attributes, a second renderer.
 *
 * The translation lives in the contract, so what a renderer has to do is place the attributes — and
 * a test in each renderer is what keeps "the same" from becoming an assumption.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field, compose, integer, max, maxLength, min, minLength, pattern, required } =
  await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");

defineMdyElements();

const inputOf = (element) => element.querySelector("input");

test("length rules and a pattern reach a text input", async () => {
  const form = createLitForm({
    code: field("", [minLength(3), maxLength(8), pattern(/^[A-Z]+$/)]),
  });

  const element = await mount("mdy-text-field", (el) => {
    el.field = form.f.code;
    el.label = "Code";
  });

  const input = inputOf(element);
  assert.equal(input.getAttribute("minlength"), "3");
  assert.equal(input.getAttribute("maxlength"), "8");
  // Wrapped, not copied: `pattern` is implicitly anchored by the platform, so a rule is projected as
  // the platform reads one.
  assert.equal(input.getAttribute("pattern"), "(?:^[A-Z]+$)");
});

test("a composed rule declares what it combines", async () => {
  const form = createLitForm({ note: field("", [compose(required(), maxLength(10))]) });

  const element = await mount("mdy-text-field", (el) => {
    el.field = form.f.note;
    el.label = "Note";
  });

  assert.equal(inputOf(element).getAttribute("maxlength"), "10");
  assert.equal(form.f.note.required(), true);
});

test("a whole-number rule moves the spinner by one", async () => {
  const form = createLitForm({ qty: field(0, [integer(), min(0), max(255)]) });

  const element = await mount("mdy-number-field", (el) => {
    el.field = form.f.qty;
    el.label = "Qty";
  });

  const input = inputOf(element);
  assert.equal(input.getAttribute("min"), "0");
  assert.equal(input.getAttribute("max"), "255");
  assert.equal(input.getAttribute("step"), "1");
});

test("the attribute constrains typing, never the model", async () => {
  const form = createLitForm({ note: field("", [maxLength(5)]) });

  const element = await mount("mdy-text-field", (el) => {
    el.field = form.f.note;
    el.label = "Note";
  });

  form.f.note.set("far longer than five");

  assert.equal(form.value().note, "far longer than five", "kept whole");
  assert.equal(form.f.note.valid(), false, "and judged by the rule");
  assert.equal(inputOf(element).getAttribute("maxlength"), "5");
});

test("a field with no rules carries no constraint", async () => {
  const form = createLitForm({ note: field("") });

  const element = await mount("mdy-text-field", (el) => {
    el.field = form.f.note;
    el.label = "Note";
  });

  for (const name of ["minlength", "maxlength", "pattern"]) {
    assert.equal(inputOf(element).getAttribute(name), null, `${name} was invented`);
  }
});
