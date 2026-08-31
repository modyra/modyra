/**
 * A rule written by hand and the same rule declared in a document are one act.
 *
 * `integer()` attaches `step: 1` — what the rule does to the native control, so a number box offers
 * whole numbers to the keyboard. A document that cannot declare the rule does not get the fact
 * either, and the same form written the two ways produced two different controls.
 *
 * The comparison is what makes this checkable: asserting `step: 1` alone would pass against a
 * document language that hard-codes the fact without the rule behind it. Facts are compared between
 * the two routes, so the only way to satisfy this is to run the same validator.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDynamicValidators,
  factsOfAll,
  integer,
  parseDynamicForm,
} from "../dist/index.js";

test("a document declaring integer produces the rule written by hand", () => {
  const byHand = factsOfAll([integer()]);
  const declared = factsOfAll(buildDynamicValidators({ integer: true }).validators);
  assert.deepEqual(declared, byHand, "the two routes must reach the same facts, not merely both mention step");
  assert.equal(byHand.constraints.step, 1, "the fact this rule exists to carry");
});

test("the rule reaches a parsed document's field", () => {
  const parsed = parseDynamicForm([
    { name: "n", kind: "number", label: "N", validators: { integer: true } },
  ]);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.fields[0].validators, { integer: true });
});

test("a declaration that is not a boolean is refused, like every other rule", () => {
  const parsed = parseDynamicForm([
    { name: "n", kind: "number", label: "N", validators: { integer: "yes" } },
  ]);
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
