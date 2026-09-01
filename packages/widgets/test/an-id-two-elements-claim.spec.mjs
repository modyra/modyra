/**
 * A duplicate id does not fail loudly, so something has to look for it.
 *
 * `getElementById` returns the first. `label[for]` names the first. Every reference resolves to
 * whichever element the document happens to hold first — so two instances of one widget produce a
 * form where clicking the second field's label focuses the first, and nothing reports an error.
 *
 * Measured against real widgets as well as a stand-in, because the defect this looks for is one two
 * renderers actually produced: it is the same question the conformance kit's isolation section asks,
 * asked here of a page rather than of two mounted instances.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readIdClaims } from "../dist/testing/index.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const document_ = dom.window.document;

/** A root holding elements with exactly the ids given, repeats included. */
function withIds(...ids) {
  const root = document_.createElement("div");
  for (const id of ids) {
    const element = document_.createElement("span");
    element.id = id;
    root.append(element);
  }
  return root;
}

test("a page with no ids at all is a reading, not an absence", () => {
  // It was looked at and had none. An `absent-probe` here would say nobody looked, which is a
  // different and wrong statement about a page that is simply clean.
  const one = readIdClaims(withIds(), "page");
  assert.equal(one.read, true);
  assert.deepEqual(one.value, []);
});

test("ids that are each claimed once are not reported", () => {
  const one = readIdClaims(withIds("a", "b", "c"), "page");
  assert.deepEqual(one.value, []);
});

test("an id two elements claim is reported with the count", () => {
  const one = readIdClaims(withIds("a", "shared", "b", "shared"), "page");
  assert.deepEqual(one.value, [{ id: "shared", claimants: 2 }]);
});

test("the count separates a mistake from a mechanism", () => {
  // Two elements claiming an id is a collision. Five is a loop that has been minting the same id
  // since it was written, and the repair is in a different place.
  const one = readIdClaims(withIds("x", "x", "x", "x", "x"), "page");
  assert.deepEqual(one.value, [{ id: "x", claimants: 5 }]);
});

test("several collisions are all reported, not just the first", () => {
  const one = readIdClaims(withIds("a", "a", "b", "c", "c", "c"), "page");
  assert.deepEqual(
    [...one.value].sort((left, right) => left.id.localeCompare(right.id)),
    [{ id: "a", claimants: 2 }, { id: "c", claimants: 3 }],
  );
});

test("a root that raises is accounted for rather than propagated", () => {
  const hostile = { querySelectorAll: () => { throw new Error("bad selector"); } };
  const one = readIdClaims(hostile, "page");
  assert.equal(one.read, false);
  assert.equal(one.reason, "threw");
});
