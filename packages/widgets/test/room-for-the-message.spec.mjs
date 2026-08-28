/**
 * The space the error message will need, and the exemption that has to announce itself.
 *
 * Two checks that arrived together because the same reading produced both: a rule suspended in
 * silence and a container that appears late are the same failure seen from two sides — something is
 * true of the page that nothing in the result says.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fieldCanBeInvalid, MDY_WIDGET_CONTRACTS } from "../dist/index.js";
import { inspectWidgetDom } from "../dist/testing/index.js";
import { installDomGlobals } from "../../plain/test/support/dom-env.mjs";

installDomGlobals();

test("a field that can fail a rule reserves the space; one that cannot does not", () => {
  // Read from the field, never from its kind. The reservation costs a line of scrolling on every
  // field that carries it, so a field with no rule at all must not carry one.
  const cases = [
    ["a required field", { required: true, constraints: {} }, true],
    ["a note with a length limit", { required: false, constraints: { maxLength: 200 } }, true],
    ["a number with a bound", { required: false, constraints: { max: 50 } }, true],
    ["a free note with no rule", { required: false, constraints: {} }, false],
    ["no constraints at all", { required: false, constraints: null }, false],
    ["a field that says nothing", {}, false],
  ];
  for (const [name, field, expected] of cases) {
    assert.equal(fieldCanBeInvalid(field), expected, `${name}: reserved should be ${expected}`);
  }
});

test("a constraint present and unset is not a constraint", () => {
  // What a narrowing leaves behind. Counting the key rather than the value would reserve a line
  // under every field any narrowing has touched, which is most of them.
  assert.equal(fieldCanBeInvalid({ constraints: { max: undefined, min: undefined } }), false,
    "a constraint set to nothing reserved a line — a narrowing leaves these keys behind everywhere");
  assert.equal(fieldCanBeInvalid({ constraints: { max: undefined, minLength: 1 } }), true,
    "one real rule beside two empty ones is still a rule");
});

test("the reservation depends on the field's rules and never on its errors", () => {
  // The container stays once a message clears. Taking the space back is the same jump as giving it,
  // upward, under the same thumb — so nothing about the current errors may enter this answer.
  const field = { required: true, constraints: { maxLength: 3 } };
  assert.equal(fieldCanBeInvalid({ ...field, errors: [] }), true);
  assert.equal(fieldCanBeInvalid({ ...field, errors: [{ message: "too long" }] }), true,
    "the answer moved when errors appeared — then it will move back when they clear");
});

test("the class-rule exemption reports itself instead of passing quietly", () => {
  // A result that does not say a rule was suspended reads exactly like one where the rule held, and
  // the person who passes the option is not the person who later reads the green.
  const kind = "text";
  const root = document.createElement("div");
  for (const className of MDY_WIDGET_CONTRACTS[kind].rootClasses) root.classList.add(className);
  root.classList.add("mdy-plain-invented");
  document.body.append(root);

  const strict = inspectWidgetDom(root, kind, { strictClasses: true });
  assert.ok(strict.some((issue) => issue.code === "INVENTED_CLASS"),
    "the premise failed: an undeclared class was not reported even with the rule on, so the rest of "
    + "this check proves nothing about the exemption");

  const exempt = inspectWidgetDom(root, kind, { strictClasses: true, adapterPrefix: "mdy-plain-" });
  assert.equal(exempt.some((issue) => issue.code === "INVENTED_CLASS"), false,
    "the exemption did not suspend the rule, so there is nothing here to announce");
  assert.ok(exempt.some((issue) => issue.code === "EXEMPTION_ACTIVE"),
    "the rule was suspended and the result says nothing about it. Five undeclared classes lived for "
    + "months behind exactly this silence, in a repository whose check fails on undeclared classes");

  const announced = exempt.find((issue) => issue.code === "EXEMPTION_ACTIVE");
  assert.ok(announced.message.includes("mdy-plain-invented"),
    "the exemption is announced without naming what it let through");
  root.remove();
});

test("an exemption that skips nothing announces nothing", () => {
  // Otherwise every caller carries a permanent finding for a rule that never fired, and the report
  // stops distinguishing the page that used the exemption from the page that merely declared it.
  const kind = "text";
  const root = document.createElement("div");
  for (const className of MDY_WIDGET_CONTRACTS[kind].rootClasses) root.classList.add(className);
  document.body.append(root);

  const issues = inspectWidgetDom(root, kind, { strictClasses: true, adapterPrefix: "mdy-plain-" });
  assert.equal(issues.some((issue) => issue.code === "EXEMPTION_ACTIVE"), false,
    "an exemption that let nothing through still reported itself");
  root.remove();
});
