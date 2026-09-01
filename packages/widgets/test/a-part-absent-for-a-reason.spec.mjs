/**
 * "Missing" is three findings wearing one word.
 *
 * A part the contract requires and the renderer did not draw, a part excused by a condition that
 * does not hold right now, and a part nobody looked for are three different things with three
 * different repairs. A panel that prints "absent" for all of them sends its reader to the wrong one
 * twice out of three times.
 *
 * The excuse is read when it is asked, not baked in: the same part, in the same session, is excused
 * while the overlay is closed and owed the moment it opens — which is the property ADR 0188 names as
 * the one to check by opening the overlay rather than by reading the code.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MDY_WIDGET_CONTRACTS,
  partIsOwed,
} from "../dist/index.js";
import { readPartPresence } from "../dist/testing/index.js";

const nodeFor = (kind, part) =>
  MDY_WIDGET_CONTRACTS[kind].structure.nodes.find((node) => node.part === part);

/** A root that has exactly the selectors it is told it has. */
const rootWith = (...found) => ({
  querySelector: (selector) => (found.includes(selector) ? {} : null),
});

const ask = (root, kind, part, { open = false, declared = false } = {}) =>
  readPartPresence(
    root,
    { name: `${kind}.${part}`, selector: `.${part}`, node: nodeFor(kind, part) },
    {
      holds: (condition) =>
        condition === "overlayIsOpen" ? open : condition === "documentDeclaresIt" ? declared : false,
      offers: () => true,
      owes: partIsOwed,
    },
  );

test("a required part that is drawn reads as drawn", () => {
  const one = ask(rootWith(".control"), "text", "control");
  assert.equal(one.read, true);
  assert.equal(one.value.verdict, "drawn");
  assert.equal(one.value.owed, true);
});

test("a required part nobody drew is the one verdict that is a defect", () => {
  const one = ask(rootWith(), "text", "control");
  assert.equal(one.value.verdict, "missing");
  assert.equal(one.value.present, false);
  assert.equal(one.value.owed, true);
});

test("a part excused by its condition is excused, and says which condition", () => {
  const closed = ask(rootWith(), "datepicker", "popup", { open: false });
  assert.equal(closed.value.verdict, "excused");
  assert.equal(closed.value.owed, false);
  assert.equal(closed.value.presentWhen, "overlayIsOpen", "the excuse does not name its condition");
});

test("the same part is owed the moment its condition holds", () => {
  // The check ADR 0188 asks for: an absence excused while closed becomes a finding while open, in
  // the same run and without the caller re-declaring anything.
  const closed = ask(rootWith(), "datepicker", "popup", { open: false });
  const opened = ask(rootWith(), "datepicker", "popup", { open: true });
  assert.equal(closed.value.verdict, "excused");
  assert.equal(opened.value.verdict, "missing");
});

test("a part drawn where nothing required it is extra, not a defect", () => {
  // A renderer may draw an optional part whose condition does not hold. That is its prerogative,
  // and reporting it as a defect would make every richer renderer non-conforming.
  const one = ask(rootWith(".popup"), "datepicker", "popup", { open: false });
  assert.equal(one.value.present, true);
  assert.equal(one.value.owed, false);
  assert.equal(one.value.verdict, "extra");
});

test("a root that raises is accounted for rather than propagated", () => {
  const hostile = { querySelector: () => { throw new Error("bad selector"); } };
  const one = readPartPresence(
    hostile,
    { name: "text.control", selector: "::x", node: nodeFor("text", "control") },
    { holds: () => false, offers: () => true, owes: partIsOwed },
  );
  assert.equal(one.read, false);
  assert.equal(one.reason, "threw");
});
