/**
 * `mdyFormSerialize` — what a form value looks like once JSON has to carry it.
 *
 * The function exists because a `File` stringifies to `{}`. The tests below hold the other half of
 * that goal: it must never *lose* what plain `JSON.stringify` would have kept.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mdyFormSerialize } from "../dist/serialize.js";

test("a value that defines toJSON keeps the answer it already gives", () => {
  // Rebuilding such an object property by property is worse than doing nothing: a Date comes out
  // `{}` — the very shape this function was written to prevent.
  const value = { when: new Date("2024-03-01T10:00:00Z") };
  assert.equal(JSON.stringify(mdyFormSerialize(value)), JSON.stringify(value));

  class Money {
    constructor(cents) {
      this.cents = cents;
    }
    toJSON() {
      return this.cents / 100;
    }
  }
  assert.deepEqual(mdyFormSerialize({ price: new Money(1250) }), { price: 12.5 });
});

test("a File is described, and describing it comes before asking for toJSON", () => {
  const file = new File(["abc"], "resume.pdf");
  assert.equal(mdyFormSerialize(file), "[File: resume.pdf (3 bytes)]");
  assert.deepEqual(mdyFormSerialize({ files: [file] }), { files: ["[File: resume.pdf (3 bytes)]"] });

  // A polyfill adding `toJSON` to File must not change how a file reads in a payload.
  const polyfilled = new File(["abc"], "resume.pdf");
  polyfilled.toJSON = () => ({ nope: true });
  assert.equal(mdyFormSerialize(polyfilled), "[File: resume.pdf (3 bytes)]");
});

test("a cycle is described rather than walked, and repetition is not a cycle", () => {
  const looping = { a: 1 };
  looping.self = looping;
  assert.deepEqual(mdyFormSerialize(looping), { a: 1, self: "[Circular]" });

  const rows = [{ n: 1 }];
  rows.push(rows);
  assert.deepEqual(mdyFormSerialize(rows), [{ n: 1 }, "[Circular]"]);

  // The same object twice as a sibling is repetition: calling the second one circular would be a lie.
  const shared = { s: 1 };
  assert.deepEqual(mdyFormSerialize({ a: shared, b: shared }), { a: { s: 1 }, b: { s: 1 } });
});

test("ordinary values pass through unchanged", () => {
  const value = { s: "x", n: 0, b: false, nil: null, list: [1, "2", null], deep: { a: { b: "c" } } };
  assert.deepEqual(mdyFormSerialize(value), value);
  assert.equal(mdyFormSerialize(undefined), undefined);
});
