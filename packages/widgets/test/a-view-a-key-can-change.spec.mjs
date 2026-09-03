/**
 * A calendar's other views can be reached from a keyboard.
 *
 * The months and years views are opened by two buttons drawn in the calendar's header, and until
 * this binding existed **no key declared a change of view at all**: every intent the kind declares
 * while open — the four arrows, `PageUp`/`PageDown`, `Home`, `End` — moves *within* the view being
 * shown. So the act behind those buttons was operable with a pointer and with nothing else, which is
 * the species ADR 0198 names, not the affordance its month arrows are.
 *
 * **The gesture is the platform's accelerator, and that is what makes it available.** Every bare
 * arrow is spent walking the grid. A bare binding refuses a press with the accelerator held, and one
 * declared `primary` answers only when it is held, so the two cannot collide — asserted below in
 * both directions rather than argued, because a collision here would silently eat a movement of the
 * calendar.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD, keyBindingFor, widgetKeyIntent } from "../dist/index.js";

const press = (key, held = {}) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...held });

/** The kinds that draw a months and a years view, which is what a view change needs somewhere to go. */
const WITH_VIEWS = Object.keys(MDY_WIDGET_CONTRACTS).filter(
  (kind) => ["monthPicker", "yearPicker"].every((part) => part in MDY_WIDGET_CONTRACTS[kind].parts),
);

test("the binding is declared exactly where the views are, and derived rather than listed", () => {
  assert.ok(WITH_VIEWS.length > 0, "no kind declares the two views, so this test measured nothing");
  for (const kind of Object.keys(MDY_WIDGET_KEYBOARD)) {
    const declared = MDY_WIDGET_KEYBOARD[kind].filter((one) => one.intent === "view");
    const expected = WITH_VIEWS.includes(kind) ? 2 : 0;
    assert.equal(
      declared.length,
      expected,
      `${kind} declares ${declared.length} view bindings and draws ${WITH_VIEWS.includes(kind) ? "" : "no "}alternate views`,
    );
  }
});

test("a kind that walks a grid but has nowhere else to go does not get the key", () => {
  // The predicate reads the views and not the grid, and this is the difference between the two: a
  // month is something to walk, a months view is somewhere to go, and only the second is what this
  // key is for. Both these kinds walk a grid.
  for (const kind of ["timepicker", "colors"]) {
    assert.equal(
      MDY_WIDGET_KEYBOARD[kind].filter((one) => one.intent === "view").length,
      0,
      `${kind} was given a key for views it does not draw`,
    );
  }
});

for (const kind of WITH_VIEWS) {
  test(`${kind}: the accelerator changes the view and answers on both platforms`, () => {
    for (const held of [{ ctrlKey: true }, { metaKey: true }]) {
      assert.deepEqual(widgetKeyIntent(kind, press("ArrowUp", held), true), { type: "view", by: 1 }, "out to the wider view");
      assert.deepEqual(widgetKeyIntent(kind, press("ArrowDown", held), true), { type: "view", by: -1 }, "back in to the narrower one");
    }
  });

  test(`${kind}: the bare arrows still walk the grid, and neither gesture answers the other`, () => {
    // The collision this pair was chosen to avoid, asserted in both directions. One direction alone
    // would pass with the bindings swapped.
    assert.equal(keyBindingFor(kind, press("ArrowUp"), true)?.intent, "move", "the bare arrow stopped walking the grid");
    assert.equal(keyBindingFor(kind, press("ArrowDown"), true)?.intent, "move", "the bare arrow stopped walking the grid");
    assert.equal(keyBindingFor(kind, press("ArrowUp", { ctrlKey: true }), true)?.intent, "view", "the held arrow fell through to the bare declaration");
    assert.equal(widgetKeyIntent(kind, press("ArrowUp"), true)?.type, "move", "a bare press was answered as a view change");
  });

  test(`${kind}: the accelerator is the whole gesture — Shift or Alt on top is not it`, () => {
    // `primary` means the accelerator alone. A press carrying more is a different gesture, and
    // answering it would claim keys this kind never declared.
    for (const held of [{ ctrlKey: true, shiftKey: true }, { ctrlKey: true, altKey: true }]) {
      assert.equal(keyBindingFor(kind, press("ArrowUp", held), true), null, "a press with more than the accelerator was answered");
    }
  });

  test(`${kind}: the view change is only offered while the calendar is showing`, () => {
    assert.equal(keyBindingFor(kind, press("ArrowUp", { ctrlKey: true }), false), null, "a closed field offered to change a view nobody can see");
  });
}
