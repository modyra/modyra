/**
 * What may be a widget id.
 *
 * An id is not free-form text: it is a segment of every generated id, and generated ids end up in
 * `for`, in `aria-labelledby` and in `aria-describedby`. Two characters are structural there — the
 * delimiter, which makes two different widgets collide, and whitespace, which makes one reference
 * into several — and neither failure is visible in markup that otherwise looks correct.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MDY_ID_DELIMITER,
  booleanFieldPartIds,
  defaultWidgetIdFactory,
  isValidWidgetId,
  optionFieldPartIds,
  textFieldPartIds,
} from "../dist/index.js";

test("an id that would split an ARIA reference is not a valid widget id", () => {
  // `aria-labelledby` and `aria-describedby` are space-separated *lists*, so a widget id carrying a
  // space makes one reference into several: `aria-labelledby="my form__label"` is read as `my` and
  // `form__label`, and each resolves to nothing anyone rendered. The control ends up with no
  // accessible name while the markup looks correct — the same failure the delimiter rule prevents,
  // arriving through a character nobody thought of as structural.
  for (const spaced of ["my form", " leading", "trailing ", "two\tsegments", "line\nbreak"]) {
    assert.equal(isValidWidgetId(spaced), false, `${JSON.stringify(spaced)} was accepted`);
  }

  // The ids a host actually uses are unaffected: the rule is whitespace, not punctuation.
  for (const usable of ["a", "field-name", "form.name", "user_email", "1", "Ω"]) {
    assert.equal(isValidWidgetId(usable), true, `${JSON.stringify(usable)} was refused`);
  }

  // The delimiter rule it joins, unchanged.
  assert.equal(isValidWidgetId(`a${MDY_ID_DELIMITER}b`), false);
  assert.equal(isValidWidgetId(""), false);
});

test("the factory joins what it is given, and the guard is what decides", () => {
  // Deliberately not a second gate: an id is consumer-visible, so a factory that repaired one
  // silently would change what a host's own tests and stylesheets look for. The guard is the
  // question a host asks; joining stays deterministic and reversible.
  assert.equal(defaultWidgetIdFactory.part("field", "label"), `field${MDY_ID_DELIMITER}label`);
  assert.equal(
    defaultWidgetIdFactory.item("field", "option", "3"),
    `field${MDY_ID_DELIMITER}option${MDY_ID_DELIMITER}3`,
  );
});

test("a widget's part ids are refused when its id cannot be referenced", () => {
  // A predicate protects the renderers that remember to call it, and this package is the surface a
  // third-party renderer is built on. The builders are the contract's front door, so they answer
  // even when nobody asked the question first.
  assert.throws(() => textFieldPartIds("my form"), /cannot be a widget id/);
  assert.throws(() => booleanFieldPartIds(""), /cannot be a widget id/);
  assert.throws(() => optionFieldPartIds(`a${MDY_ID_DELIMITER}b`), /cannot be a widget id/);

  // …and an ordinary id is built exactly as before. The control carries the widget id itself, which
  // is why the delimiter may not appear in one: `field__label` as a widget id and the label of
  // `field` would be the same string.
  const ids = textFieldPartIds("field");
  assert.equal(ids.inputId, "field");
  assert.equal(ids.labelId, `field${MDY_ID_DELIMITER}label`);
});

test("the joining primitive stays a joining primitive", () => {
  // Deliberately not guarded: a consumer may replace the factory, it is documented as deterministic
  // and reversible, and something constructing ids speculatively is entitled to use it.
  assert.equal(defaultWidgetIdFactory.part("my form", "label"), `my form${MDY_ID_DELIMITER}label`);
});
