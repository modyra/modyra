/**
 * The trailing affordance set is derived, and derives the right thing.
 *
 * The value of deriving it is that it cannot go stale: a kind that gains a button gains an
 * affordance without anyone remembering to add it here. The risk is the mirror image — a derivation
 * that quietly sweeps in something that is not one. Both are checked.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MDY_WIDGET_CONTRACTS,
  affordanceClasses,
  kindsWithAffordances,
  trailingAffordances,
} from "../dist/index.js";

const partsOf = (kind) => trailingAffordances(kind).map((a) => a.part).sort();

test("each kind's affordances are the ones at its trailing edge", () => {
  assert.deepEqual(partsOf("select"), ["arrow"]);
  assert.deepEqual(partsOf("datepicker"), ["toggle"]);
  assert.deepEqual(partsOf("daterange"), ["toggle"]);
  assert.deepEqual(partsOf("timepicker"), ["toggle"]);
  // The caret is still at the trailing edge and a theme still places it from this list. What changed
  // is which side of the list it is on: the filled square opens the panel, so the caret says which
  // way it opens and does nothing. ADR 0159.
  assert.deepEqual(partsOf("colors"), ["toggle"]);
  assert.deepEqual(trailingAffordances("colors").map((a) => a.role), ["indicator"]);
  // The magnifier is gone: the control opens the popup, and what sits at the trailing edge is the
  // arrow that says which way it opens — the same affordance the single-choice sibling has.
  // The arrow, the button that takes every choice off, the one that says how many chips are out of
  // sight, and the way back to what the last of them removed. All four sit in the same column as
  // every other trailing control and three of them are pressed, so they need the hit target the
  // others get. The way back belongs here and not under the field: it is the remedy for the
  // clear-all, and a remedy a person has to look elsewhere for is one they do not find.
  assert.deepEqual(partsOf("multiselect"), ["arrow", "clearAll", "overflowCount", "wayBackAction"]);
  assert.deepEqual(partsOf("number"), ["decrement", "increment"]);
});

test("a field with nothing at its edge has none", () => {
  for (const kind of ["text", "email", "password", "textarea", "checkbox", "toggle", "radio"]) {
    assert.deepEqual(trailingAffordances(kind), [], kind);
  }
});

test("the carets are the decorative ones", () => {
  const indicators = kindsWithAffordances().flatMap((kind) =>
    trailingAffordances(kind).filter((a) => a.role === "indicator").map((a) => `${kind}.${a.part}`),
  );
  // Every kind whose caret says which way its panel opens, and none of them is what opens it.
  //
  // Two of the three are `pointer-events: none` with the field's own control behind them as the
  // target. The colours caret is not: the square that opens its panel is at the other end of the
  // field, so a caret that took no pointer would leave a patch inside a live control answering
  // nothing — which reads as "sometimes it does not work" and is the hardest report to act on. It
  // takes the press and has no name, no role and no keyboard stop, which is what makes it a drawing.
  // ADR 0159.
  assert.deepEqual(indicators.slice().sort(),
    ["colors.toggle", "multiselect.arrow", "select.arrow"]);
});

test("a button that is not at the trailing edge is not swept in", () => {
  // The derivation's real risk. Each of these is a `button` the catalogue declares somewhere else —
  // inside a popup, inside a chip, inside a dropzone — and none belongs to the column down the
  // field's edge.
  const swept = [];
  for (const kind of kindsWithAffordances()) {
    for (const { part } of trailingAffordances(kind)) {
      if (["action", "modeToggle", "optionStep", "chip", "clear"].includes(part)) {
        swept.push(`${kind}.${part}`);
      }
    }
  }
  assert.deepEqual(swept, []);
});

test("the pickers' typeable control is not an affordance", () => {
  // datepicker and timepicker declare `control` as the popup's opener: the input carries
  // `role="combobox"` and opens the popup. It is the field, not an ornament beside it, and a
  // derivation keyed on "the opener" alone would have taken it.
  for (const kind of ["datepicker", "timepicker"]) {
    assert.ok(!partsOf(kind).includes("control"), `${kind} must not treat its input as an affordance`);
  }
});

test("the class list a theme selects on comes from the catalogue", () => {
  const control = affordanceClasses("control");
  const indicator = affordanceClasses("indicator");

  assert.deepEqual(indicator.slice().sort(),
    ["mdy-colors__toggle-area", "mdy-multiselect__arrow", "mdy-select__arrow"]);
  for (const expected of ["mdy-datepicker__toggle", "mdy-timepicker__toggle"]) {
    assert.ok(control.includes(expected), `missing ${expected}`);
  }
  // The colours caret says which way the field opens and is not what opens it: the filled square is.
  // So it is an indicator beside the other two carets, not a control — a control is a thing with a
  // name, a keyboard stop and a role, and this has none of the three. ADR 0159.
  assert.ok(!control.includes("mdy-colors__toggle-area"), "the colours caret is not a command");
  // No overlap: a class cannot be both pressed and decorative.
  assert.deepEqual(control.filter((c) => indicator.includes(c)), []);
});

test("every derived class is one the catalogue actually declares", () => {
  // A class list that names something no part carries is the stale-key defect this repo has already
  // had, in a table that matched nothing on every widget build.
  const declared = new Set();
  for (const definition of Object.values(MDY_WIDGET_CONTRACTS)) {
    for (const part of Object.values(definition.parts)) {
      for (const cls of part.classes ?? []) declared.add(cls);
    }
  }
  for (const cls of affordanceClasses()) {
    assert.ok(declared.has(cls), `${cls} is not declared by any part`);
  }
});

test("a caret means the same thing wherever one is drawn", () => {
  // The same mark on two kinds answering two different vocabularies is the failure this catches: the
  // single-choice list turned its caret on `open` and the multi-choice one had no `open` to turn,
  // because the state was declared on one and not the other. Nothing measured the difference — each
  // contract was consistent with itself.
  const carets = Object.entries(MDY_WIDGET_CONTRACTS)
    .filter(([, contract]) => contract.parts.arrow !== undefined)
    .map(([kind, contract]) => [kind, [...(contract.parts.arrow.states ?? [])].sort().join(",")]);

  assert.ok(carets.length > 1, "fewer than two kinds draw a caret, so this asserts nothing");
  const vocabularies = [...new Set(carets.map(([, states]) => states))];
  assert.deepEqual(
    vocabularies,
    ["open"],
    `kinds that draw a caret declare different states for it: ${JSON.stringify(carets)}. `
    + "Which way a caret points is the only thing a closed control shows about its list, so a kind "
    + "whose caret has no open state is a kind whose caret cannot say anything.",
  );
});
