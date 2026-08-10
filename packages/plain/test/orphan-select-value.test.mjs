/**
 * A value the option list does not contain, in the framework-free renderer.
 *
 * Same rule, third implementation: a value the widget will not erase is a value it has to show.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { renderField } = await import("../dist/index.js");
const { createForm, field, vanillaReactivity } = await import("@modyra/core");

const options = [
  { value: "drinks", label: "Drinks" },
  { value: "food", label: "Food" },
];

/** The listbox is built when the trigger opens it, which is where the option list can be counted. */
const openedOptions = async (container, rx) => {
  const trigger = container.querySelector(".mdy-select__trigger");
  trigger.dispatchEvent(new window.Event("click"));
  await rx.flush();
  const listbox = document.getElementById(trigger.getAttribute("aria-controls"));
  return [...listbox.querySelectorAll("li")].map((li) => li.textContent.trim());
};

/**
 * A clean document per test: the popup is portalled to the body and its id derives from the field
 * name, so a leftover from the previous test answers to the same id as this one's.
 */
const host = () => {
  document.body.innerHTML = "";
  const el = document.createElement("div");
  document.body.append(el);
  return el;
};

const config = (extra = {}) => ({ name: "category", kind: "select", label: "Category", options, ...extra });

test("the value stays in the form and appears among the options", async () => {
  const rx = vanillaReactivity();
  const form = createForm({ category: field("ZT Invented Category") }, { reactivity: rx });

  const container = host();
  renderField(container, config(), form.f.category, rx);

  assert.equal(form.value().category, "ZT Invented Category");
  assert.deepEqual(
    await openedOptions(container, rx),
    ["ZT Invented Category", "Drinks", "Food"],
    "the value the user has to correct is in the list, first",
  );
});

test("a value the list contains adds nothing", async () => {
  const rx = vanillaReactivity();
  const form = createForm({ category: field("food") }, { reactivity: rx });

  const container = host();
  renderField(container, config(), form.f.category, rx);

  assert.deepEqual(await openedOptions(container, rx), ["Drinks", "Food"]);
});

test("options that have not loaded show nothing extra", async () => {
  const rx = vanillaReactivity();
  const form = createForm({ category: field("pending") }, { reactivity: rx });

  const container = host();
  renderField(container, config({ options: [] }), form.f.category, rx);

  assert.deepEqual(await openedOptions(container, rx), []);
  assert.equal(form.value().category, "pending");
});
