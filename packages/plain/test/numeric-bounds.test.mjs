/**
 * The constraint a control offers is the rule the field carries.
 *
 * Stated twice — once as a validator, once on the control — the two are free to disagree, and the
 * form accepts at the keyboard what it rejects on submit. The config still wins where it speaks: a
 * control may offer less than the field accepts, never more.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { renderField } = await import("../dist/index.js");
const { createForm, field, max, min, vanillaReactivity } = await import("@modyra/core");

const host = () => {
  const el = document.createElement("div");
  document.body.append(el);
  return el;
};

const numberField = (name) => ({ name, kind: "number", label: "Quantity" });
const inputOf = (container) => container.querySelector("input");

test("the input offers the range the field's validators state", () => {
  const rx = vanillaReactivity();
  const form = createForm({ quantity: field(0, [min(0), max(255)]) }, { reactivity: rx });

  const container = host();
  renderField(container, numberField("quantity"), form.f.quantity, rx);

  assert.equal(inputOf(container).getAttribute("min"), "0");
  assert.equal(inputOf(container).getAttribute("max"), "255");
});

test("a field with no rule offers no constraint", () => {
  const rx = vanillaReactivity();
  const form = createForm({ quantity: field(0) }, { reactivity: rx });

  const container = host();
  renderField(container, numberField("quantity"), form.f.quantity, rx);

  assert.equal(inputOf(container).getAttribute("min"), null);
  assert.equal(inputOf(container).getAttribute("max"), null);
});

test("the config narrows what this control offers", () => {
  const rx = vanillaReactivity();
  const form = createForm({ quantity: field(0, [min(0), max(255)]) }, { reactivity: rx });

  const container = host();
  renderField(container, { ...numberField("quantity"), min: 10 }, form.f.quantity, rx);

  assert.equal(inputOf(container).getAttribute("min"), "10", "the control asks for less");
  assert.equal(inputOf(container).getAttribute("max"), "255", "and inherits the rest");
});
