/**
 * The modules that had no spec, and what would go wrong without one.
 *
 * Sixteen root modules were published and never asserted. Most are tables, and a table looks like it
 * cannot break — until a part is renamed on one side of it, a widget stops declaring a state that a
 * theme still styles, or an id delimiter changes and every ARIA reference that carries it points at
 * nothing. Every check below is a relationship between two declarations that must not drift apart.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MDY_CANONICAL_UI_CLASSES,
  MDY_CSS_PROPERTY_NAMES,
  MDY_ID_DELIMITER,
  MDY_LABELABLE_TAGS,
  MDY_POPUP_OPENERS,
  MDY_SEMANTICS_REQUIRING_NAME,
  MDY_WIDGET_CONTRACTS,
  MDY_WIDGET_KINDS,
  MDY_WIDGET_RELATIONS,
  MDY_WIDGET_STATE_SUPPORT,
  browserRuntimeCapabilities,
  defaultWidgetIdFactory,
  isValidWidgetId,
  partClasses,
  partsRequiringName,
  ssrRuntimeCapabilities,
  stateClass,
  widgetSupportsState,
} from "../dist/index.js";

test("every kind the vocabulary names has a definition, and no definition names a kind it does not", () => {
  assert.deepEqual([...MDY_WIDGET_KINDS].sort(), Object.keys(MDY_WIDGET_CONTRACTS).sort());
});

test("every declared part carries a class a theme could target, or is explicitly structural", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    const definition = MDY_WIDGET_CONTRACTS[kind];
    for (const [name, part] of Object.entries(definition.parts)) {
      assert.ok(Array.isArray(part.classes), `${kind}.${name} declares no class list at all`);
    }
  }
});

test("the anatomy names only parts the kind declares", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    const definition = MDY_WIDGET_CONTRACTS[kind];
    const declared = new Set([...Object.keys(definition.parts), "root"]);
    for (const node of definition.structure.nodes) {
      assert.ok(declared.has(node.part), `${kind}: anatomy names "${node.part}", which is not a part`);
      if (node.parent) {
        assert.ok(declared.has(node.parent), `${kind}: "${node.part}" hangs off "${node.parent}", which is not a part`);
      }
    }
  }
});

test("a part that must be named is a part the kind actually declares", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    const declared = new Set([...Object.keys(MDY_WIDGET_CONTRACTS[kind].parts), "root"]);
    for (const part of partsRequiringName(kind)) {
      // A rule about a part nobody declares is a rule that is looked up forever and never fires.
      assert.ok(declared.has(part), `${kind}: "${part}" must be named and is not a part of this kind`);
    }
  }
  assert.ok(MDY_LABELABLE_TAGS.length > 0);
  assert.ok(MDY_SEMANTICS_REQUIRING_NAME.length > 0);
  // Keyed by kind, and every kind has a row: a widget with no relations declared is a widget whose
  // references nothing checks.
  assert.deepEqual(Object.keys(MDY_WIDGET_RELATIONS).sort(), [...MDY_WIDGET_KINDS].sort());
});

test("an opener names a part of the kind it opens, and something for it to control", () => {
  for (const [kind, opener] of Object.entries(MDY_POPUP_OPENERS)) {
    const declared = MDY_WIDGET_CONTRACTS[kind].parts;
    assert.ok(opener.opener in declared, `${kind}: the opener is "${opener.opener}", which is not a part`);
    // `aria-controls` has to point at something. An opener naming a part the kind does not declare
    // produces a reference to an element that will never exist.
    assert.ok(opener.controls in declared, `${kind}: the opener controls "${opener.controls}", which is not a part`);
    // A role only where the opener takes one: a daterange's toggle opens a dialog and is a button,
    // and giving it a combobox role would promise a listbox it does not have.
    if (opener.role !== undefined) assert.ok(opener.role.length > 0, `${kind}: the opener declares an empty role`);
  }
});

test("a widget claims a state only where the state exists", () => {
  const known = new Set(Object.keys(MDY_WIDGET_STATE_SUPPORT));
  for (const kind of MDY_WIDGET_KINDS) {
    assert.ok(known.has(kind), `${kind} is in no state-support row`);
    // The two answers must agree: one is the table, the other is what a consumer asks.
    for (const state of ["open", "disabled", "invalid"]) {
      const supported = MDY_WIDGET_STATE_SUPPORT[kind].includes(state);
      assert.equal(widgetSupportsState(kind, state), supported, `${kind}/${state}: the table and the question disagree`);
    }
  }
});

test("a class a part carries in a state is the class the state vocabulary builds", () => {
  const base = MDY_WIDGET_CONTRACTS.select.parts.trigger.classes[0];
  const built = partClasses("select", "trigger", { open: true });
  // A renderer spelling a modifier and a theme writing a rule for it agree only by coincidence
  // unless both derive it from here.
  assert.ok(built.includes(stateClass(base, "open")), `partClasses did not produce ${stateClass(base, "open")}`);
  assert.ok(!built.includes(stateClass(base, "disabled")), "a state that is off was painted anyway");
});

test("a part refuses a state it never declared", () => {
  // The set of classes a part may ever carry is finite and knowable, which is what lets a theme be
  // checked against it. Asking for one outside that set is a mistake, not a new class.
  assert.throws(() => partClasses("select", "trigger", { dragover: true }), /does not declare the state/);
});

test("an id is built from the delimiter every reference carries", () => {
  const id = defaultWidgetIdFactory.part("field", "label");
  assert.equal(id, `field${MDY_ID_DELIMITER}label`);
  assert.equal(isValidWidgetId("field"), true);
  // A name containing the delimiter collides with a generated one, and the browser is happy to hold
  // two elements with the same id — so `getElementById`, `label[for]` and every ARIA IDREF stop
  // being deterministic.
  assert.equal(isValidWidgetId(`a${MDY_ID_DELIMITER}label`), false);
});

test("with no document, a runtime claims nothing", () => {
  // Every capability false is the honest answer where there is no DOM, and a command executor that
  // believed otherwise would try to focus something that does not exist. This suite runs without a
  // document, so what `browserRuntimeCapabilities()` reports here is exactly the server's answer.
  const detected = browserRuntimeCapabilities();
  assert.deepEqual(detected, ssrRuntimeCapabilities);
  for (const [name, value] of Object.entries(ssrRuntimeCapabilities)) {
    assert.equal(value, false, `${name} was claimed with no document to provide it`);
  }
});

test("every custom property a theme reads is a custom property", () => {
  assert.ok(MDY_CSS_PROPERTY_NAMES.length > 0);
  for (const name of MDY_CSS_PROPERTY_NAMES) {
    // `--index` is deliberately unprefixed: it is the position a foundation places a dial number
    // from, written by the renderer and read by the stylesheet, and prefixing it would rename it in
    // one of the two places.
    assert.match(name, /^--/, `${name} is not a custom property at all`);
  }
});

test("the root's classes come from the states it is in, for every kind alike", async () => {
  const { fieldShellRootClasses } = await import("../dist/field/index.js");
  const quiet = fieldShellRootClasses({ disabled: false, touched: false });
  const failing = fieldShellRootClasses({ disabled: true, touched: true });
  // Every kind had this function and every copy was the same five lines over the same table.
  assert.ok(failing.length > quiet.length, "a root in more states carried no more classes");
  assert.ok(quiet.length > 0, "a root at rest carries no class at all");
});

test("the canonical class list is derived from the definitions, not kept beside them", () => {
  const fromDefinitions = new Set(MDY_WIDGET_KINDS.flatMap((kind) => MDY_WIDGET_CONTRACTS[kind].rootClasses));
  assert.deepEqual([...MDY_CANONICAL_UI_CLASSES].sort(), [...fromDefinitions].sort());
});
