/**
 * The form's own parts, as against a field's.
 *
 * Not every refusal belongs to a field. One with no path — a failed call, a service that is down, a
 * rule only a server can check — has no field to be shown beside, and until this part existed no
 * renderer had anywhere to put it: the engine kept the sentence and the page said nothing.
 *
 * What is pinned here is the part of the contract three renderers read from rather than spell
 * themselves, and the rule that decides what belongs in it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MDY_FORM_SHELL_CLASSES,
  MDY_FORM_SHELL_STRUCTURE,
  fieldAccessibleName,
  formErrorsOf,
  nameIsAFallback,
  sliderTrack,
} from "../dist/index.js";

test("the form's region is a status, and its items live inside it", () => {
  const nodes = MDY_FORM_SHELL_STRUCTURE.nodes;
  assert.deepEqual(nodes.map((node) => node.part), ["formErrors", "formErrorItem"]);

  const region = nodes[0];
  // A status, not a field's error list: it speaks for the form, it appears in answer to something
  // the person did, and it is announced when it arrives rather than when it is reached.
  assert.equal(region.element, "status");
  assert.equal(region.parent, undefined, "the region belongs to the form, not to any part of it");
  assert.equal(region.order, 0, "first, before the fields — a summary nobody scrolls to is not one");

  const item = nodes[1];
  assert.equal(item.parent, "formErrors");
  assert.equal(item.repeated, true);
});

test("every part has a class, and no two share one", () => {
  // The part names are a closed vocabulary, and the type says which: a renderer naming a part the
  // contract does not declare is a renderer the themes cannot reach.
  /** @type {import("../dist/index.js").MdyFormShellPart} */
  const region = "formErrors";
  assert.ok(Object.hasOwn(MDY_FORM_SHELL_CLASSES, region));

  const parts = MDY_FORM_SHELL_STRUCTURE.nodes.map((node) => node.part);
  assert.deepEqual(Object.keys(MDY_FORM_SHELL_CLASSES).sort(), [...parts].sort());
  assert.equal(new Set(Object.values(MDY_FORM_SHELL_CLASSES)).size, parts.length);
});

test("the form shows what no field will show, and nothing else", () => {
  const errors = [
    { path: "email", kind: "server", message: "Already registered" },
    { path: null, kind: "unknown", message: "The service is unavailable" },
    { path: "rows.a.code", kind: "server", message: "Duplicate code" },
  ];

  assert.deepEqual(
    formErrorsOf(errors).map((error) => error.message),
    ["The service is unavailable"],
    "a refusal naming a field reaches the person through that field, and must not be shown twice",
  );
  assert.deepEqual(formErrorsOf([]), []);
  assert.deepEqual(formErrorsOf(errors.filter((error) => error.path !== null)), []);
});

/**
 * The track a slider is drawn on.
 *
 * A slider spans something whether or not a document declares a range, and a default is not a licence
 * to misrepresent: a form holding 150 with no bound declared drew a track ending at 100 and put the
 * thumb there, so the page showed a number the form did not hold. Both renderers had invented the
 * same `?? 100` separately.
 */
test("a track spans what the field holds where nothing declared a bound", () => {
  assert.deepEqual(sliderTrack({ min: null, max: null, step: null }, 150), { min: 0, max: 150, step: null });
  assert.deepEqual(sliderTrack({ min: null, max: null, step: null }, -20), { min: -20, max: 100, step: null });
  // Nothing held: the bare range an `<input type="range">` assumes.
  assert.deepEqual(sliderTrack({ min: null, max: null, step: null }, null), { min: 0, max: 100, step: null });
});

test("a declared bound is kept, because a rule explains the difference", () => {
  // The attribute is the native guard and must not promise less than the rules it came from, and a
  // value past a declared bound is refused with a message — so the page explains rather than hides.
  assert.deepEqual(sliderTrack({ min: null, max: 50, step: null }, 150), { min: 0, max: 50, step: null });
  assert.deepEqual(sliderTrack({ min: 10, max: null, step: null }, 2), { min: 10, max: 100, step: null });
});

test("a step that would move the thumb off the value is dropped", () => {
  assert.deepEqual(sliderTrack({ min: null, max: null, step: 5 }, 7).step, null);
  assert.equal(sliderTrack({ min: null, max: null, step: 5 }, 10).step, 5);
  // No value to misrepresent, and a step nobody declared.
  assert.equal(sliderTrack({ min: null, max: null, step: 5 }, null).step, 5);
  assert.equal(sliderTrack({ min: null, max: null, step: null }, 7).step, null);
});

/**
 * What names a control when the document said nothing.
 *
 * A label is optional in a document by design — the published corpus declares fields without one —
 * and a control with no accessible name is announced as its role and nothing else. The field's own
 * name is the fallback, and it is not a poor one: a document's field name is a single segment (a
 * dotted path is refused where the document is read) and in the corpus the names are the label's own
 * words — `city`, `zip`, `email` beside labels reading `City`, `ZIP`.
 */
test("a control is named by what was written for a person, then by the field", () => {
  assert.equal(fieldAccessibleName({ ariaLabel: "Where", label: "City", name: "city" }), "Where");
  assert.equal(fieldAccessibleName({ label: "City", name: "city" }), "City");
  assert.equal(fieldAccessibleName({ name: "city" }), "city");
  // Whitespace is not a name: a label of spaces reads as an empty one to anybody looking at it.
  assert.equal(fieldAccessibleName({ label: "   ", name: "city" }), "city");
  assert.equal(fieldAccessibleName({}), "");
});

test("a fallback name is recognisable as one", () => {
  assert.equal(nameIsAFallback({ label: "City" }), false);
  assert.equal(nameIsAFallback({ ariaLabel: "Where" }), false);
  assert.equal(nameIsAFallback({ label: "  " }), true);
  assert.equal(nameIsAFallback({}), true);
});
