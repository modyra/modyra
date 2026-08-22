/**
 * The sentence that says how a control is operated, and where it comes from.
 *
 * It is derived from `MDY_WIDGET_KEYBOARD`, not written beside it: a phrase naming keys *is* a copy
 * of the key map, and a copy goes stale the moment a binding moves. These checks are about the
 * derivation — that it says what the table says, and stays quiet about what a person cannot do.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  MDY_I18N_MESSAGES_DEFAULT as messages,
  MDY_WIDGET_KEYBOARD,
  MDY_WIDGET_KINDS,
  widgetKeyGuide,
} from "../dist/index.js";

test("what a closed control says is how to open it", () => {
  const said = widgetKeyGuide("select", messages);
  assert.match(said, /Enter/);
  assert.match(said, /opens it/);
  // Not the open state's keys: a closed list is not walked, and a sentence holding both says
  // ArrowDown opens the list and moves through it at once.
  assert.doesNotMatch(said, /moves through it/);
});

test("what an open control says is how to move in it and how to leave", () => {
  const said = widgetKeyGuide("select", messages, { open: true });
  assert.match(said, /moves through it/);
  assert.match(said, /confirms/);
  assert.match(said, /closes it/);
  assert.doesNotMatch(said, /opens it/);
});

test("a key that needs a capability the field did not ask for is not offered", () => {
  const plain = widgetKeyGuide("multiselect", messages, { parts: ["chip"] });
  const asked = widgetKeyGuide("multiselect", messages, { parts: ["chip"], capabilities: ["reorderable"] });

  assert.doesNotMatch(plain, /picks one up/, "a legend offered a key this field does not answer");
  assert.match(asked, /picks one up/);
});

test("a key answered on a part the control did not draw is not offered", () => {
  const withChips = widgetKeyGuide("multiselect", messages, { parts: ["chip"] });
  const without = widgetKeyGuide("multiselect", messages, { parts: [] });

  assert.match(withChips, /takes one off/);
  assert.doesNotMatch(without, /takes one off/, "a legend named a chip's keys to a field with no chips");
  // The opener is always drawn: it is the control, and a control that is not drawn is not a control.
  assert.match(without, /opens it/);
});

test("a kind whose keys are the platform's says nothing", () => {
  // A text field answers no key this table declares — typing is not a binding — and a sentence
  // there would be words for the sake of having some.
  assert.equal(widgetKeyGuide("text", messages), "");
});

test("every kind's guide names only keys its table declares", () => {
  // The property that makes this derived rather than written: nothing appears in a sentence that is
  // not in the table it was read from.
  for (const kind of MDY_WIDGET_KINDS) {
    const declared = new Set(MDY_WIDGET_KEYBOARD[kind].map((binding) => binding.key));
    for (const state of [false, true]) {
      const said = widgetKeyGuide(kind, messages, { open: state, capabilities: ["reorderable"], parts: ["chip"] });
      for (const key of ["Enter", "Escape", "Tab", "Backspace", "Delete", "Home", "End", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
        if (said.includes(key)) {
          assert.ok(declared.has(key), `${kind} offers ${key}, which its table does not declare`);
        }
      }
      if (said.includes("Space")) assert.ok(declared.has(" "), `${kind} offers Space, which its table does not declare`);
    }
  }
});

test("the sentence follows the messages it was given", () => {
  // Every frame is a message, so a locale that translates them translates the legend — nothing here
  // writes English of its own.
  const shouted = widgetKeyGuide("checkbox", messages, {});
  const translated = widgetKeyGuide("checkbox", { ...messages, keyGuideToggle: "{keys} lo commuta", keyGuideSpace: "Spazio" }, {});
  assert.equal(shouted, "Space switches it");
  assert.equal(translated, "Spazio lo commuta");
});
