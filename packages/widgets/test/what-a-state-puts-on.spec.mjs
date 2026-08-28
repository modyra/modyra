/**
 * Which shell classes a field's state puts on, and — the half that was missing — which it takes off.
 *
 * `MDY_FIELD_STATE_CLASSES` declared the base each shell part carries and the states it admits, and
 * never the answer: *given these flags, which classes are on*. So every renderer wrote it out, with
 * the names as string literals beside lines that read the vocabulary properly, and one of them
 * repeats a single state class in seventeen places.
 *
 * Two things a renderer gets wrong on its own, and both are here:
 *
 * - **one state, two spellings.** A failing field is `--error` on its wrapper and `--has-error` on
 *   its label. Both were declared; nothing composed them, so each renderer paired them by hand.
 * - **off is an answer.** A list of only the classes that are on says what to add and not what to
 *   remove, and a field that stops failing keeps the class that says it is — a control left looking
 *   wrong after it was corrected.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MDY_FIELD_STATE_CLASSES, shellStateClasses } from "../dist/index.js";

test("one state, two spellings, and both are named", () => {
  const { control, label } = shellStateClasses({ error: true });
  assert.equal(control[`${MDY_FIELD_STATE_CLASSES.control}--error`], true);
  assert.equal(label[`${MDY_FIELD_STATE_CLASSES.label}--has-error`], true,
    "the label's spelling of the failing state was not turned on. It is a different word for the "
    + "same fact, and pairing them by hand is what each renderer was doing");
});

test("a state that is off is named too, not left out", () => {
  const off = shellStateClasses({});
  for (const part of ["field", "control", "label"]) {
    const named = Object.entries(off[part]);
    assert.ok(named.length > 0, `${part} named no class at all`);
    assert.deepEqual(named.filter(([, on]) => on).map(([name]) => name), [],
      `${part} turned a class on for a field in no state`);
  }
  // The property that makes the above worth having: a renderer can drive `classList.toggle` straight
  // off this and a state that goes away takes its class with it.
  const wasFailing = shellStateClasses({ error: true });
  const corrected = shellStateClasses({ error: false });
  assert.equal(corrected.control[`${MDY_FIELD_STATE_CLASSES.control}--error`], false,
    "a corrected field is not told to drop the class that says it is failing");
  assert.deepEqual(Object.keys(corrected.control), Object.keys(wasFailing.control),
    "the two answers name different classes, so a renderer toggling from one to the other leaves a "
    + "class nobody mentioned still on the element");
});

test("every class is built from the declared base and never spelled here", () => {
  const all = shellStateClasses({ open: true, touched: true, disabled: true, readonly: true, error: true, filled: true, unwritten: true });
  const bases = { field: MDY_FIELD_STATE_CLASSES.field, control: MDY_FIELD_STATE_CLASSES.control, label: MDY_FIELD_STATE_CLASSES.label };
  for (const [part, base] of Object.entries(bases)) {
    for (const name of Object.keys(all[part])) {
      assert.ok(name.startsWith(`${base}--`),
        `${part} names ${name}, which is not a state of ${base}. A class written here rather than "
        + "derived is one a theme cannot find from the vocabulary`);
    }
  }
});

test("the states named are the ones the contract admits", () => {
  // Derived from the table rather than listed: a state added to the vocabulary and not to the
  // answer is exactly the gap this function exists to close, so the check has to notice it.
  const all = shellStateClasses({ open: true, touched: true, disabled: true, readonly: true, error: true, filled: true, unwritten: true });
  const suffixes = (part, base) => Object.keys(all[part]).map((name) => name.slice(base.length + 2)).sort();
  assert.deepEqual(suffixes("field", MDY_FIELD_STATE_CLASSES.field), [...MDY_FIELD_STATE_CLASSES.fieldStates].sort());
  assert.deepEqual(suffixes("control", MDY_FIELD_STATE_CLASSES.control), [...MDY_FIELD_STATE_CLASSES.controlStates].sort());
  assert.deepEqual(suffixes("label", MDY_FIELD_STATE_CLASSES.label), [...MDY_FIELD_STATE_CLASSES.labelStates].sort());
});
