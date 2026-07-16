import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarKeyboardTarget, listboxNextIndex } from "../dist/index.js";

test("listboxNextIndex follows the WAI-ARIA listbox pattern", () => {
  assert.equal(listboxNextIndex("ArrowDown", -1, 5), 0); // enter the list
  assert.equal(listboxNextIndex("ArrowDown", 4, 5), 4); // clamp at end
  assert.equal(listboxNextIndex("ArrowUp", -1, 5), 4); // enter from the end
  assert.equal(listboxNextIndex("ArrowUp", 0, 5), 0); // clamp at start
  assert.equal(listboxNextIndex("Home", 3, 5), 0);
  assert.equal(listboxNextIndex("End", 0, 5), 4);
  assert.equal(listboxNextIndex("Enter", 2, 5), null); // not a nav key
  assert.equal(listboxNextIndex("ArrowDown", 0, 0), null); // empty list
});

test("calendarKeyboardTarget moves focus per the grid pattern", () => {
  const d = { year: 2026, month: 1, day: 31 };
  assert.deepEqual(calendarKeyboardTarget("ArrowRight", d), { year: 2026, month: 2, day: 1 });
  assert.deepEqual(calendarKeyboardTarget("ArrowUp", d), { year: 2026, month: 1, day: 24 });
  // Month jump clamps Jan 31 → Feb 28 (2026 non-leap).
  assert.deepEqual(calendarKeyboardTarget("PageDown", d), { year: 2026, month: 2, day: 28 });
  // Shift upgrades to a year jump; Feb 29 → Feb 28 on non-leap years.
  assert.deepEqual(
    calendarKeyboardTarget("PageDown", { year: 2024, month: 2, day: 29 }, true),
    { year: 2025, month: 2, day: 28 },
  );
  assert.deepEqual(calendarKeyboardTarget("Home", d), { year: 2026, month: 1, day: 1 });
  assert.deepEqual(calendarKeyboardTarget("End", { year: 2026, month: 2, day: 10 }), { year: 2026, month: 2, day: 28 });
  assert.equal(calendarKeyboardTarget("Escape", d), null);
});
