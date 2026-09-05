import { test } from "node:test";
import assert from "node:assert/strict";
import { dateEntryText } from "../dist/index.js";

/**
 * What a date box shows, in the order the two answers rank.
 *
 * `entryText` is not the control's text: it holds only what somebody typed that could **not** be read
 * as a date, and every path producing a value clears it. Three renderers composed
 * `entryText ?? formatted(value)` for themselves and a fourth wrote only the first half, so its box
 * was blank for every readable value — a field submitting a date while showing nothing.
 */

test("what could not be read outranks what is held", () => {
  // Those keystrokes are still the person's to correct: replacing them with the old value would
  // discard what they typed and leave them nothing to fix.
  assert.equal(dateEntryText("not a date", "April 3, 2026"), "not a date");
});

test("with nothing outstanding, the held value speaks", () => {
  assert.equal(dateEntryText(null, "April 3, 2026"), "April 3, 2026");
});

test("a field holding nothing shows nothing", () => {
  // Empty string rather than null: this answer is bound straight to a control's value, and `null`
  // there is the string "null" in some frameworks and a cleared box in others.
  assert.equal(dateEntryText(null, null), "");
  assert.equal(dateEntryText(undefined, undefined), "");
});

test("an outstanding empty string is not an answer", () => {
  // The empty string means the person cleared the box, which is a readable state and not an
  // unreadable one — but it is still *theirs*, so it wins over the held value the same way.
  assert.equal(dateEntryText("", "April 3, 2026"), "");
});
