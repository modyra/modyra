/**
 * Naming a control that has no visible label.
 *
 * A cell in a table, a control in a toolbar: the column header or the icon says what it is to
 * someone who can see it, and a screen reader meets the control on its own. The rule under test is
 * that the name lands on the control, and only while nothing visible carries it — two names for one
 * thing is how a spoken name comes to disagree with a written one.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { renderField } = await import("../dist/index.js");
const { createForm, field } = await import("@modyra/core");

const host = () => {
  const el = document.createElement("div");
  document.body.append(el);
  return el;
};

test("a control with no visible label is named by ariaLabel", () => {
  const form = createForm({ n: field("") });
  const container = host();

  renderField(container, { name: "n", kind: "text", ariaLabel: "Item, row 12" }, form.f.n);

  const input = container.querySelector("input");
  assert.equal(input.getAttribute("aria-label"), "Item, row 12");
});

test("an explicit name wins over the visible label", () => {
  const form = createForm({ n: field("") });
  const container = host();

  renderField(
    container,
    { name: "n", kind: "text", label: "Item", ariaLabel: "Item, row 12" },
    form.f.n,
  );

  const input = container.querySelector("input");
  assert.equal(input.getAttribute("aria-label"), "Item, row 12");
  assert.match(container.querySelector("label").textContent, /Item/);
});

test("a labelled control is named by its label, without the required marker", () => {
  const form = createForm({ n: field("", [(v) => (v ? [] : ["req"])]) });
  const container = host();

  renderField(
    container,
    { name: "n", kind: "text", label: "Item", validators: { required: true } },
    form.f.n,
  );

  const input = container.querySelector("input");
  assert.equal(input.getAttribute("aria-label"), "Item", "the asterisk is decoration, not a name");
  assert.match(container.querySelector("label").textContent, /\*/, "which the label still shows");
});

test("a field nobody named is named by the field", () => {
  const form = createForm({ n: field("") });
  const container = host();

  renderField(container, { name: "n", kind: "text" }, form.f.n);

  // A label is optional in a document by design, and a control with no accessible name is announced
  // as its role and nothing else. The field's own name is what is left to say — and in a document a
  // name is a single segment, in practice the label's own word.
  assert.equal(container.querySelector("input").getAttribute("aria-label"), "n");
});
