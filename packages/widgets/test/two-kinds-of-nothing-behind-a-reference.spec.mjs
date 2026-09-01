/**
 * A reference naming nothing and a reference naming an empty something are two findings.
 *
 * `aria-describedby` pointing at an element **not in the document** is a defect in every case: the
 * reference cannot resolve and no rendering will make it. Pointing at one that **is** there and
 * holds nothing is not — ADR 0180 reserves the error container under every field that can fail a
 * rule, so a reference to an empty one is a conforming form at rest.
 *
 * In a failing assertion both read as "the description came back empty", which is why they are
 * separated by the collector rather than by whoever reads it: a sweep that folds them together sends
 * a reader to the container when the defect is in the reference, and the other way round.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readReferenceTargets } from "../dist/testing/index.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const document_ = dom.window.document;

/** A control describing itself by whichever ids a case needs, some of which may exist. */
function drawn(describedby, existing = {}) {
  document_.body.replaceChildren();
  const input = document_.createElement("input");
  if (describedby !== undefined) input.setAttribute("aria-describedby", describedby);
  document_.body.append(input);
  for (const [id, text] of Object.entries(existing)) {
    const element = document_.createElement("p");
    element.id = id;
    element.textContent = text;
    document_.body.append(element);
  }
  return input;
}

const resolve = (element) =>
  readReferenceTargets(element, "aria-describedby", "text.control", document_);

test("no attribute is not an empty reference — nothing was promised", () => {
  const one = resolve(drawn(undefined));
  assert.equal(one.read, false);
  assert.equal(one.reason, "absent-probe");
});

test("a reference naming an element that is not there is dangling", () => {
  const one = resolve(drawn("nowhere"));
  assert.equal(one.read, true);
  assert.deepEqual(one.value.dangling, ["nowhere"]);
  assert.deepEqual(one.value.emptyButPresent, []);
});

test("a reference naming an element that is there and empty is not dangling", () => {
  // The reserved error container at rest. Reporting this as a broken reference would fail every
  // conforming field that can fail a rule — which is most of them.
  const one = resolve(drawn("errors", { errors: "" }));
  assert.equal(one.value.dangling.length, 0, "a present container was called a broken reference");
  assert.deepEqual(one.value.emptyButPresent, ["errors"]);
});

test("the two are kept apart in one reference that has both", () => {
  const one = resolve(drawn("errors gone help", { errors: "", help: "Type your code" }));
  assert.deepEqual(one.value.dangling, ["gone"]);
  assert.deepEqual(one.value.emptyButPresent, ["errors"]);
  assert.equal(one.value.targets.find((each) => each.id === "help")?.text, "Type your code");
});

test("every id is accounted for, in the order the attribute wrote them", () => {
  const one = resolve(drawn("a b c", { a: "one", c: "three" }));
  assert.deepEqual(one.value.targets.map((each) => each.id), ["a", "b", "c"]);
  assert.deepEqual(one.value.targets.map((each) => each.present), [true, false, true]);
});

test("with no document the collector says it could not look, rather than inventing defects", () => {
  // Reporting every id as dangling here would be the collector turning its own missing context into
  // a finding about the page — the direction that confirms, which is the one to fear.
  const one = readReferenceTargets(drawn("errors"), "aria-describedby", "text.control", null);
  assert.equal(one.read, false);
  assert.notEqual((one.detail ?? "").trim(), "");
});
