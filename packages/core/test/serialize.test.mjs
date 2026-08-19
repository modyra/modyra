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

test("a BigInt is described, and describing it keeps it distinguishable from a number", () => {
  // `JSON.stringify` raises on a BigInt rather than writing something, so a value a form is holding
  // takes down whatever reads it — the same failure a File causes by being silent, in the loud
  // direction. `10n` and `10` are not the same value, so it is described rather than coerced.
  assert.equal(mdyFormSerialize(10n), "[BigInt: 10]");
  assert.equal(mdyFormSerialize(-3n), "[BigInt: -3]");
  assert.equal(mdyFormSerialize(9007199254740993n), "[BigInt: 9007199254740993]");
  assert.notEqual(mdyFormSerialize(10n), mdyFormSerialize(10));

  assert.deepEqual(mdyFormSerialize({ total: 10n, rows: [1n, { id: 2n }] }), {
    total: "[BigInt: 10]",
    rows: ["[BigInt: 1]", { id: "[BigInt: 2]" }],
  });

  // The property that matters to a caller: what comes back is something JSON can carry.
  assert.equal(JSON.stringify(mdyFormSerialize({ total: 10n })), '{"total":"[BigInt: 10]"}');
});

test("a value it cannot read is described, like the ones it cannot carry", () => {
  // The panel is what a developer opens when something is already wrong, and the values that break a
  // walk are exactly the ones a broken app holds: an accessor that raises, a `toJSON` that fails, a
  // Proxy that refuses to be enumerated. Two of the five shapes were already described, which made
  // the rest an inconsistency rather than a limit.
  const withBadAccessor = { ok: 1, get secret() { throw new Error("nope"); } };
  assert.deepEqual(mdyFormSerialize(withBadAccessor), { ok: 1, secret: "[Unreadable: secret]" });

  // One member, not the object: reading keys rather than entries is what keeps the rest.
  const nested = { row: { y: 2, get x() { throw new RangeError("no"); } } };
  assert.deepEqual(mdyFormSerialize(nested), { row: { y: 2, x: "[Unreadable: x]" } });

  assert.equal(mdyFormSerialize({ toJSON() { throw new TypeError("bad"); } }), "[Unreadable: toJSON threw TypeError]");
  assert.equal(mdyFormSerialize({ get toJSON() { throw new Error("getter"); } }), "[Unreadable: toJSON]");
  assert.equal(mdyFormSerialize(new Proxy({}, { ownKeys() { throw new Error("no keys"); } })), "[Unreadable: Error]");

  // The control: nothing about an ordinary value changes.
  assert.deepEqual(mdyFormSerialize({ a: 1, b: [2, 3] }), { a: 1, b: [2, 3] });
});
