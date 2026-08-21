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

/**
 * What the closed field shows, which is what was *chosen* rather than what is on offer.
 *
 * The options moved into the popup, so reading them here would read a shut overlay. The strip is
 * where a held value the catalogue does not contain becomes visible — and it is a better place for
 * it than the old inline grid, because it is visible without opening anything.
 */
const chipTexts = (container) =>
  [...container.querySelectorAll(".mdy-multiselect__chips .mdy-chip")].map((el) => el.textContent.trim());

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

  const chip = [...container.querySelectorAll(".mdy-multiselect__chips .mdy-chip")].find((el) =>
    el.textContent.includes("imported-tag"),
  );
  // The chip is a container now, and the control that takes the value off is named inside it: a
  // click anywhere on the chip would be a click on whatever the person happened to hit.
  chip.querySelector(".mdy-chip__remove").dispatchEvent(new window.Event("click", { bubbles: true }));
  await rx.flush();

  assert.deepEqual(form.value().tags, ["food"], "showing it is what makes it removable");
});

test("a value the options do contain adds nothing", () => {
  const { container } = mount(["food"]);

  // One chip, for the one value held. The other option is on offer, not chosen, and the strip says
  // what was chosen — the distinction the old inline grid could not draw.
  assert.deepEqual(chipTexts(container), ["Food"]);
});

test("options that have not loaded still show what is held", () => {
  const { form, container } = mount(["pending"], []);

  // The value survives an empty catalogue and so does its chip: an empty list is a list that has not
  // arrived, not one that refuses the value.
  assert.deepEqual(chipTexts(container), ["pending"]);
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
