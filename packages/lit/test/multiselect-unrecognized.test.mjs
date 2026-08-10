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
const chipTexts = (element) =>
  [...element.querySelectorAll("[role='group'] button, [role='group'] div[title]")]
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

  assert.deepEqual(chipTexts(element).sort(), ["Drinks", "Food"]);
});

test("options that have not loaded show nothing extra", async () => {
  const form = createLitForm({ tags: field(["pending"]) });

  const element = await mount("mdy-multiselect-field", (el) => {
    el.field = form.f.tags;
    el.options = [];
    el.label = "Tags";
  });

  assert.deepEqual(chipTexts(element), []);
  assert.deepEqual(form.value().tags, ["pending"]);
});
