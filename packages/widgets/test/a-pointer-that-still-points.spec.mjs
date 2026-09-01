/**
 * Where the contract sends a reader, something is standing.
 *
 * `valueSlot` says where a kind's value is drawn and not what it is, and the two are easy to
 * confuse: both sound like "the value". Its documentation therefore names the catalogue that does
 * say — `MDY_VALUE_CONTRACTS`, in a different package — and a pointer across a package boundary is
 * the kind that rots quietly, because nothing in this package fails when the other one renames.
 *
 * So the pointer is asserted rather than trusted: the named catalogue exists, it is reachable from
 * the door the prose names, and it answers for every kind the widget contract has.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MDY_VOCABULARIES_ELSEWHERE, MDY_WIDGET_CONTRACTS } from "../dist/index.js";
import * as core from "@modyra/core";
const { MDY_VALUE_CONTRACTS } = core;

const source = readFileSync(
  fileURLToPath(new URL("../src/catalog/kinds.ts", import.meta.url)),
  "utf8",
);

test("the prose names a catalogue and a door", () => {
  assert.match(source, /MDY_VALUE_CONTRACTS/, "the pointer to what a kind holds is gone");
  assert.match(source, /@modyra\/core/, "the pointer does not say which package to look in");
});

test("what the prose points at is there, and answers for every kind", () => {
  assert.equal(typeof MDY_VALUE_CONTRACTS, "object", "the named catalogue is not on the named door");
  const unanswered = Object.keys(MDY_WIDGET_CONTRACTS).filter((kind) => !MDY_VALUE_CONTRACTS[kind]);
  assert.deepEqual(unanswered, [], "a kind the widget contract has, the value contract does not");
});

test("it answers the question the pointer was written for", () => {
  // The example in the prose: a renderer author asking what a checkbox holds.
  assert.equal(MDY_VALUE_CONTRACTS.checkbox.shape, "boolean");
  assert.equal(MDY_VALUE_CONTRACTS.text.shape, "string");
});

/**
 * Every catalogue this package says lives elsewhere is where it says.
 *
 * A name and a package written as text is the pointer that rots quietly: nothing here fails when the
 * other package renames or moves it, and the index goes on telling a reader to look somewhere there
 * is nothing. Checked by importing the named package and asking it for the named catalogue — which
 * is the only reading that can go wrong the way the prose can.
 */
test("what this package says lives elsewhere is there, under that name", async () => {
  assert.ok(MDY_VOCABULARIES_ELSEWHERE.length > 0, "nothing is named, so nothing below is checked");

  for (const entry of MDY_VOCABULARIES_ELSEWHERE) {
    assert.ok(entry.name.length > 0 && entry.package.length > 0, "an entry names no catalogue or no package");
    assert.ok(entry.describes.length > 0, `${entry.name} is named without saying what it is for`);

    const elsewhere = await import(entry.package);
    assert.ok(
      entry.name in elsewhere,
      `${entry.package} no longer publishes ${entry.name}, and this index still sends readers to it`,
    );
  }
});

test("the index does not restate what it points at", () => {
  // A derivation must not re-declare what it derives. Names travel; values would be a second home
  // free to drift from the first.
  for (const entry of MDY_VOCABULARIES_ELSEWHERE) {
    assert.equal(
      Object.keys(entry).sort().join(","),
      "describes,name,package",
      `${entry.name} carries more than a name — a copy of the catalogue would drift from its source`,
    );
  }
});
