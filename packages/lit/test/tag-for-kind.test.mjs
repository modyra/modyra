/**
 * The map a host would otherwise keep a copy of.
 *
 * A copy needs a fallback for the kind it does not find, and the fallback every copy reaches for is a
 * text field — so `kind: "passwordd"`, one letter more than a real kind, renders as a visible box
 * holding what the user types. `null` is what lets a host refuse instead.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { MDY_WIDGET_KINDS } from "../../widgets/dist/index.js";
import { mdyLitTagFor } from "../dist/components/registry.js";

test("every kind the contract publishes has an element that draws it", () => {
  const undrawn = MDY_WIDGET_KINDS.filter((kind) => mdyLitTagFor(kind) === null);
  assert.deepEqual(undrawn, [], "a kind the contract publishes and this package draws with nothing");
});

test("a kind nobody declared has no element, rather than a text box", () => {
  assert.equal(mdyLitTagFor("passwordd"), null);
  assert.equal(mdyLitTagFor(""), null);
  assert.equal(mdyLitTagFor("__proto__"), null, "a key that is not data was read as one");
});

test("the kinds that share an element say which they are through type", () => {
  // The same shape a consumer writes by hand: <mdy-text-field type="email">.
  assert.equal(mdyLitTagFor("email"), mdyLitTagFor("text"));
  assert.equal(mdyLitTagFor("password"), mdyLitTagFor("text"));
});
