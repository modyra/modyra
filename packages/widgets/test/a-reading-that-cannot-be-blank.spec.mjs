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
  MDY_EMPTY,
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

  // Every ending, including the ones that were read. A loop that skipped those would be asserting
  // the claim only where it cannot fail, which is how an empty read value stayed blank.
  for (const one of endings) {
    const text = readingText(one);
    const what = one.read ? `a read ${JSON.stringify(one.value)}` : `an unread ${one.reason}`;
    assert.notEqual(text.trim(), "", `${what} rendered as a blank`);
    if (one.read) continue;
    assert.match(text, new RegExp(MDY_NOT_READ.replace(/[()]/g, "\\$&")));
    assert.match(text, new RegExp(one.reason), "the reason a reader must act on is not shown");
  }
});

test("a value that was read and renders as nothing says so, and does not say it was not read", () => {
  // The two states a blank cell would fold together: an `id=""` that was found and read, and an
  // element that was never reached. Both occupy no width; only one of them is a defect to chase.
  const wasEmpty = readingText(reading(WHERE, () => ""));
  const wasNotRead = readingText(unread("absent-probe", "text.control"));

  assert.equal(wasEmpty, MDY_EMPTY);
  assert.notEqual(wasEmpty, wasNotRead);
  assert.doesNotMatch(wasEmpty, /not read/, "a value that was read is reported as unread");
  assert.doesNotMatch(wasNotRead, new RegExp(MDY_EMPTY.replace(/[()]/g, "\\$&")));
});

test("the word for an empty value is not spent on a value that renders as itself", () => {
  // `show` decides what nothing looks like: a formatter that returns text for the empty string
  // has no empty rendering, and must not be overruled into one.
  const shown = readingText(reading(WHERE, () => ""), (value) => `<${value.length} chars>`);
  assert.equal(shown, "<0 chars>");
  assert.notEqual(shown, MDY_EMPTY);
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
