/**
 * A chosen value that is an object, carried through the gestures that act on one chip.
 *
 * An options list usually holds objects — `{id, name}` — and the widget tells one chosen value from
 * another by a key derived from it. The contract derives a *structural* key, so two objects with
 * different contents are two chips. A renderer deriving its own with `String(value)` gets
 * `"[object Object]"` for every one of them: the strip still paints correctly, because painting
 * reads the controller, and every gesture that indexes into the strip then acts on a list of one.
 *
 * The gestures below are the ones that index: carrying a chip, and stepping it with the pointer
 * control. Neither is exercised anywhere with a value that is not a string, which is how the
 * divergence survived — the whole suite agreed with the wrong key, because on strings it is right.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");

defineMdyElements();

const RED = { id: 1, name: "Red" };
const BLUE = { id: 2, name: "Blue" };
const GREEN = { id: 3, name: "Green" };

const press = (element, key) =>
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

async function strip(values) {
  const form = createLitForm({ tags: field(values) });
  const element = await mount("mdy-multiselect-field", (el) => {
    el.field = form.f.tags;
    el.options = values.map((value) => ({ value, label: value.name }));
    el.label = "Tags";
    el.reorderable = true;
  });
  return {
    element,
    chips: () => [...element.querySelectorAll(".mdy-multiselect__chips [data-key]")],
    names: () => form.value().tags.map((value) => value.name).join(" "),
  };
}

test("the strip draws one chip per distinct object, not one for all of them", async () => {
  const it = await strip([RED, BLUE, GREEN]);
  assert.equal(it.chips().length, 3,
    "three distinct objects were chosen. One chip means the keys collapsed, and every gesture that "
    + "indexes into the strip is now indexing into a list of one");
});

test("a carried chip moves one place, the same as a carried string would", async () => {
  const it = await strip([RED, BLUE, GREEN]);
  const first = it.chips()[0];
  press(first, "Enter");
  await it.element.updateComplete;
  press(first, "ArrowRight");
  await it.element.updateComplete;
  assert.equal(it.names(), "Blue Red Green");
});

test("after a removal the reading position lands on the chip that took its place", async () => {
  // The gesture that looks a chip up *by key*. A structural key carries quotes, and a quote inside an
  // attribute selector closes it — the browser raises `SyntaxError` rather than returning nothing.
  //
  // Asserted through where focus lands rather than by catching the raise: it happens on a later beat,
  // inside a promise nobody awaits, so it surfaces as an unhandled rejection and not as a failure at
  // the gesture. What a person experiences is the reading position going nowhere, and that is what
  // this reads.
  const it = await strip([RED, BLUE, GREEN]);
  const removeFirst = it.chips()[0].querySelector(".mdy-chip__remove");
  assert.ok(removeFirst !== null, "the chip offers no removal, so this asserts nothing");

  removeFirst.click();
  await it.element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(it.names(), "Blue Green");
  const landed = it.element.ownerDocument.activeElement;
  assert.ok(landed !== null && landed !== it.element.ownerDocument.body,
    "focus is on the document body, which is where it goes when nothing claimed it");
  assert.ok(it.chips()[0].contains(landed),
    "focus left the strip. The chip that took the removed one's place is what a person is reading");
});
