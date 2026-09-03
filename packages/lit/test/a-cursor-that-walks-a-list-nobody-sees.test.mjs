/**
 * With the list narrowed by a query, the keyboard cursor stays inside what is on screen.
 *
 * A searchable panel has two lists in play: the one drawn, and the one the controller moves its
 * cursor through. They are the same list only if the controller has been told about the query — the
 * cursor is the controller's, and it steps through the options the controller believes are visible.
 *
 * `aria-activedescendant` is the join between them: it names, on the box a person is typing into, the
 * option the cursor is on. If the cursor is walking a list the panel is not drawing, the reference
 * lands on an element that is not there — and a reader is told about an option nobody can see, in a
 * panel showing something else.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");

defineMdyElements();

const OPTIONS = [
  { value: "it", label: "Italy" },
  { value: "fr", label: "France" },
  { value: "de", label: "Germany" },
];

const settle = async (element) => {
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
};

async function open() {
  const form = createLitForm({ where: field([]) });
  const element = await mount("mdy-multiselect-field", (el) => {
    el.field = form.f.where;
    el.label = "Where";
    el.options = OPTIONS;
    el.searchable = true;
  });
  await settle(element);
  const trigger = element.querySelector(".mdy-multiselect__trigger");
  assert.ok(trigger, "no trigger was drawn, so the panel was never opened");
  trigger.click();
  await settle(element);
  return element;
}

/**
 * The option ids the panel is actually drawing.
 *
 * Read from the document rather than from the element: the panel is portalled to the body so no
 * scrolling ancestor can clip it, so a search scoped to the element finds an open panel's options
 * nowhere and reports every list as empty.
 */
const drawnIds = () =>
  Array.from(document.querySelectorAll(".mdy-multiselect-overlay__grid [id]"))
    .map((el) => el.id)
    .filter((id) => id.includes("__opt__"));

// Both queries, and the pair is the point: "Ital" leaves the first option standing, which is also
// where a cursor stepping the unnarrowed list starts — so it agrees with a renderer that never heard
// the query, and passing it proves nothing. "Germ" leaves the last one.
for (const [query, expected] of [["Ital", "it"], ["Germ", "de"]]) {
test(`the cursor names an option the panel is drawing, with "${query}" narrowing it`, async () => {
  const element = await open();

  const before = drawnIds();
  assert.ok(before.length >= 3, `the panel drew ${before.length} options before any query, so a narrowing cannot be seen`);

  const search = document.querySelector(".mdy-multiselect-overlay__input");
  assert.ok(search, "the panel declares itself searchable and drew no box to type in");
  search.value = query;
  search.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(element);

  const narrowed = drawnIds();
  assert.ok(narrowed.length < before.length,
    `the query narrowed nothing — ${narrowed.length} of ${before.length} still drawn — so what the `
    + "cursor walks cannot be compared against what is on screen");

  search.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  await settle(element);

  const named = search.getAttribute("aria-activedescendant");
  assert.ok(named, "the cursor moved and named nothing, so the reference cannot be checked");
  assert.ok(narrowed.includes(named),
    `the cursor is on an option the panel is not drawing: it names ${named}, and what is on screen is `
    + `${narrowed.join(", ")} — the controller is stepping through a list it was never told the query about`);
  assert.ok(named.endsWith(expected),
    `the cursor names ${named}, and the option the query left is the one ending in ${expected}`);
});
}
