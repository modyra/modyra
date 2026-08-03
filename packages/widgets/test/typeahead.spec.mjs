/**
 * Typeahead accumulates, and forgets on purpose.
 *
 * The defect this exists to prevent is subtle in code and obvious in use: a rule that *replaces* the
 * query on each keystroke passes every single-character test anyone would think to write, and can
 * never match a word. So the first assertion here types three characters.
 *
 * The clock is injected, so the idle timeout is asserted rather than waited for. A test that sleeps a
 * real second to prove a one-second timeout is a test nobody runs.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MDY_TYPEAHEAD_IDLE_MS,
  createTypeahead,
  isTypeaheadCharacter,
  typeaheadMatch,
} from "../dist/index.js";

/** A clock the test drives. */
function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test("characters accumulate — the whole point", () => {
  const ta = createTypeahead({ now: clock().now });
  assert.equal(ta.push("m"), "m");
  assert.equal(ta.push("a"), "ma");
  assert.equal(ta.push("r"), "mar", "a replacing rule would say 'r' here");
});

test("the buffer clears after the idle interval", () => {
  const c = clock();
  const ta = createTypeahead({ now: c.now });
  ta.push("m");
  ta.push("a");
  assert.equal(ta.query(), "ma");

  c.advance(MDY_TYPEAHEAD_IDLE_MS);
  assert.equal(ta.push("c"), "c", "a new word, not 'mac'");
});

test("a keystroke inside the interval keeps accumulating", () => {
  const c = clock();
  const ta = createTypeahead({ now: c.now });
  ta.push("m");
  c.advance(MDY_TYPEAHEAD_IDLE_MS - 1);
  assert.equal(ta.push("a"), "ma");
});

test("the interval is measured from the last keystroke, not the first", () => {
  // Typing steadily for longer than the interval must not reset mid-word.
  const c = clock();
  const ta = createTypeahead({ now: c.now });
  ta.push("a");
  for (const ch of ["b", "c", "d"]) {
    c.advance(MDY_TYPEAHEAD_IDLE_MS - 1);
    ta.push(ch);
  }
  assert.equal(ta.query(), "abcd");
});

test("clear ends the intent", () => {
  // Escape, a selection, the list closing, focus leaving.
  const ta = createTypeahead({ now: clock().now });
  ta.push("m");
  ta.push("a");
  ta.clear();
  assert.equal(ta.query(), "");
  assert.equal(ta.push("c"), "c");
});

test("what counts as a typed character", () => {
  assert.equal(isTypeaheadCharacter("a"), true);
  assert.equal(isTypeaheadCharacter(" "), true, "the caller decides whether space selects");
  assert.equal(isTypeaheadCharacter("Enter"), false);
  assert.equal(isTypeaheadCharacter("ArrowDown"), false);
  assert.equal(isTypeaheadCharacter("a", { ctrlKey: true }), false, "Ctrl+A is not the letter a");
  assert.equal(isTypeaheadCharacter("a", { metaKey: true }), false);
  assert.equal(isTypeaheadCharacter("a", { altKey: true }), false);
});

test("a query matches by prefix, in declaration order", () => {
  // Canada comes *first* deliberately: it contains "an" but does not start with it, so a substring
  // rule returns Canada here and a prefix rule returns Andorra. With Andorra first, both rules agree
  // and the case proves nothing — which is exactly what an earlier version of this test did.
  const options = [
    { label: "Canada" }, { label: "Andorra" }, { label: "Australia" }, { label: "Austria" },
  ];
  assert.deepEqual(typeaheadMatch(options, "an"), { label: "Andorra" }, "prefix, not substring");
  assert.deepEqual(typeaheadMatch(options, "aus"), { label: "Australia" }, "first in declaration order");
  assert.deepEqual(typeaheadMatch(options, "austr"), { label: "Australia" });
  assert.deepEqual(typeaheadMatch(options, "austri"), { label: "Austria" });
});

test("matching ignores case, and an empty query matches nothing", () => {
  const options = [{ label: "Belgium" }];
  assert.deepEqual(typeaheadMatch(options, "BEL"), { label: "Belgium" });
  assert.equal(typeaheadMatch(options, ""), null, "an empty buffer must not select the first option");
  assert.equal(typeaheadMatch(options, "z"), null);
});
