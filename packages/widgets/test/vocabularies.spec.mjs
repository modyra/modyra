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
import { MDY_CONTRACT_VOCABULARIES } from "../dist/index.js";

/**
 * What a vocabulary looks like from outside: a frozen object or array of contract data, exported
 * under a shouting name. Recognised by the name because that is the convention the package keeps —
 * and the alternative, recognising it by shape, is the guess this index exists to remove.
 */
const LOOKS_LIKE_A_VOCABULARY = /^MDY_[A-Z0-9_]*(CLASSES|CONTRACTS|KEYBOARD|OPENERS|STRUCTURE|RELATIONS)$/;

test("the index names every vocabulary the package publishes", () => {
  const everywhere = { ...published, ...vocabulary };
  const found = Object.keys(everywhere).filter((name) => LOOKS_LIKE_A_VOCABULARY.test(name)).sort();
  const indexed = MDY_CONTRACT_VOCABULARIES.map((one) => one.name).sort();

  assert.ok(found.length > 5, `only ${found.length} vocabularies found — the pattern above has stopped matching`);
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
