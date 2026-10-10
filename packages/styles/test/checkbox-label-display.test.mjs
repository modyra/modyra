/**
 * The checkbox's words are a label sized to its content. The shell's `mdy-label` class sets
 * `display: block` on every label it styles, and when it wins the whole row becomes the label and
 * the empty remainder of the row is a pointer target.
 *
 * The cascade is checked on the stylesheet's own rules: the two selectors that touch the same
 * element are compared by specificity, with source order breaking a tie, which is how a browser
 * decides. Only the rules that set `display` on these labels are read.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../src/modyra.css", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

// Flat rules in source order. Nested blocks (@media) are read at their innermost rule, which is the
// only place a declaration can be.
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match, order) => ({
  selector: match[1].trim(),
  body: match[2],
  order,
}));

const declaredDisplay = (selector) => {
  const found = rules.filter((rule) => rule.selector === selector && /(^|;)\s*display\s*:/.test(rule.body));
  assert.equal(found.length, 1, `expected one rule setting display on "${selector}", found ${found.length}`);
  return { ...found[0], display: found[0].body.match(/(?:^|;)\s*display\s*:\s*([^;]+)/)[1].trim() };
};

// Specificity for the compound selectors this file compares: ids, classes and attributes, pseudo
// classes, and type selectors. Combinators contribute nothing.
const specificity = (selector) => {
  const ids = (selector.match(/#[\w-]+/g) ?? []).length;
  const classes = (selector.match(/\.[\w-]+/g) ?? []).length
    + (selector.match(/\[[^\]]*\]/g) ?? []).length
    + (selector.match(/:(?!:)[\w-]+/g) ?? []).length;
  const types = (selector.match(/(^|[\s>+~])[a-z][\w-]*/g) ?? []).length;
  return [ids, classes, types];
};

const compare = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);

// Every rule that sets `display` on a checkbox's label, and the shell rule that sets it on every
// label. The element a checkbox's label is carries the shell's class, so both apply to it.
const checkboxLabelRules = rules.filter((rule) =>
  /^\.mdy-checkbox\s*>\s*label(\.mdy-label)?$/.test(rule.selector) && /(^|;)\s*display\s*:/.test(rule.body));
const shellLabel = declaredDisplay(".mdy-renderer .mdy-label");

test("a checkbox's label is inline-flex and the shell's block label does not take it back", () => {
  assert.ok(checkboxLabelRules.length > 0, "no rule sets display on a checkbox's label");
  const claimants = [...checkboxLabelRules, shellLabel]
    .map((rule) => ({
      selector: rule.selector,
      order: rule.order,
      display: rule.body.match(/(?:^|;)\s*display\s*:\s*([^;]+)/)[1].trim(),
      specificity: specificity(rule.selector),
    }))
    .sort((a, b) => compare(a.specificity, b.specificity) || a.order - b.order);
  const winner = claimants.at(-1);

  assert.notEqual(
    winner.selector,
    shellLabel.selector,
    `${shellLabel.selector} (${shellLabel.display}) outranks the checkbox's label rule, so the label is block-sized`,
  );
  assert.equal(winner.display, "inline-flex");
});

test("the shell's label rule is unchanged for every other label", () => {
  assert.equal(declaredDisplay(".mdy-renderer .mdy-label").display, "block");
});
