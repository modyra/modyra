/**
 * How each kind's value leaves the page, against the contract rather than against a renderer.
 *
 * A renderer test proves the wiring and would pass just as happily on a table that was wrong in the
 * same way everywhere. These assert the table itself: that every kind declares a shape, that the
 * parts it names exist, and that the keys it produces are the ones a receiving end would have to
 * parse — one per value, distinguishable, and free of the per-form scope the ids carry.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MDY_WIDGET_CONTRACTS,
  MDY_WIDGET_KINDS,
  submissionDefects,
  submissionFor,
  submissionNames,
} from "../dist/index.js";

/** @typedef {import("../dist/index.js").MdySubmissionShape} MdySubmissionShape */

test("every kind declares how its value is submitted", () => {
  assert.deepEqual(submissionDefects(), [], "a kind with no shape renders controls a native submit drops in silence");
  for (const kind of MDY_WIDGET_KINDS) {
    /** @type {MdySubmissionShape} */
    const shape = submissionFor(kind);
    assert.ok(shape !== undefined, `${kind} declares nothing`);
  }
});

test("a part a kind submits from is a part that kind has", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    const shape = submissionFor(kind);
    const named = shape.form === "split" ? shape.parts.map((p) => p.part)
      : shape.form === "boolean" ? [shape.part, shape.companion]
      : shape.form === "hidden" ? [] : [shape.part];
    for (const part of named) {
      assert.ok(Object.hasOwn(MDY_WIDGET_CONTRACTS[kind].parts, part), `${kind} submits from ${part}, which it does not have`);
    }
  }
});

test("the key is the field's path, with no scope in it", () => {
  // The ids carry a per-form scope so two forms on one page do not collide. A payload must not:
  // a receiving end asked for `email`, and `f3a9-email` is a key nobody declared.
  assert.deepEqual(submissionNames("text", "email"), { control: "email" });
  assert.deepEqual(submissionNames("text", "shipping.city"), { control: "shipping.city" });
});

test("the two ends of a range are told apart", () => {
  // One key twice would leave a receiver unable to say which date is which, and `body.get(k)` — what
  // almost everything reaches for — would take one end and drop the other without an error.
  assert.deepEqual(submissionNames("daterange", "quando"), {
    startControl: "quando.start",
    endControl: "quando.end",
  });
});

test("a boolean sends its companion under the same key as the box", () => {
  const names = submissionNames("checkbox", "ok");
  assert.equal(names.control, "ok");
  assert.equal(names.submitFalse, "ok", "the false half must share the key, or it answers a different question");
});

test("the kinds with no form control name no part", () => {
  for (const kind of ["select", "multiselect"]) {
    assert.equal(submissionFor(kind).form, "hidden");
    assert.deepEqual(submissionNames(kind, "scelta"), {}, "nothing to bind: the inputs are built, not projected");
  }
  assert.equal(submissionFor("multiselect").repeats, true, "one input per value, or order and multiplicity are lost");
  assert.equal(submissionFor("select").repeats, false);
});

test("the kinds HTML groups by name share one part between their options", () => {
  for (const kind of ["radio", "segmented"]) {
    const shape = submissionFor(kind);
    assert.equal(shape.form, "shared");
    assert.equal(shape.part, "optionControl");
    assert.deepEqual(submissionNames(kind, "colore"), { optionControl: "colore" });
  }
});
