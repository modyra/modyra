/**
 * Typing in a searchable multiselect's box narrows the list it offers.
 *
 * The controller answers this question already: `state().options` is every option the field was
 * given, and `filteredOptions` is what is left once `state().query` has narrowed them — the accessor
 * is documented as the one a host renders once a search has happened. A renderer that draws
 * `state().options` draws the unnarrowed list, and the box a person is typing into changes nothing
 * they can see while the controller quietly agrees with them.
 *
 * The count is taken from the popup's own grid rather than from the whole document: the field draws
 * a second strip for what is already chosen, and counting both would report the list as narrowing
 * whenever the two disagreed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");

const OPTIONS = [
  { value: "it", label: "Italy" },
  { value: "fr", label: "France" },
  { value: "de", label: "Germany" },
];

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  mountMdyForm(
    host,
    [{ name: "where", kind: "multiselect", label: "Where", options: OPTIONS, searchable: true }],
    { submitLabel: null },
  );
  return host.querySelector('[data-mdy-field="where"]');
}

/** The options the popup is offering, counted where they are drawn. */
const offered = () => {
  const grid = document.querySelector(".mdy-multiselect__options")
    ?? document.querySelector(".mdy-multiselect-overlay__grid");
  assert.ok(grid, "no popup grid was found, so nothing was counted");
  return grid.querySelectorAll(".mdy-chip").length;
};

test("a query narrows the options the popup offers", async () => {
  const root = mount();
  const trigger = root.querySelector(".mdy-multiselect__trigger");
  assert.ok(trigger, "the field drew no trigger, so the popup was never opened");
  trigger.click();
  await settle();

  const before = offered();
  assert.equal(before, OPTIONS.length,
    `the popup offered ${before} of ${OPTIONS.length} options before any query, so this bench is not `
    + "looking at the list it thinks it is");

  const search = document.querySelector(".mdy-multiselect__search")
    ?? document.querySelector("input[type='search']")
    ?? document.querySelector(".mdy-multiselect-overlay input");
  assert.ok(search, "the field declares itself searchable and drew no box to type in");
  search.value = "Ital";
  search.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();

  assert.equal(offered(), 1,
    "the query matched one label and the popup still offers the rest: the box narrows the "
    + "controller's list and the renderer draws the unnarrowed one");
});
