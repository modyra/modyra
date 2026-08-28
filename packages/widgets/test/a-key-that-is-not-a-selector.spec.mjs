/**
 * A key is data. Inside a selector it becomes syntax.
 *
 * The keys a widget uses to tell one chosen value from another are derived from the values, and a
 * value is whatever the document handed the form. `defaultOptionKey` gives an object a structural
 * key — `{"id":1,"name":"Red"}` — which is correct as a key and is not a legal attribute selector:
 * the first quote closes the selector, and the browser raises `SyntaxError` rather than returning
 * nothing. A gesture built on one does not misbehave, it throws, and it takes its handler with it.
 *
 * So this asserts the two halves together: that the keys the contract produces really are the shape
 * that breaks a selector, and that the door offered instead finds them all. Asserting only the
 * second would pass just as well against a door nobody needed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { defaultOptionKey, elementByDataKey } from "../dist/index.js";

/** Values a form holds, and the key each one gets. */
const HELD = [
  { value: { id: 1, name: "Red" }, why: "an object, which is what an options list usually holds" },
  { value: { id: 2, name: 'the "good" one' }, why: "an object whose own text carries a quote" },
  { value: new Date(0), why: "a date" },
  { value: "a b", why: "a value with a space" },
  { value: 'say "hi"', why: "a string carrying a quote" },
  { value: "plain", why: "a value with nothing special about it" },
];

function stripHolding(keys) {
  const { window } = new JSDOM("<!doctype html><div id=strip></div>");
  const strip = window.document.getElementById("strip");
  for (const key of keys) {
    const chip = window.document.createElement("span");
    chip.dataset.key = key;
    strip.append(chip);
  }
  return strip;
}

test("the keys the contract produces are not all legal inside a selector", () => {
  const keys = HELD.map((held) => defaultOptionKey(held.value));
  const strip = stripHolding(keys);
  const raises = keys.filter((key) => {
    try {
      strip.querySelector(`[data-key="${key}"]`);
      return false;
    } catch {
      return true;
    }
  });
  assert.ok(raises.length > 0,
    "no key here breaks a selector, so the door below is being asserted against nothing. Either the "
    + "key derivation changed shape or this list stopped covering the values a form actually holds");
});

test("every held value's chip is found by its key", () => {
  const keys = HELD.map((held) => defaultOptionKey(held.value));
  const strip = stripHolding(keys);
  for (const [at, held] of HELD.entries()) {
    const found = elementByDataKey(strip, "key", keys[at]);
    assert.ok(found !== null, `${held.why}: its chip is on the strip and its key does not find it`);
    assert.equal(found, strip.children[at], `${held.why}: found the wrong chip`);
  }
});

test("a key nothing carries finds nothing rather than raising", () => {
  const strip = stripHolding(["plain"]);
  // The absent case is the one a caller relies on: a chip removed between the gesture and the beat
  // that looks for it is ordinary, and it must answer `null`, not throw.
  assert.equal(elementByDataKey(strip, "key", 'gone "away"'), null);
  assert.equal(elementByDataKey(strip, "option-key", "plain"), null,
    "asked for a different attribute, so the chip carrying `data-key` is not the answer");
});
