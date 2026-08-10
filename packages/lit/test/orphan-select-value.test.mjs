/**
 * A value the option list does not contain, in a second renderer.
 *
 * The rule belongs to the contract, not to one framework: the widget does not erase a value to make
 * itself consistent, and what it cannot erase it has to show.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");

defineMdyElements();

const options = [
  { value: "drinks", label: "Drinks" },
  { value: "food", label: "Food" },
];

test("the value stays in the form and appears in the list", async () => {
  const form = createLitForm({ category: field("ZT Invented Category") });

  const element = await mount("mdy-select-field", (el) => {
    el.field = form.f.category;
    el.options = options;
    el.label = "Category";
  });

  assert.equal(form.value().category, "ZT Invented Category", "nothing erased it");
  const rendered = [...element.querySelectorAll("option")].map((option) => option.textContent);
  assert.ok(rendered.includes("ZT Invented Category"), "and it is on screen");
});

test("a value the list contains adds nothing", async () => {
  const form = createLitForm({ category: field("food") });

  const element = await mount("mdy-select-field", (el) => {
    el.field = form.f.category;
    el.options = options;
    el.label = "Category";
  });

  assert.equal([...element.querySelectorAll("option")].length, options.length);
});

test("options that have not loaded show nothing extra", async () => {
  const form = createLitForm({ category: field("pending") });

  const element = await mount("mdy-select-field", (el) => {
    el.field = form.f.category;
    el.options = [];
    el.label = "Category";
  });

  assert.equal([...element.querySelectorAll("option")].length, 0);
  assert.equal(form.value().category, "pending");
});

test("an application can name what the list cannot", async () => {
  const espresso = { id: 1 };
  const cornetto = { id: 2 };
  const form = createLitForm({ category: field(cornetto) });

  const element = await mount("mdy-select-field", (el) => {
    el.field = form.f.category;
    el.options = [{ value: espresso, label: "Espresso" }];
    el.label = "Category";
    // Without this an object value renders as "[object Object]", which is the honest name and a
    // useless one — naming it is the whole reason the hook exists.
    el.unknownOptionLabel = (value) => `Unknown item #${value.id}`;
  });

  const rendered = [...element.querySelectorAll("option")].map((option) => option.textContent);
  assert.ok(rendered.includes("Unknown item #2"));
});
