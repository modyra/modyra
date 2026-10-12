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
  applySubmissionNames,
  MDY_WIDGET_CONTRACTS,
  MDY_WIDGET_KINDS,
  submissionDefects,
  submissionFor,
  submissionEntries,
  submissionNames,
  syncSubmission,
  syncSubmitValues,
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

test("the two ends of a range are told apart, and sent as the range holds them", () => {
  // One key twice would leave a receiver unable to say which date is which, and `body.get(k)` — what
  // almost everything reaches for — would take one end and drop the other without an error.
  assert.deepEqual(submissionNames("daterange", "quando"), {}, "neither box carries a key: each shows a spelling, not the date");
  assert.deepEqual(
    submissionEntries("daterange", "quando", { start: "2026-01-02", end: "2026-02-01" }),
    [["quando.start", "2026-01-02"], ["quando.end", "2026-02-01"]],
  );
});

test("a range sends both keys however much of it is filled in", () => {
  // The payload's shape is the field's, not the person's progress: a receiver reading `quando.end`
  // finds it present and empty rather than absent.
  assert.deepEqual(submissionEntries("daterange", "quando", { start: "2026-01-02", end: null }), [["quando.start", "2026-01-02"], ["quando.end", ""]]);
  assert.deepEqual(submissionEntries("daterange", "quando", null), [["quando.start", ""], ["quando.end", ""]]);
});

test("a range's hidden inputs follow the value and leave with the field", async () => {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(`<form id="form"><div id="root"></div></form>`);
  const form = dom.window.document.getElementById("form");
  const root = dom.window.document.getElementById("root");
  const sent = () => [...new dom.window.FormData(form).entries()];

  syncSubmission(root, "daterange", "quando", { start: "2026-01-02", end: "2026-02-01" });
  assert.deepEqual(sent(), [["quando.start", "2026-01-02"], ["quando.end", "2026-02-01"]]);
  syncSubmission(root, "daterange", "quando", { start: "2026-03-03", end: "2026-03-09" });
  assert.deepEqual(sent(), [["quando.start", "2026-03-03"], ["quando.end", "2026-03-09"]], "the inputs kept a range the field no longer holds");
  syncSubmission(root, "daterange", "quando", { start: "2026-03-03", end: "2026-03-09" }, true);
  assert.deepEqual(sent(), [], "a disabled range still sends its ends");
  syncSubmission(root, "text", "quando", "nothing to build");
  assert.equal(root.querySelectorAll("input").length, 2, "a kind whose control carries the value gets no hidden input");
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

test("each control is named by the contract, and the ones that carry no key are cleared", async () => {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(`<div id="root">
    <input class="mdy-datepicker__input mdy-daterange__input mdy-daterange__input--start" name="stale">
    <input class="mdy-datepicker__input mdy-daterange__input mdy-daterange__input--end" name="stale">
  </div>`);
  const root = dom.window.document.getElementById("root");

  applySubmissionNames(root, "daterange", "quando");
  assert.deepEqual(
    [...root.querySelectorAll("input")].map((input) => input.getAttribute("name")),
    [null, null],
    "a box carrying a key sends the date as it is spelt for the reader, beside the date itself",
  );
});

test("a date's box loses the name the shared projection gave it", async () => {
  const { JSDOM } = await import("jsdom");
  // The projection names every control it binds; a datepicker's box shows a spelling, and with a name
  // the payload carries the field's key twice — the text, then the date.
  const dom = new JSDOM(`<div id="root"><input class="mdy-datepicker__input mdy-datepicker__input--single" name="data"></div>`);
  const root = dom.window.document.getElementById("root");

  applySubmissionNames(root, "datepicker", "data");
  assert.equal(root.querySelector("input").getAttribute("name"), null);
});

test("a control the shape does not name loses the name it inherited", async () => {
  const { JSDOM } = await import("jsdom");
  // The colours picker and the hex box both come out of the shared control projection, which names
  // whatever it is bound to. Two controls under one key send the value twice, and `FormData.get`
  // keeps the first without an error.
  const dom = new JSDOM(`<div id="root">
    <input class="mdy-colors__primary-picker" name="colore">
    <input class="mdy-colors__hex-input" name="colore">
  </div>`);
  const root = dom.window.document.getElementById("root");

  applySubmissionNames(root, "colors", "colore");
  assert.deepEqual(
    [...root.querySelectorAll("input")].map((input) => input.getAttribute("name")),
    [null, "colore"],
    "the native picker carries no key: the hex box is the one the contract submits from",
  );
});

test("a list sends one input per value, in order, under one key", async () => {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(`<form id="form"><div id="root"></div></form>`);
  const form = dom.window.document.getElementById("form");
  const root = dom.window.document.getElementById("root");
  const sent = () => [...new dom.window.FormData(form).entries()];

  syncSubmitValues(root, "scelte", ["c", "a"]);
  assert.deepEqual(sent(), [["scelte", "c"], ["scelte", "a"]]);
  syncSubmitValues(root, "scelte", ["b"]);
  assert.deepEqual(sent(), [["scelte", "b"]], "a value no longer held is still sent");
});
