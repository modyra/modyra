/**
 * A multiselect holding a value its options do not contain.
 *
 * The rule is the contract's, not this renderer's: what a widget will not erase, it has to show —
 * and what it shows, the user can take off. An imported tag that no longer exists in the catalogue
 * is the ordinary way a value gets here, and it is precisely the one a person has to see in order
 * to resolve it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { renderField } = await import("../dist/index.js");
const { createForm, field, vanillaReactivity } = await import("@modyra/core");

const options = [{ value: "food", label: "Food" }, { value: "drinks", label: "Drinks" }];

const host = () => {
  document.body.innerHTML = "";
  const el = document.createElement("div");
  document.body.append(el);
  return el;
};

const mount = (values, list = options) => {
  const rx = vanillaReactivity();
  const form = createForm({ tags: field(values) }, { reactivity: rx });
  const container = host();
  renderField(container, { name: "tags", kind: "multiselect", label: "Tags", options: list }, form.f.tags, rx);
  return { form, container, rx };
};

const chipTexts = (container) =>
  [...container.querySelectorAll("[role='group'] button")].map((el) => el.textContent.trim());

test("the value is kept, and it is on screen", () => {
  const { form, container } = mount(["food", "imported-tag"]);

  assert.deepEqual(form.value().tags, ["food", "imported-tag"], "nothing erased it");
  assert.ok(
    chipTexts(container).some((text) => text.includes("imported-tag")),
    "and the person who has to correct it can see it",
  );
});

test("the chip standing for it takes it off", async () => {
  const { form, container, rx } = mount(["food", "imported-tag"]);

  const chip = [...container.querySelectorAll("[role='group'] button")].find((el) =>
    el.textContent.includes("imported-tag"),
  );
  chip.dispatchEvent(new window.Event("click", { bubbles: true }));
  await rx.flush();

  assert.deepEqual(form.value().tags, ["food"], "showing it is what makes it removable");
});

test("a value the options do contain adds nothing", () => {
  const { container } = mount(["food"]);

  assert.deepEqual(chipTexts(container).sort(), ["Drinks", "Food"]);
});

test("options that have not loaded show nothing extra", () => {
  const { form, container } = mount(["pending"], []);

  assert.deepEqual(chipTexts(container), [], "an empty list is not a list that refuses the value");
  assert.deepEqual(form.value().tags, ["pending"]);
});

test("a value arriving after the widget was built brings its own chip", async () => {
  const { form, container, rx } = mount(["food"]);
  assert.equal(chipTexts(container).some((t) => t.includes("late-tag")), false);

  form.f.tags.set(["food", "late-tag"]);
  await rx.flush();

  assert.ok(
    chipTexts(container).some((text) => text.includes("late-tag")),
    "a record loading after the form was rendered is the ordinary case",
  );
});
