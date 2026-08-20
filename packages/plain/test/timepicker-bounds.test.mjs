/**
 * The timepicker's ranges, as the user meets them.
 *
 * The contract states them in `@modyra/widgets`; this asserts this renderer actually consumes it.
 * A contract that is declared and not consumed is the failure mode this repo has recorded three
 * times — `widgetKeyIntent`, `restore-focus`, `dateWithinBounds` — so the wiring is what is checked
 * here, not the arithmetic.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

async function picker() {
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountMdyForm(host, [{ name: "t", kind: "timepicker", label: "T" }], { submitLabel: null });
  await settle();
  const root = host.querySelector('[data-mdy-field="t"]');
  root.querySelector(".mdy-timepicker__toggle").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settle();
  const [hour, minute] = root.querySelectorAll(".mdy-timepicker-segment-input");
  return { root, hour, minute, dispose: () => { mounted.dispose(); host.remove(); } };
}

const type = (input, value) => {
  input.value = value;
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const press = (input, key) =>
  input.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));

test("an hour no clock has is marked invalid rather than silently dropped", async () => {
  const p = await picker();
  // A document-driven picker is a 24-hour one, so the hour past the end is 23 rather than 12. What
  // the property says is the same either way: an entry the segment cannot hold is shown as wrong
  // where it was typed, instead of vanishing.
  type(p.hour, "24");
  assert.equal(p.hour.getAttribute("aria-invalid"), "true", "the box must say the entry is wrong");
  type(p.hour, "13");
  assert.equal(p.hour.getAttribute("aria-invalid"), null, "and stop saying so once it is right");
  p.dispose();
});

test("a minute past 59 is marked invalid", async () => {
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
  assert.equal(p.hour.getAttribute("aria-invalid"), null, "an empty box is being cleared, not asserted");
  p.dispose();
});

test("the arrow keys wrap rather than stopping at the end", async () => {
  const p = await picker();
  type(p.hour, "23");
  press(p.hour, "ArrowUp");
  assert.equal(p.hour.value, "0", "past the end of a 24-hour clock comes back to midnight");

  press(p.hour, "ArrowDown");
  assert.equal(p.hour.value, "23", "and back again");

  type(p.minute, "59");
  press(p.minute, "ArrowUp");
  assert.equal(p.minute.value, "0", "a minute rolls over at 59");
  p.dispose();
});

test("stepping rescues a segment that is already out of range", async () => {
  const p = await picker();
  type(p.hour, "99");
  assert.equal(p.hour.getAttribute("aria-invalid"), "true");

  press(p.hour, "ArrowUp");
  assert.equal(p.hour.getAttribute("aria-invalid"), null, "stepping is how a user leaves a bad value");
  assert.ok(Number(p.hour.value) >= 0 && Number(p.hour.value) <= 23, `got ${p.hour.value}`);
  p.dispose();
});

test("the segments advertise their own range", async () => {
  const p = await picker();
  assert.equal(p.hour.min, "0");
  assert.equal(p.hour.max, "23");
  assert.equal(p.minute.min, "0");
  assert.equal(p.minute.max, "59");
  p.dispose();
});
