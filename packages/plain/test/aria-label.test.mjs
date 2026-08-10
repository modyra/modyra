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

test("a visible label wins: the control is not named twice", () => {
  const form = createForm({ n: field("") });
  const container = host();

  renderField(
    container,
    { name: "n", kind: "text", label: "Item", ariaLabel: "Something else" },
    form.f.n,
  );

  const input = container.querySelector("input");
  assert.equal(input.getAttribute("aria-label"), null, "the label already names it, natively");
  assert.match(container.querySelector("label").textContent, /Item/);
});

test("no name at all leaves the control as it was", () => {
  const form = createForm({ n: field("") });
  const container = host();

  renderField(container, { name: "n", kind: "text" }, form.f.n);

  assert.equal(container.querySelector("input").getAttribute("aria-label"), null);
});
