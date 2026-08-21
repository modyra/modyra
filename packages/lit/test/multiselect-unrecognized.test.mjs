/**
 * The same rule for a widget that holds several values.
 *
 * What a widget will not erase, it has to show — and what it shows, the user can take off.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");

defineMdyElements();

const options = [{ value: "food", label: "Food" }, { value: "drinks", label: "Drinks" }];

/** The chips, by their text. An empty one is the grid's own affordance, not an option. */
/**
 * What the closed control shows, which is what was *chosen* rather than what is on offer.
 *
 * The options moved into the popup, so reading them here would read a shut overlay. The strip is
 * where a held value the catalogue does not contain becomes visible — and it is a better place for
 * it than the old inline grid, because it is visible without opening anything.
 */
const chipTexts = (element) =>
  [...element.querySelectorAll(".mdy-multiselect__chips .mdy-chip__label")]
    .map((el) => el.textContent.trim())
    .filter((text) => text.length > 0);

test("a held value the options do not contain is kept and shown", async () => {
  const form = createLitForm({ tags: field(["food", "imported-tag"]) });

  const element = await mount("mdy-multiselect-field", (el) => {
    el.field = form.f.tags;
    el.options = options;
    el.label = "Tags";
  });

  assert.deepEqual(form.value().tags, ["food", "imported-tag"]);
  assert.ok(chipTexts(element).some((text) => text.includes("imported-tag")));
});

test("a value the options contain adds nothing", async () => {
  const form = createLitForm({ tags: field(["food"]) });

  const element = await mount("mdy-multiselect-field", (el) => {
    el.field = form.f.tags;
    el.options = options;
    el.label = "Tags";
  });

  // One chip, for the one value held. The other option is on offer, not chosen, and the strip says
  // what was chosen — the distinction the old inline grid could not draw.
  assert.deepEqual(chipTexts(element), ["Food"]);
});

test("options that have not loaded still show what is held", async () => {
  const form = createLitForm({ tags: field(["pending"]) });

  const element = await mount("mdy-multiselect-field", (el) => {
    el.field = form.f.tags;
    el.options = [];
    el.label = "Tags";
  });

  // The value survives an empty catalogue and so does its chip: an empty list is a list that has not
  // arrived, not one that refuses the value.
  assert.deepEqual(chipTexts(element), ["pending"]);
  assert.deepEqual(form.value().tags, ["pending"]);
});
