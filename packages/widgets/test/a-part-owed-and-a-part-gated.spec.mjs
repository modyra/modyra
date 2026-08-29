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
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, partIsOwed, variantOf } from "../dist/index.js";

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

/**
 * A relation that belongs to one shape of a kind says so.
 *
 * A select drawn as the platform's chooser opens nothing this contract can see. A `<select>` carrying
 * `aria-expanded`, `aria-controls` or `aria-haspopup` claims to be a combobox — a lie about what it
 * is, and one no renderer can be told not to tell if the relation is declared for the kind as a
 * whole. ADR 0176 named this as the half nothing enforced.
 */
test("an opener relation names the shape it belongs to, or holds for every shape", () => {
  const select = MDY_POPUP_OPENERS.select;
  assert.ok(select, "the select declares no opener relation; this check is about it");
  assert.equal(select.variant, "custom",
    "the relation is declared for the kind as a whole, so a native <select> is owed combobox "
    + "attributes it must not carry");
  assert.ok(MDY_WIDGET_CONTRACTS.select.variants[select.variant],
    "the relation names a shape the kind does not declare, so nothing can act on it");

  // Every other kind has one shape, and a relation naming a variant there would be a promise about
  // an anatomy that does not exist.
  for (const [kind, relation] of Object.entries(MDY_POPUP_OPENERS)) {
    if (relation?.variant === undefined) continue;
    assert.ok(Object.keys(MDY_WIDGET_CONTRACTS[kind].variants).length > 0,
      `${kind}'s opener relation names a shape and the kind declares none`);
  }
});

/**
 * Which shape a document asks for, answered by the contract rather than by each reader.
 *
 * A kind with two anatomies is half declared while nothing says which one a given field selects. The
 * catalogue named the select's two shapes and published no way to ask, so a renderer drawing one and
 * ignoring the property violated nothing stated, and a checker had to hard-code the rule or guess.
 */
test("a document's own words say which shape a kind is drawn in", () => {
  // The select's axis is whether it filters. The default is the platform's chooser, which is the
  // control a plain list should be.
  assert.equal(variantOf("select", {}), "native");
  assert.equal(variantOf("select", { searchable: false }), "native");
  assert.equal(variantOf("select", { searchable: true }), "custom");

  // The multiselect's axis is its mode, and the name is the document's own value.
  assert.equal(variantOf("multiselect", {}), "single");
  assert.equal(variantOf("multiselect", { mode: "multi" }), "multi");

  // A kind with one anatomy has no shape to ask about.
  assert.equal(variantOf("text", { searchable: true }), undefined);

  // And every answer names a shape the kind actually declares, or it is a promise about nothing.
  for (const [kind, spec] of [["select", {}], ["select", { searchable: true }],
    ["multiselect", {}], ["multiselect", { mode: "multi" }]]) {
    const name = variantOf(kind, spec);
    assert.ok(MDY_WIDGET_CONTRACTS[kind].variants[name],
      `${kind} answers ${name} for ${JSON.stringify(spec)} and declares no such shape`);
  }
});

/**
 * The second door, declared so a renderer can be asked for it.
 *
 * A calendar button beside a typeable date, a clock beside a typed time, the box a multiselect's
 * chips sit in. All three renderers answer a press on these and none was asked to — the door worked
 * everywhere, nothing declared it, and a renderer could have lost it with every suite green. Three
 * implementations agreeing where the declaration is silent is evidence about the declaration.
 */
test("a second door names a part the kind declares, and never carries the relation", () => {
  let declared = 0;
  for (const [kind, relation] of Object.entries(MDY_POPUP_OPENERS)) {
    const second = relation?.alsoOpensFrom;
    if (second === undefined) continue;
    declared += 1;
    assert.ok(second in MDY_WIDGET_CONTRACTS[kind].parts,
      `${kind} opens from ${second} and declares no such part, so nothing can press it`);
    assert.notEqual(second, relation.opener,
      `${kind}'s second door is the first one, which says nothing`);
    // The relation stays on the part that holds the value. A second element carrying
    // `aria-expanded` announces two comboboxes for one list.
    assert.notEqual(second, relation.controls,
      `${kind} opens from the very thing it controls`);
  }
  assert.ok(declared >= 4, `only ${declared} kinds declare a second door; four answer one today`);
});
