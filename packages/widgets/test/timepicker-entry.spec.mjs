/**
 * What a box holds while somebody is typing, and when the hand follows.
 *
 * Driven as the reported sequence rather than as cases: *"in plain quando cancello sui minuti 00
 * resta 00 e non riesco a mettere 01."* Three renderers each answered this on their own and all
 * three were wrong in different directions.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { timepickerEntry, timepickerEntryText } from "../dist/index.js";

/** Types a sequence into a box, reporting the text and what the draft would hold after each key. */
function types(field, format, start, keys, steps) {
  let text = start;
  let held = timepickerEntry(field, format, start, steps)?.value ?? 0;
  const trail = [];
  for (const key of keys) {
    const next = key === "Backspace" ? text.slice(0, -1) : text + key;
    const entry = timepickerEntry(field, format, next, steps);
    // A refused character leaves everything as it was — the box does not take it either.
    if (entry) {
      text = entry.text;
      if (entry.value !== null) held = entry.value;
    }
    trail.push(`${text || "∅"}:${held}`);
  }
  return trail;
}

test("clearing a minute box and typing it back reaches the value", () => {
  // The reported case, keystroke by keystroke. Plain padded after every key, so `0` became `00` with
  // the caret after it and the `1` landed third: `001` in a two-digit field, and `01` unreachable.
  assert.deepEqual(
    types("minute", "24h", "00", ["Backspace", "Backspace", "0", "1"]),
    ["0:0", "∅:0", "0:0", "01:1"],
  );
});

test("no state a box passes through is wider than the field", () => {
  // The property rather than the sequence: any editing model may satisfy it, and the one that
  // produced `001` cannot.
  for (const field of ["hour", "minute"]) {
    for (const format of ["12h", "24h"]) {
      for (const start of ["00", "09", "12"]) {
        for (const trail of [types(field, format, start, ["1", "2", "3"]), types(field, format, start, ["Backspace", "9", "9", "9"])]) {
          for (const step of trail) {
            const [text] = step.split(":");
            assert.ok(text === "∅" || text.length <= 2, `${field}/${format} from ${start}: ${trail.join(" ")}`);
          }
        }
      }
    }
  }
});

test("the hand follows a partial the field accepts, and stays for one it refuses", () => {
  // The half that makes this a hybrid. On a 24-hour face, `2` is an hour and `29` is not — so the
  // second keystroke leaves the draft where the first one put it.
  assert.deepEqual(types("hour", "24h", "09", ["Backspace", "Backspace", "2", "9"]), ["0:0", "∅:0", "2:2", "29:2"]);
  // And where both are hours, it follows both.
  assert.deepEqual(types("hour", "24h", "09", ["Backspace", "Backspace", "1", "4"]), ["0:0", "∅:0", "1:1", "14:14"]);
});

test("an empty box names nothing, and is a state a box may be in", () => {
  // How a person replaces a value rather than editing it. The draft keeps what it had, so the hand
  // does not swing to midnight while somebody is halfway through typing.
  assert.deepEqual(timepickerEntry("minute", "24h", ""), { text: "", value: null });
  assert.deepEqual(timepickerEntry("minute", "24h", "07"), { text: "07", value: 7 });
});

test("a character that can never become a number is refused outright", () => {
  // Not a partial: no amount of further typing rescues it, so keeping it would mean carrying text
  // the box can never resolve.
  for (const text of ["a", "1a", "-1", "1.5", "123"]) {
    assert.equal(timepickerEntry("minute", "24h", text), null, JSON.stringify(text));
  }
  // Whitespace is the exception and it is not one: a box holding a space is an empty box, which is
  // a state a box may be in. Refusing it would leave the space showing.
  assert.deepEqual(timepickerEntry("minute", "24h", "  "), { text: "", value: null });
});

test("a granularity refuses a partial the field does not offer", () => {
  // `07` is a minute and not one this field has, so the draft keeps its own and the hand stays.
  const quarters = { hourStep: 1, minuteStep: 15 };
  assert.deepEqual(timepickerEntry("minute", "24h", "07", quarters), { text: "07", value: null });
  assert.deepEqual(timepickerEntry("minute", "24h", "15", quarters), { text: "15", value: 15 });
});

test("what a box settles to when it stops being edited", () => {
  assert.equal(timepickerEntryText(0), "00");
  assert.equal(timepickerEntryText(9), "09");
  assert.equal(timepickerEntryText(23), "23");
});
