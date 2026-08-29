/**
 * Two facts decide whether a part is owed, and reading one of them is how a checker gets a confident
 * wrong answer.
 *
 * **Whether the question applies** is a capability the document asked for before the widget existed;
 * **whether the condition holds** is a state the widget is in. A reader who takes only the second
 * owes a reorder grip to every multiselect holding a value — a rule all three renderers correctly
 * disobey, which is the shape where the adapters agree against the declaration and the declaration
 * is the thing that is wrong to read that way.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MDY_WIDGET_CONTRACTS, partIsOwed } from "../dist/index.js";

const nodeFor = (kind, part) =>
  MDY_WIDGET_CONTRACTS[kind].structure.nodes.find((one) => one.part === part);

const always = { holds: () => true, offers: () => true };

test("a gated part is not owed where the capability was never asked for", () => {
  const grip = nodeFor("multiselect", "chipMove");
  assert.ok(grip, "the reorder grip left the contract; this check is about it");
  assert.equal(grip.requires, "reorderable", "the gate is what this check is about");

  assert.equal(partIsOwed(grip, always), true, "with reordering asked for and a value held, it is owed");
  assert.equal(
    partIsOwed(grip, { holds: () => true, offers: () => false }),
    false,
    "a multiselect nobody asked to be reorderable owes no grip, whatever it holds",
  );
});

test("the condition still decides once the gate is open", () => {
  const grip = nodeFor("multiselect", "chipMove");
  assert.equal(partIsOwed(grip, { holds: () => false, offers: () => true }), false);
});

test("a part the contract requires is owed without asking anything", () => {
  const trigger = nodeFor("multiselect", "trigger");
  assert.equal(trigger.optional, false, "the fixture picked an optional part; it means to pick a required one");
  assert.equal(partIsOwed(trigger, { holds: () => false, offers: () => false }), true);
});

test("optional with no condition owes nothing", () => {
  // A renderer may draw it or not, and a checker demanding it is inventing a rule. Searched across
  // the whole catalogue rather than one kind: the day every optional part carries a condition this
  // has no subject, and saying so is better than passing against a part that happens to exist.
  const free = Object.values(MDY_WIDGET_CONTRACTS)
    .flatMap((definition) => definition.structure.nodes)
    .find((one) => one.optional === true && one.presentWhen === undefined);
  if (free === undefined) {
    assert.ok(true, "every optional part carries a condition — this rule has no subject today");
    return;
  }
  assert.equal(partIsOwed(free, always), false);
});

/**
 * A gate that belongs to one kind does not follow the part's name into another.
 *
 * The table is keyed by part name where a rule is the part's wherever it appears, and by `kind.part`
 * where it is one kind's. Written bare, `value: "searchable"` gave a slider's readout a capability
 * sliders do not have — a declaration true about one kind and false about another, which is worse
 * than a missing one because it reads as decided.
 */
test("a gate declared for one kind reaches that kind and no other", () => {
  assert.equal(nodeFor("multiselect", "chipMove").requires, "reorderable");
  // No other kind draws a reorder grip today; the property is that the key names the kind, so a part
  // of the same name arriving in another kind tomorrow inherits nothing.
  const elsewhere = Object.entries(MDY_WIDGET_CONTRACTS)
    .filter(([kind]) => kind !== "multiselect")
    .flatMap(([, definition]) => definition.structure.nodes)
    .filter((node) => node.part === "chipMove");
  assert.deepEqual(elsewhere.map((node) => node.requires), [],
    "another kind draws a reorder grip and inherited a gate declared for the multiselect");
  // A slider's readout is a part of the same name as a select's and shares nothing with it.
  assert.equal(nodeFor("slider", "value").requires, undefined);
  assert.equal(partIsOwed(nodeFor("slider", "value"), { holds: () => false, offers: () => false }), true);
});
