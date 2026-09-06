/**
 * Every renderer's chip carries the position the contract computes, from the contract's own door.
 *
 * A chip is a `gridcell` in a row, and a gridcell does not carry `aria-posinset`/`aria-setsize` —
 * they were written once and the accessibility layer discarded them, which is why the position is a
 * column index (ADR 0148). The reason lives there; this asserts the answer arrives.
 *
 * Both holdings, because only the pair can fail: with one chip held, an index that is always `1` and
 * one that counts are the same number.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { multiselectChipPart } from "../dist/field/index.js";

/** @type {(position: number, size: number) => import("../dist/field/index.js").MdyMultiselectChipAppearance} */
const appearance = (position, size) => ({
  label: "Roma", count: 1, position, size, active: position === 1, named: false,
});

test("the column index counts the chips, and one chip is not a special case", () => {
  assert.equal(multiselectChipPart("w", "k", appearance(1, 1)).attributes["aria-colindex"], 1);
  for (const position of [1, 2, 3]) {
    assert.equal(multiselectChipPart("w", "k", appearance(position, 3)).attributes["aria-colindex"], position,
      `a chip at ${position} of 3 was given a different column`);
  }
});

test("a gridcell is not given the attributes its role discards", () => {
  // The defect this replaced: written on a `gridcell`, `aria-posinset` and `aria-setsize` reach no
  // reader at all, so the position they carried was never announced by anything.
  const attributes = multiselectChipPart("w", "k", appearance(2, 3)).attributes;
  assert.equal(attributes["aria-posinset"], undefined, "a gridcell was given aria-posinset, which is dropped");
  assert.equal(attributes["aria-setsize"], undefined, "a gridcell was given aria-setsize, which is dropped");
});

test("the name says how many of this one there are, and only when there is more than one", () => {
  // The other rule the four renderers each wrote out: a chip held once is named by its label alone.
  assert.equal(multiselectChipPart("w", "k", { ...appearance(1, 2), count: 1 }).attributes["aria-label"], "Roma");
  assert.equal(multiselectChipPart("w", "k", { ...appearance(1, 2), count: 3 }).attributes["aria-label"], "Roma, 3");
});

test("one chip is the strip's tab stop and the rest are reachable through it", () => {
  assert.equal(multiselectChipPart("w", "k", appearance(1, 3)).attributes["tabindex"], 0);
  assert.equal(multiselectChipPart("w", "k", appearance(2, 3)).attributes["tabindex"], -1);
});
