/**
 * Opening a panel puts focus on the thing the panel was opened to operate.
 *
 * Five kinds already answered that way in every renderer — a select lands on its filter box, a
 * calendar on a day, a timepicker on the hour, a colours field on a swatch. The multiselect did not:
 * it landed on an option here, on a filter box there, and stayed on the trigger in this renderer.
 * Both are patterns a combobox may follow, and that is the problem — a person met one of them here
 * and the other next door. The contract now names the part, and this asserts the part is where focus
 * went. ADR 0197.
 *
 * **The configuration is named beside every assertion**, because the answer depends on it: a panel
 * with a filter box opens on the box, one without opens on the first option. Two runs that differ in
 * configuration and are read as one are two answers to a question nobody asked twice.
 *
 * **And the focus is asserted to have landed, not the click to have happened.** In this environment a
 * `click()` does not move focus the way a pointer press does, so a run that only pressed can report
 * "focus is on the body" about a control that is fine. The trigger is focused first — the state a
 * pointer leaves — and the panel is asserted open before the landing is read.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
const { focusPartOnOpen, partClasses } = await import("@modyra/widgets");

defineMdyElements();

const settle = async (element) => {
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 80));
  await element.updateComplete;
};

async function openMultiselect({ searchable }) {
  const form = createLitForm({ v: field([]) });
  const element = await mount("mdy-multiselect-field", (host) => {
    host.field = form.f.v;
    host.label = "Where";
    host.options = [{ value: "x", label: "X" }, { value: "y", label: "Y" }];
    if (searchable) host.searchable = true;
  });
  await settle(element);

  const opener = element.querySelector("[aria-expanded]");
  assert.ok(opener, "the field drew no opener, so nothing was opened");
  opener.focus();
  assert.equal(document.activeElement, opener, "the trigger did not take focus, so the press is being read from the wrong place");
  opener.click();
  await settle(element);
  assert.equal(opener.getAttribute("aria-expanded"), "true", "the panel did not open, so where focus went says nothing about opening");
  return element;
}

for (const searchable of [false, true]) {
  test(`a multiselect with searchable=${searchable} opens on the part the contract names`, async () => {
    const element = await openMultiselect({ searchable });
    const part = focusPartOnOpen("multiselect", { searchable });
    const expected = partClasses("multiselect", part)[0];

    const landed = document.activeElement;
    assert.notEqual(landed, document.body, "focus is on the document: the panel opened and the keyboard is nowhere");
    assert.ok(
      landed.classList.contains(expected),
      `focus landed on ${landed.tagName.toLowerCase()}.${landed.className} and the contract names `
      + `"${part}" (.${expected}) for searchable=${searchable}`,
    );
  });
}
