/**
 * Parse, apply and mount are one act, so none of them can be forgotten.
 *
 * `parseDynamicForm` reads a document and `mountMdyForm` draws it — and between them sits
 * `applyDynamicRules`, which the caller has to remember. Forget it and everything compiles, the
 * form mounts, and the conditions the document declared never fire: the page looks obeyed while the
 * rules are inert. That is the trap this door removes by not having a step to skip.
 *
 * It is strict whatever the parser's default is. A lenient parse is right for a reader, who is told
 * what was dropped; it is wrong here, because the person reaching for a one-call mount is exactly
 * the one who will not read diagnostics.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountDynamicForm, mountMdyForm } = await import("../dist/index.js");
const { parseDynamicForm } = await import("@modyra/core");

const host = () => {
  const element = document.createElement("div");
  document.body.append(element);
  return element;
};

/** A document whose rule hides a field until another says so — the rule has to be applied to work. */
const CONDITIONAL = {
  version: 5,
  id: "conditional",
  fields: [
    { name: "kind", kind: "select", label: "Kind", options: [
      { value: "person", label: "Person" }, { value: "company", label: "Company" },
    ] },
    { name: "vat", kind: "text", label: "VAT" },
  ],
  rules: [{
    effect: "visible",
    target: "vat",
    when: { field: "kind", operator: "equals", value: "company" },
  }],
};

test("the rules a document declares are applied, not merely parsed", () => {
  const where = host();
  const { form } = mountDynamicForm(where, CONDITIONAL);
  form.f.kind.set("person");

  // Whether the rule fired is asked of the form, not of the page: a renderer may draw a hidden
  // field or not, and what the document declared is that the value is out of play.
  assert.equal(
    Object.keys(form.submitValue()).includes("vat"),
    false,
    "the hide rule was parsed and never applied — the trap this door exists to remove",
  );

  form.f.kind.set("company");
  assert.equal(Object.keys(form.submitValue()).includes("vat"), true, "the rule did not lift again");
});

test("mounting by hand without applying the rules is the mistake being removed", () => {
  // The same document, mounted the long way and one step short. Kept as a test rather than as a
  // sentence: it is the behaviour the one-act door is measured against, and if it ever stops being
  // wrong this test says so.
  const parsed = parseDynamicForm(CONDITIONAL, { mode: "strict" });
  assert.equal(parsed.ok, true);
  const { form } = mountMdyForm(host(), parsed.fields, { layout: parsed.layout });
  form.f.kind.set("person");
  assert.equal(
    Object.keys(form.submitValue()).includes("vat"),
    true,
    "forgetting applyDynamicRules no longer changes anything, so this door guards nothing",
  );
});

test("a document that lost a declaration is refused, with what it lost", () => {
  // A condition written inside the field rather than beside it: the parser drops the member and, in
  // lenient mode, hands back a field with no condition at all.
  const lossy = {
    version: 5,
    id: "lossy",
    fields: [{ name: "taxCode", kind: "text", label: "Tax code", when: { field: "country", equals: "it" } }],
  };
  assert.equal(parseDynamicForm(lossy).fields.length, 1, "the lenient read no longer returns the field");

  assert.throws(
    () => mountDynamicForm(host(), lossy),
    (error) => {
      assert.match(error.message, /MDY_DYNAMIC_UNKNOWN_MEMBER/, "the refusal did not say what was lost");
      assert.match(error.message, /taxCode|\/fields\/0/, "the refusal did not say where");
      return true;
    },
  );
});

test("a document with nothing wrong mounts", () => {
  const where = host();
  const { form } = mountDynamicForm(where, {
    version: 5,
    id: "plain",
    fields: [{ name: "a", kind: "text", label: "A", validators: { required: true } }],
  });
  assert.equal(where.querySelectorAll(".mdy-renderer").length, 1);
  assert.equal(form.f.a.required(), true, "a rule the document declared did not reach the field");
});
