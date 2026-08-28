/**
 * Every optional part says when it is there.
 *
 * `optional` said a renderer *may* leave a part out and stopped. So three renderers each decided when
 * to build it, and conformance had nothing to ask — you cannot check a rule nobody wrote. All 195
 * optional nodes were silent; all 195 now answer.
 *
 * This was a baseline that could only shrink while the gap was being closed in batches, which is the
 * right shape for a gap and the wrong one for a closed gap: a list of exceptions leaves somewhere to
 * put the next one. It is a floor now.
 *
 * A *wrong* condition is worse than a missing one — it tells a renderer to build something at a
 * moment when it is not wanted, and nothing notices until it is on the page — so every condition
 * here was read out of the renderer that draws the part and then confirmed against a rendered page,
 * never reasoned to. Twice the obvious reading was contradicted by the page.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MDY_FORM_SHELL_STRUCTURE, MDY_PART_PRESENCES, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS,
} from "../dist/index.js";
import { MDY_FIELD_SHELL_STRUCTURE } from "../dist/vocabulary.js";

/**
 * The vocabulary a condition may be drawn from, read rather than restated.
 *
 * Listed here instead, this check would pass while the declaration grew past it — a copy of a
 * vocabulary is a second vocabulary, and the one nobody updates is the one the check is using.
 */
const CONDITIONS = new Set(MDY_PART_PRESENCES);

/** Every optional node in the contract, from each kind and from the two shells. */
function everyOptionalNode() {
  const found = [];
  const take = (structure, owner) => {
    for (const node of structure?.nodes ?? []) {
      if (node.optional === true) found.push({ owner, ...node });
    }
  };
  for (const kind of MDY_WIDGET_KINDS) take(MDY_WIDGET_CONTRACTS[kind].structure, kind);
  take(MDY_FIELD_SHELL_STRUCTURE, "field-shell");
  take(MDY_FORM_SHELL_STRUCTURE, "form-shell");
  return found;
}

test("every optional part says when it is there", () => {
  // Absolute, not a list that shrinks. It was a shrinking baseline while 81 of them were undecided,
  // and a baseline is the right shape for a gap being closed in batches — but it is the wrong shape
  // once the gap is closed, because it leaves a place to put the next one.
  //
  // `optional` on its own says a renderer *may* leave a part out and stops there, so each renderer
  // decided when to build it and conformance had nothing to ask. A part added without a condition
  // reopens that, one part at a time and silently.
  const silentParts = everyOptionalNode().filter((node) => node.presentWhen === undefined);
  assert.deepEqual(silentParts.map((node) => `${node.owner}.${node.part}`), [],
    "an optional part does not say when it is on the page. Add it to MDY_PART_PRESENCE, or give "
    + "MDY_PART_PRESENCES a word for the fact it is present under");
});

test("every condition that is declared is one the contract knows", () => {
  const invented = everyOptionalNode()
    .filter((n) => n.presentWhen !== undefined && !CONDITIONS.has(n.presentWhen));
  assert.deepEqual(invented.map((n) => `${n.owner}.${n.part}=${n.presentWhen}`), [],
    "a part is present under a condition outside the declared vocabulary. Free text is unreadable to "
    + "a check, and a check is the reason the condition is declared at all");
});

test("the two places this anatomy is declared agree on every condition", () => {
  // The field shell is written out once and derived again for each kind. Two declarations of one
  // anatomy is how a condition comes to mean one thing in the shell and another in a widget.
  const shell = new Map(MDY_FIELD_SHELL_STRUCTURE.nodes.map((n) => [n.part, n.presentWhen]));
  let compared = 0;
  for (const kind of MDY_WIDGET_KINDS) {
    for (const node of MDY_WIDGET_CONTRACTS[kind].structure.nodes) {
      if (!shell.has(node.part)) continue;
      compared += 1;
      assert.equal(node.presentWhen, shell.get(node.part),
        `${kind}.${node.part} is present under "${node.presentWhen}" and the shell says `
        + `"${shell.get(node.part)}" — one anatomy, declared twice, disagreeing`);
    }
  }
  assert.ok(compared > 100, `only ${compared} shell parts compared across the kinds`);
});

test("the parts that decide half of this carry the condition they were given", () => {
  // Six names account for more than half the optional nodes, and the error container is the one an
  // outside reading settled: reserved under every field that can fail a constraint, at rest, and
  // still reserved after a correction — taking the space back is the same jump as giving it.
  const expected = {
    label: "documentDeclaresIt", supportingText: "documentDeclaresIt",
    requiredMarker: "fieldIsRequired", errors: "fieldCanBeInvalid",
    errorItem: "errorsAreVisible", inlineError: "errorsAreVisible",
  };
  let held = 0;
  for (const node of everyOptionalNode()) {
    const want = expected[node.part];
    if (want === undefined) continue;
    assert.equal(node.presentWhen, want, `${node.owner}.${node.part} is present under "${node.presentWhen}"`);
    held += 1;
  }
  assert.ok(held >= 100, `only ${held} of the six names checked — they should cover more than half`);
});
