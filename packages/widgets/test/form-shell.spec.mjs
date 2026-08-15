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
  formErrorsOf,
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
