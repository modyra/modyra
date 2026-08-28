/**
 * What describes a control, and why it is a list rather than a choice.
 *
 * The rule was `errorsVisible ? errorId : descriptionId` — one or the other. So the moment a field
 * failed, the instruction that would have prevented the failure stopped being announced, at the one
 * moment it was most useful. An error message is not a replacement for help; a description is a list,
 * and both fit in it.
 *
 * Written because changing that composition broke no existing check. The projection is the single
 * place three renderers read this from, and nothing was asking it what it answered.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fieldDescribedBy, projectFieldShellA11y } from "../dist/index.js";

const OPTIONS = { widgetId: "f1", kind: "text", controlId: "f1__control" };
const ERRORS = [{ message: "obbligatorio", origin: "validation" }];

const describedBy = (flags, errors, extra) =>
  projectFieldShellA11y(flags, errors, { ...OPTIONS, ...extra }).control.attributes["aria-describedby"];

test("an error does not take the place of the help", () => {
  const both = describedBy({ disabled: false, required: true }, ERRORS,
    { errorsVisible: true, descriptionVisible: true });
  assert.equal(both, "f1__errors f1__description",
    "the error replaced the help. The instruction that would have prevented the failure stops being "
    + "read at the moment it is most useful");
});

test("the error is named first", () => {
  // Somebody who moves on after the first sentence has heard the one that mattered.
  const named = describedBy({ disabled: false, required: true }, ERRORS,
    { errorsVisible: true, descriptionVisible: true }).split(" ");
  assert.deepEqual(named, ["f1__errors", "f1__description"], "the help is announced before the error");
});

test("a reserved container is named even while it holds nothing", () => {
  // An element with no text contributes nothing to the description — not a pause, not "empty", as
  // though the reference were absent — until text appears inside it. That is what makes a reference
  // that never changes cheaper than one that is corrected: it has no moment at which it can point at
  // an element not yet drawn, or one already gone.
  const atRest = describedBy({ disabled: false, required: true }, [],
    { errorsReserved: true, descriptionVisible: false });
  assert.equal(atRest, "f1__errors",
    "a renderer that keeps the container on the page at rest was left with no reference to it, so "
    + "the reference has to be written when the message arrives and withdrawn when it clears");
});

test("a renderer that reserves nothing is unaffected", () => {
  // `errorsReserved` defaults to `errorsVisible`, so not passing it keeps the old shape exactly.
  assert.equal(describedBy({ disabled: false, required: true }, [], { descriptionVisible: true }),
    "f1__description");
  assert.equal(describedBy({ disabled: false, required: true }, ERRORS,
    { errorsVisible: true, descriptionVisible: false }), "f1__errors");
});

test("a control with nothing to describe it names nothing", () => {
  // A description is not a channel that must always carry something. A control whose name and state
  // say everything does not need one, and adding one for symmetry is noise.
  assert.equal(describedBy({ disabled: false, required: false }, [], { descriptionVisible: false }), null,
    "an empty reference list was written as an attribute rather than left off");
});

test("the composition is one function, and answers on its own", () => {
  const both = fieldDescribedBy({
    errorId: "e", descriptionId: "d", errorsPresent: true, descriptionPresent: true,
  });
  assert.equal(both, "e d");
  assert.equal(fieldDescribedBy({
    errorId: "e", descriptionId: "d", errorsPresent: false, descriptionPresent: true,
  }), "d");
  assert.equal(fieldDescribedBy({
    errorId: "e", descriptionId: "d", errorsPresent: false, descriptionPresent: false,
  }), null);
});
