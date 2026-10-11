/**
 * A quantity changes from the keyboard, and a number field carries the steppers it declares.
 *
 * The number field's `increment` and `decrement` are trailing parts of the kind; without them the
 * promise is kept by the platform's spinner or by nothing, depending on the browser. A press steps by
 * the field's own step and stops at its bounds, so a stepped value meets the same rules a typed one
 * does.
 *
 * A counter chip's steppers are pointer affordances out of the tab order, so `ArrowUp` and
 * `ArrowDown` on the chip are the only way to its number without a mouse. Read as the field's keys
 * they opened the list instead, which is why the open state is asserted beside the value.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { installDomGlobals } from "./support/dom-env.mjs";
installDomGlobals();
const cfg = await import("../conformance.config.mjs");

const press = (element, key) =>
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

test("a number field draws its two steppers, and they step within the field's bounds", async () => {
  const fixture = await cfg.mount("number", { value: 4, rules: { max: 5 } });
  await fixture.settle?.();

  const up = fixture.root.querySelector(".mdy-spin-btn-up");
  const down = fixture.root.querySelector(".mdy-spin-btn-down");
  assert.ok(up && down, "the number field draws no steppers, though the contract declares two");
  assert.equal(up.getAttribute("tabindex"), "-1", "a stepper is a tab stop the box already provides");
  assert.ok(up.getAttribute("aria-label"), "a stepper with no name is a button nobody can identify");

  up.click();
  up.click();
  await fixture.settle?.();
  assert.equal(fixture.value(), 5, "two steps up from 4 under a maximum of 5 must stop at 5");

  down.click();
  await fixture.settle?.();
  assert.equal(fixture.value(), 4, "a step down did not move the value");
  fixture.dispose?.();
});

test("the arrows on a counter chip change its quantity and leave the list shut", async () => {
  const fixture = await cfg.mount("multiselect", { value: ["a", "a", "b"], variant: "multi" });
  await fixture.settle?.();

  const chip = fixture.root.querySelector(".mdy-chip--value");
  assert.ok(chip, "the fixture drew no chip");
  chip.focus();
  press(chip, "ArrowUp");
  await fixture.settle?.();
  assert.deepEqual(fixture.value(), ["a", "a", "a", "b"], "ArrowUp on the chip did not raise its quantity");
  assert.equal(fixture.root.querySelector("[aria-expanded='true']"), null,
    "the chip's key reached the field and opened the list");

  press(fixture.root.querySelector(".mdy-chip--value"), "ArrowDown");
  await fixture.settle?.();
  assert.deepEqual(fixture.value(), ["a", "a", "b"],
    "up then down must return the value it started from, order included");
  fixture.dispose?.();
});

test("a chip that holds no quantity leaves the arrows to the field", async () => {
  // The step binding requires a countable field. Answered on a chip in the single mode, the press
  // dispatched a step on a value with no count and moved focus to the neighbouring chip; left to the
  // field, ArrowDown opens the list, as it does from anywhere else in the control.
  const fixture = await cfg.mount("multiselect", { value: ["a", "b"], variant: "single" });
  await fixture.settle?.();

  const chip = fixture.root.querySelector(".mdy-chip--value");
  assert.ok(chip, "the fixture drew no chip");
  chip.focus();
  press(chip, "ArrowDown");
  await fixture.settle?.();
  assert.deepEqual(fixture.value(), ["a", "b"], "ArrowDown on a chip that is not a counter changed the value");
  assert.ok(fixture.root.querySelector("[aria-expanded='true']"),
    "the chip kept a key it has no binding for, and the field never heard it");
  fixture.dispose?.();
});

test("a key pressed on a control inside the chip is that control's", async () => {
  const fixture = await cfg.mount("multiselect", { value: ["a", "a"], variant: "multi" });
  await fixture.settle?.();

  const remove = fixture.root.querySelector(".mdy-chip--value [class*='chip__remove']");
  assert.ok(remove, "the chip draws no remove control");
  press(remove, "ArrowUp");
  await fixture.settle?.();
  assert.deepEqual(fixture.value(), ["a", "a"], "a key on the chip's remove control was taken as the chip's");
  fixture.dispose?.();
});
