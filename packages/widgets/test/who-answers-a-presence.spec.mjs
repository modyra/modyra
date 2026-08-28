/**
 * The resolvers answer, and they agree with the table the fixtures mount from.
 *
 * `valueIsPresent` is the one worth guarding twice. Its rule is derived from the value contract —
 * `nullable` separates a number field whose empty is `null` from a slider whose empty is where it
 * starts — and the same fact is written down a second time, as `MDY_CANONICAL_EMPTY`, which every
 * adapter's conformance fixture mounts from. Two statements of one rule is the shape this session
 * has spent its day removing, and where one cannot yet be deleted the next best thing is that they
 * cannot drift apart in silence.
 *
 * So: for every kind, the value the fixtures call empty is a value this rule calls absent. The rule
 * is primary; the table is checked against it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fieldIsRequired,
  inputWasRefused,
  MDY_PRESENCE_RESOLUTION,
  MDY_WIDGET_CONTRACTS,
  MDY_WIDGET_KINDS,
  undoIsOnOffer,
  valueIsAbsent,
  valueIsPresent,
  viewIsActive,
  workIsInFlight,
} from "../dist/index.js";
import { MDY_CANONICAL_EMPTY, MDY_CANONICAL_FILLED } from "../dist/testing/index.js";
import { MDY_VALUE_CONTRACTS } from "@modyra/core";

/**
 * A kind whose empty is where its control starts rather than an absence.
 *
 * A non-nullable numeric value has no absent state: a slider sits at its floor and holds a number
 * there. `valueIsPresent` is not handed that floor and refuses to invent one, so these kinds fall
 * outside the agreement below — derived from the declaration, so a kind that becomes numeric or stops
 * being nullable carries the exemption without an edit here, and the last test is what makes the
 * exemption safe by asserting nothing declares a part under the condition for one of them.
 */
const emptyIsAFloor = (kind) => {
  const declared = MDY_VALUE_CONTRACTS[kind];
  return declared !== undefined && declared.shape === "number" && !declared.nullable;
};

test("what the fixtures call empty, the rule calls absent — for every kind", () => {
  const covered = MDY_WIDGET_KINDS.filter((kind) => kind in MDY_CANONICAL_EMPTY && !emptyIsAFloor(kind));
  assert.ok(covered.length >= 15, `only ${covered.length} kinds have a declared empty — this asserts little`);
  for (const kind of covered) {
    assert.equal(valueIsPresent(kind, MDY_CANONICAL_EMPTY[kind]), false,
      `${kind}: the value every fixture mounts as empty reads as present. Two statements of one rule `
      + "have drifted, and the one a renderer reads is not the one the checks mount");
  }
});

test("and what they call filled, it calls present", () => {
  // The perimeter. Without it a rule that answered `false` for everything would pass the first half,
  // and a part under `valueIsPresent` would simply never be drawn.
  const covered = MDY_WIDGET_KINDS.filter((kind) => kind in MDY_CANONICAL_FILLED && kind !== "file");
  assert.ok(covered.length >= 14, `only ${covered.length} kinds have a declared filled value`);
  for (const kind of covered) {
    assert.equal(valueIsPresent(kind, MDY_CANONICAL_FILLED[kind]), true,
      `${kind}: the value every fixture mounts as filled reads as absent`);
  }
});

test("absent is the negation of present, and nothing else", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    for (const value of [null, undefined, "", [], "x", ["x"], 0, false, true]) {
      assert.equal(valueIsAbsent(kind, value), !valueIsPresent(kind, value),
        `${kind}: the two answers disagree about ${JSON.stringify(value)}, so a placeholder and the `
        + "part it replaces can be on the page together");
    }
  }
});

test("no kind declares a part under a condition whose shape the rule cannot decide", () => {
  // The branch `valueIsPresent` refuses to guess: a non-nullable numeric kind's empty is where its
  // control starts, and this function is not handed a floor. Nothing may declare a part under the
  // condition while that is true — and if something does, this fails rather than the rule quietly
  // answering `true` for a slider sitting at its minimum.
  const floors = MDY_WIDGET_KINDS.filter(emptyIsAFloor);
  assert.ok(floors.length > 0, "no kind's empty is a floor, so the branch below is unreachable and this asserts nothing");
  for (const kind of floors) {
    const asks = MDY_WIDGET_CONTRACTS[kind].structure.nodes
      .filter((node) => node.presentWhen === "valueIsPresent" || node.presentWhen === "valueIsAbsent");
    assert.deepEqual(asks.map((node) => node.part), [],
      `${kind} declares a part under a value-presence condition, and its empty is a floor this rule `
      + "is not given. Either the rule takes the floor or the part takes another condition");
  }
});

test("the other six answer the state a widget publishes", () => {
  assert.equal(undoIsOnOffer({ wayBack: null }), false);
  assert.equal(undoIsOnOffer({ wayBack: { optionKey: "a" } }), true);
  assert.equal(undoIsOnOffer({}), false, "a widget with no undo at all offers none");

  assert.equal(viewIsActive({ viewMode: "days" }, "days"), true);
  assert.equal(viewIsActive({ viewMode: "months" }, "days"), false);

  assert.equal(inputWasRefused({ rejected: [] }), false);
  assert.equal(inputWasRefused({ rejected: [{}] }), true);
  assert.equal(inputWasRefused({}), false, "a kind that refuses nothing has refused nothing");

  // Two facts, one question: a spinner shown for one reason is shown for both.
  assert.equal(workIsInFlight({ pending: false, loading: false }), false);
  assert.equal(workIsInFlight({ pending: true }), true);
  assert.equal(workIsInFlight({ loading: true }), true);

  assert.equal(fieldIsRequired({ required: true, interactivity: "enabled" }), true);
  assert.equal(fieldIsRequired({ required: false, interactivity: "enabled" }), false);
  // The half that is not `handle.required()`: a marker on a field nobody can fill in asks for
  // something that cannot be given, and still reads as a demand.
  assert.equal(fieldIsRequired({ required: true, interactivity: "disabled" }), false);
  assert.equal(fieldIsRequired({ required: true, interactivity: "readonly" }), false);
});

test("the table now names a resolver for each of them", () => {
  for (const condition of ["valueIsPresent", "valueIsAbsent", "fieldIsRequired", "undoIsOnOffer",
    "viewIsActive", "inputWasRefused", "workIsInFlight"]) {
    assert.notEqual(MDY_PRESENCE_RESOLUTION[condition].resolver, null,
      `${condition} is answered by a published function and the table still calls it owed`);
    assert.equal(MDY_PRESENCE_RESOLUTION[condition].because, "answered");
  }
});
