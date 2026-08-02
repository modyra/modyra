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

test("an hour past 12 is marked invalid", async () => {
  const p = await picker();
  type(p.hour, "13");
  assert.equal(p.hour.getAttribute("aria-invalid"), "true");
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
  type(p.hour, "13");
  assert.equal(p.hour.getAttribute("aria-invalid"), "true");
  type(p.hour, "");
  assert.equal(p.hour.getAttribute("aria-invalid"), null);
  p.dispose();
});

test("the arrow keys wrap at both ends", async () => {
  const p = await picker();
  type(p.hour, "12");
  press(p.hour, "ArrowUp");
  assert.equal(p.hour.value, "1");
  press(p.hour, "ArrowDown");
  assert.equal(p.hour.value, "12");

  type(p.minute, "59");
  press(p.minute, "ArrowUp");
  assert.equal(p.minute.value, "0");
  p.dispose();
});

test("the segments advertise their own range", async () => {
  const p = await picker();
  type(p.hour, "1");
  type(p.minute, "0");
  assert.equal(p.hour.min, "1");
  assert.equal(p.hour.max, "12");
  assert.equal(p.minute.min, "0");
  assert.equal(p.minute.max, "59");
  p.dispose();
});
