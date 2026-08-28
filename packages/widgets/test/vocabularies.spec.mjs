/**
 * The index of catalogues, and the one property that makes it worth having.
 *
 * An index that is *almost* complete is worse than none: a tool built against it believes it has
 * seen the contract, and the vocabulary nobody added is the one it silently does not cover. That is
 * how an enumerator reported "eight undeclared conventions" that were declared all along.
 *
 * So the check is not that the index parses — it is that **nothing published is missing from it**,
 * derived from the package's own exports rather than from a second list kept beside this one.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import * as published from "../dist/index.js";
import * as vocabulary from "../dist/vocabulary.js";
import * as testingDoor from "../dist/testing/index.js";
import { MDY_CONTRACT_VOCABULARIES } from "../dist/index.js";
import { MDY_TESTING_VOCABULARIES } from "../dist/testing/index.js";

/**
 * What a vocabulary looks like from outside: a shouting name holding a collection.
 *
 * Derived, not listed. An earlier version of this check recognised six name endings — CLASSES,
 * CONTRACTS, KEYBOARD, OPENERS, STRUCTURE, RELATIONS — and so could only ever find what already
 * matched the vocabularies somebody had thought of. Twenty-five collections sat outside it, published
 * and unindexed, and the check was green throughout: a recogniser narrower than the thing it guards
 * reports the absence of what it cannot see.
 *
 * A scalar is excluded because it is not a collection — one gap, one delimiter, one version number.
 * Nothing else is: any `MDY_` export holding members is a collection a consumer can read, and the
 * index either covers it or does not.
 */
function isACollection(value) {
  if (value === null || typeof value !== "object") return false;
  return Object.keys(value).length > 0;
}

test("the index names every collection the package publishes", () => {
  const everywhere = { ...published, ...vocabulary };
  const found = Object.keys(everywhere)
    .filter((name) => name.startsWith("MDY_") && isACollection(everywhere[name])).sort();
  const indexed = MDY_CONTRACT_VOCABULARIES.map((one) => one.name).sort();

  assert.ok(found.length > 30, `only ${found.length} collections found — the derivation above has stopped reaching them`);
  assert.deepEqual(found.filter((name) => !indexed.includes(name)), [],
    "a published vocabulary is missing from the index. A tool reading the index believes it has seen "
    + "the whole contract, so the one nobody added is the one it silently does not cover");
  assert.deepEqual(indexed.filter((name) => !found.includes(name)), [],
    "the index names something the package does not publish");
});

test("each entry says what shape it is, and says it truly", () => {
  for (const { name, shape, value } of MDY_CONTRACT_VOCABULARIES) {
    assert.ok(value !== undefined && value !== null, `${name} is indexed and holds nothing`);
    if (shape === "list") {
      assert.ok(Array.isArray(value), `${name} is indexed as a list and is not one`);
      continue;
    }
    // `data` is the shape for a collection that is not a vocabulary — translations, colour presets,
    // icon paths. It claims nothing beyond "there is something here", which is the honest claim: a
    // consumer walking the index to enumerate the contract must be able to tell those apart from the
    // catalogues that *are* the contract, and no rule reading the data can make that distinction.
    if (shape === "data") continue;
    assert.ok(!Array.isArray(value), `${name} is indexed as ${shape} and is an array`);
    // The one distinction a tool cannot make for itself, which is why it is declared: a flat
    // dictionary is the degenerate case of a table with one column, so `names` and `table` look
    // alike from the data and differ in what a consumer may do with them.
    const values = Object.values(value);
    assert.ok(values.length > 0, `${name} is indexed and empty`);
    if (shape === "names") {
      assert.deepEqual(values.filter((one) => typeof one !== "string"), [],
        `${name} is indexed as names, so every value is the class name a role carries`);
    }
  }
});

test("a consumer reaches every kind through the index", () => {
  // The property a tool actually uses: take the entries keyed by kind and index straight in, without
  // knowing which export holds what.
  const byKind = MDY_CONTRACT_VOCABULARIES.filter((one) => one.shape === "keyed-by-kind");
  assert.ok(byKind.length >= 3, "fewer than three per-kind vocabularies — this asserts nothing");
  for (const { name, value } of byKind) {
    assert.ok(Object.keys(value).length > 0, `${name} is keyed by kind and holds no kind`);
    assert.ok(value.text !== undefined || value.select !== undefined,
      `${name} is indexed as keyed by kind and is keyed by something else`);
  }
});

/**
 * The third door, and the reason it has an index of its own rather than a line in the first.
 *
 * `./testing` publishes the tables the adapters' fixtures compare against — what a kind holds when it
 * is empty, what it looks like at rest, which beats a paint takes. A fourth adapter's author needs
 * them as much as the contract's own catalogues. They are not in the contract's index and must not
 * be: reaching them from the main barrel would put fixtures and comparison tables in the bundle of
 * somebody who only wanted to draw a field.
 *
 * Two indexes, no third list. The alternative — one index plus a ledger naming what it deliberately
 * omits — is the shape that goes stale in silence, and two such ledgers once hid five undeclared
 * classes between them.
 */
test("the testing door names every collection it publishes", () => {
  const found = Object.keys(testingDoor)
    .filter((name) => name.startsWith("MDY_") && isACollection(testingDoor[name]))
    .filter((name) => name !== "MDY_TESTING_VOCABULARIES")
    .sort();
  const indexed = MDY_TESTING_VOCABULARIES.map((one) => one.name).sort();

  assert.ok(found.length > 8, `only ${found.length} collections behind this door — the derivation has stopped reaching them`);
  assert.deepEqual(found.filter((name) => !indexed.includes(name)), [],
    "a collection this door publishes is in no index. It was published and unindexed for as long as "
    + "the contract's index claimed to cover the package, which it never did — it covers two doors of three");
  assert.deepEqual(indexed.filter((name) => !found.includes(name)), [],
    "the index names something this door does not publish");
});

test("the two indexes do not overlap, and between them nothing is unindexed", () => {
  const contract = new Set(MDY_CONTRACT_VOCABULARIES.map((one) => one.name));
  const testing = MDY_TESTING_VOCABULARIES.map((one) => one.name);
  assert.deepEqual(testing.filter((name) => contract.has(name)), [],
    "a collection is in both indexes, so a tool walking both counts it twice and a reader has to "
    + "check whether the two entries describe the same thing");

  // The property that makes two indexes as good as one: asked of every door together, nothing
  // published anywhere is missing from both. This is what a ledger of exemptions would have to
  // promise and could not.
  const everywhere = { ...published, ...vocabulary, ...testingDoor };
  const unindexed = Object.keys(everywhere)
    .filter((name) => name.startsWith("MDY_") && isACollection(everywhere[name]))
    .filter((name) => name !== "MDY_CONTRACT_VOCABULARIES" && name !== "MDY_TESTING_VOCABULARIES")
    .filter((name) => !contract.has(name) && !testing.includes(name));
  assert.deepEqual(unindexed, [],
    "published by some door and named by no index — a tool reading either one believes it has seen "
    + "the whole surface, so the collection nobody added is the one it silently does not cover");
});
