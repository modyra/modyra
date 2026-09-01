/**
 * A rule written by hand and the same rule declared in a document are one act — from v5.
 *
 * `integer()` attaches `step: 1`, which is what lets a number box offer whole numbers to the
 * keyboard. A document that cannot declare the rule does not get the fact either, so the same form
 * written the two ways produced two different controls.
 *
 * The word arrived with v5 rather than being added to a published version. v2, v3 and v4 are
 * shipped, and a word added to one of them would leave two readers that both claim to support that
 * version disagreeing about what a document of it is — which is the whole reason the number exists.
 * So the refusal below is as much the feature as the acceptance.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDynamicValidators,
  factsOfAll,
  integer,
  parseDynamicForm,
} from "../dist/index.js";

const document = (version) => ({
  version,
  id: "f",
  fields: [{ name: "n", kind: "number", label: "N", validators: { integer: true } }],
});

test("a document declaring integer produces the rule written by hand", () => {
  const byHand = factsOfAll([integer()]);
  const declared = factsOfAll(buildDynamicValidators({ integer: true }).validators);
  assert.deepEqual(declared, byHand, "the two routes must reach the same facts, not merely both mention step");
  assert.equal(byHand.constraints.step, 1, "the fact this rule exists to carry");
});

test("v5 accepts the rule and carries it to the field", () => {
  const parsed = parseDynamicForm(document(5));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.fields[0].validators, { integer: true });
});

test("a version that predates the word refuses it, and says which version has it", () => {
  for (const version of [2, 3, 4]) {
    const parsed = parseDynamicForm(document(version));
    assert.equal(parsed.ok, false, `v${version} must not silently accept a word it predates`);
    const refusal = parsed.diagnostics.find((d) => d.code === "MDY_DYNAMIC_UNSUPPORTED_VERSION");
    assert.ok(refusal, `v${version} reported no version finding`);
    assert.equal(refusal.path, "/fields/n/validators/integer", "the refusal names where the word is");
    assert.match(refusal.message, /it arrived with version 5/);
    assert.match(refusal.message, new RegExp(`this document says ${version}`));
  }
});

test("a declaration that is not a boolean is refused, like every other rule", () => {
  const parsed = parseDynamicForm({
    version: 5,
    id: "f",
    fields: [{ name: "n", kind: "number", label: "N", validators: { integer: "yes" } }],
  });
  assert.equal(parsed.ok, false, "a rule the document spelled wrong is an error, not a silence");
  assert.deepEqual(parsed.fields, []);
});

test("the refusal speaks the form's language, and the author's words win", () => {
  const refuse = (config, locale) => buildDynamicValidators(config, locale).validators[0](1.5);
  assert.deepEqual(refuse({ integer: true }), ["Enter a whole number"]);
  assert.deepEqual(refuse({ integer: true }, "it"), ["Inserisci un numero intero"]);
  assert.deepEqual(
    refuse({ integer: true, messages: { integer: "Whole numbers only" } }),
    ["Whole numbers only"],
  );
});
