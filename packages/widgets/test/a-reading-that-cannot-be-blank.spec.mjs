/**
 * A probe that answers nothing produces a reason, never a blank.
 *
 * ADR 0188 names this as the check that decides whether the reading layer is worth building: if a
 * collector returning `undefined` can still reach a reader as an empty cell, the panel has the same
 * blind spot as what it replaces, with a nicer surface.
 *
 * So the four ways a reading ends are exercised through the wrapper rather than described, and the
 * text a reader sees is asserted to be non-empty in every one of them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MDY_NOT_READ,
  reading,
  readingOf,
  readingText,
  readPartAttribute,
  unread,
} from "../dist/testing/index.js";

const WHERE = { source: ".mdy-input-wrapper input", at: "text.control", method: "getAttribute" };

test("a collector that answers is a reading with its provenance", () => {
  const one = reading(WHERE, () => "hello");
  assert.equal(one.read, true);
  assert.equal(one.value, "hello");
  // Where it came from and how, so a reader can go and look at the same thing.
  assert.equal(one.source, WHERE.source);
  assert.equal(one.at, WHERE.at);
  assert.equal(one.method, WHERE.method);
});

test("a collector that answers nothing is absent-probe, not an empty value", () => {
  const one = reading(WHERE, () => undefined);
  assert.equal(one.read, false);
  assert.equal(one.reason, "absent-probe");
  assert.match(one.detail ?? "", /answered nothing/);
});

test("a collector that raises is threw, carrying what it said", () => {
  const one = reading(WHERE, () => { throw new Error("no such element"); });
  assert.equal(one.read, false);
  assert.equal(one.reason, "threw");
  assert.match(one.detail ?? "", /no such element/);
});

test("a value that is legitimately empty is still a reading", () => {
  // The distinction the whole file exists for: an empty string was read, and reads as itself.
  const one = reading(WHERE, () => "");
  assert.equal(one.read, true);
  assert.equal(one.value, "");
});

test("nothing a reader is shown is blank, whichever way the reading ended", () => {
  const endings = [
    reading(WHERE, () => "a value"),
    reading(WHERE, () => ""),
    reading(WHERE, () => undefined),
    reading(WHERE, () => { throw new Error("boom"); }),
    unread("unsupported", "text.control"),
    unread("not-attempted", "text.control"),
    readingOf(false, WHERE),
  ];

  for (const one of endings) {
    const text = readingText(one);
    if (one.read) continue;
    assert.notEqual(text.trim(), "", `an unread ${one.reason} rendered as a blank`);
    assert.match(text, new RegExp(MDY_NOT_READ.replace(/[()]/g, "\\$&")));
    assert.match(text, new RegExp(one.reason), "the reason a reader must act on is not shown");
  }
});

test("a read falsey value is not mistaken for an absence", () => {
  // `false`, `0` and `""` are values. A layer that tested truthiness would report all three as
  // unread, which is the same defect in the other direction.
  for (const value of [false, 0, ""]) {
    const one = reading(WHERE, () => value);
    assert.equal(one.read, true, `${JSON.stringify(value)} was treated as nothing`);
    assert.equal(one.value, value);
    assert.doesNotMatch(readingText(one), /not read/);
  }
});

/**
 * The first collector, and the three endings a real DOM produces.
 *
 * Written against a stand-in rather than a rendered widget on purpose: what is being checked is the
 * accounting, and a real renderer would answer only one of the three on any given run.
 */
test("a part with no element could not be looked at, and says so", () => {
  const empty = { querySelector: () => null };
  const one = readPartAttribute(empty, { name: "text.control", selector: "input" }, "id");
  assert.equal(one.read, false);
  assert.equal(one.reason, "absent-probe");
  assert.equal(one.at, "text.control");
});

test("an element without the attribute answers null, which is a reading", () => {
  // The distinction that costs the most: the element was there and was asked. "No attribute" is
  // what the platform said, not a failure to look.
  const bare = { querySelector: () => ({ getAttribute: () => null }) };
  const one = readPartAttribute(bare, { name: "text.control", selector: "input" }, "aria-label");
  assert.equal(one.read, true);
  assert.equal(one.value, null);
  assert.doesNotMatch(readingText(one), /not read/);
});

test("an element with the attribute carries it, and how it was obtained", () => {
  const held = { querySelector: () => ({ getAttribute: () => "field-1" }) };
  const one = readPartAttribute(held, { name: "text.control", selector: "input" }, "id");
  assert.equal(one.read, true);
  assert.equal(one.value, "field-1");
  assert.equal(one.method, "getAttribute(id)");
  assert.equal(one.source, "input");
});

test("a root that raises is accounted for, not propagated", () => {
  const hostile = { querySelector: () => { throw new Error("bad selector"); } };
  const one = readPartAttribute(hostile, { name: "text.control", selector: "input::x" }, "id");
  assert.equal(one.read, false);
  assert.equal(one.reason, "threw");
  assert.match(one.detail ?? "", /bad selector/);
});
