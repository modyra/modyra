/**
 * The timepicker's ranges on this renderer, matching Plain's suite of the same name.
 *
 * The contract is stated once in `@modyra/widgets`; what this asserts is that this renderer consumes
 * it, because a contract nothing consumes is the failure mode this repo has recorded three times.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
defineMdyElements();

async function picker() {
  const form = createLitForm({ value: field(null) });
  const element = await mount("mdy-timepicker-field", (el) => {
    el.field = form.f.value;
    el.label = "T";
  });
  element.querySelector(".mdy-timepicker__toggle")
    ?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await element.updateComplete;
  const [hour, minute] = element.querySelectorAll(".mdy-timepicker-segment-input");
  return { element, hour, minute, dispose: () => element.remove() };
}

const type = (input, value) => {
  input.value = value;
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const press = (input, key) =>
  input.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));

test("an hour no clock has is marked invalid", async () => {
  const p = await picker();
  // The picker defaults to the 24-hour clock, as every renderer does, so the hour past the end is
  // 23 rather than 12. The property is the same either way: an entry the segment cannot hold is
  // shown as wrong where it was typed.
  type(p.hour, "24");
  assert.equal(p.hour.getAttribute("aria-invalid"), "true");
  type(p.hour, "13");
  assert.equal(p.hour.getAttribute("aria-invalid"), null, "and stops saying so once it is right");
  p.dispose();
});

test("a minute past 59 is marked invalid, and 59 is not", async () => {
  const p = await picker();
  type(p.minute, "60");
  assert.equal(p.minute.getAttribute("aria-invalid"), "true");
  type(p.minute, "59");
  assert.equal(p.minute.getAttribute("aria-invalid"), null);
  p.dispose();
});

test("clearing a segment is not an error", async () => {
  const p = await picker();
  type(p.hour, "24");
  assert.equal(p.hour.getAttribute("aria-invalid"), "true");
  type(p.hour, "");
  assert.equal(p.hour.getAttribute("aria-invalid"), null);
  p.dispose();
});

test("the arrow keys wrap at both ends", async () => {
  const p = await picker();
  // Canonical, two digits: an arrow names a whole value rather than typing a character, so the box
  // shows the form the field writes. `0` is what a box mid-edit may hold, not what a step produces.
  type(p.hour, "23");
  press(p.hour, "ArrowUp");
  assert.equal(p.hour.value, "00", "past the end of a 24-hour clock comes back to midnight");
  press(p.hour, "ArrowDown");
  assert.equal(p.hour.value, "23");

  type(p.minute, "59");
  press(p.minute, "ArrowUp");
  assert.equal(p.minute.value, "00");
  p.dispose();
});

test("the segments advertise their own range", async () => {
  const p = await picker();
  type(p.hour, "1");
  type(p.minute, "0");
  assert.equal(p.hour.min, "0");
  assert.equal(p.hour.max, "23");
  assert.equal(p.minute.min, "0");
  assert.equal(p.minute.max, "59");
  p.dispose();
});
