import assert from "node:assert/strict";
import test from "node:test";
import { dateValueTransition, dateWithinBounds, decideOverlayPlacement, multiselectOverlayAction, multiselectValueTransition, optionNavigationIndex, overlayCloseCommands, selectKeyboardAction, shouldCloseMultiselectOverlay, widgetKeyIntent } from "../dist/index.js";

test("overlay placement resolves collision without a DOM dependency", () => {
  assert.equal(decideOverlayPlacement({ viewportWidth: 1000, viewportHeight: 800, anchorTop: 700, anchorBottom: 740, anchorLeft: 800, anchorRight: 900, anchorWidth: 100, minSpace: 128, minWidth: 250, preferred: "below" }).placement, "above");
  assert.deepEqual(decideOverlayPlacement({ viewportWidth: 320, viewportHeight: 240, anchorTop: 100, anchorBottom: 140, anchorLeft: 40, anchorRight: 280, anchorWidth: 240, minSpace: 128, minWidth: 250, preferred: "below" }), { placement: "overlay", alignment: "left", maxHeight: 168, width: 250 });
});
test("keyboard mapping owns navigation, commit, cancel and primitive toggles", () => {
  assert.deepEqual(widgetKeyIntent("select", "ArrowDown", false), { type: "move", target: "next" });
  assert.deepEqual(widgetKeyIntent("select", "Escape", true), { type: "cancel", restoreFocus: true });
  assert.deepEqual(widgetKeyIntent("toggle", " ", false), { type: "toggle" });
  assert.deepEqual(overlayCloseCommands(true), [{ type: "close-overlay" }, { type: "restore-focus", target: { part: "trigger" } }]);
});

test("option navigation resolves roving indices in Widgets", () => {
  assert.equal(optionNavigationIndex("ArrowRight", 2, 3), 0);
  assert.equal(optionNavigationIndex("ArrowLeft", 0, 3), 2);
  assert.equal(optionNavigationIndex("Home", 2, 3), 0);
  assert.equal(optionNavigationIndex("End", 0, 3), 2);
  assert.equal(optionNavigationIndex("Enter", 0, 3), null);
});

test("select keyboard policy resolves host actions without Angular", () => {
  assert.deepEqual(selectKeyboardAction({ key: "ArrowDown", open: false, searchFocused: false, activeKey: null, createAvailable: false }), { type: "move", target: "next" });
  assert.deepEqual(selectKeyboardAction({ key: "Enter", open: false, searchFocused: false, activeKey: null, createAvailable: false }), { type: "open" });
  assert.deepEqual(selectKeyboardAction({ key: "Enter", open: true, searchFocused: false, activeKey: "it", createAvailable: false }), { type: "select", optionKey: "it" });
  assert.deepEqual(selectKeyboardAction({ key: "Enter", open: true, searchFocused: true, activeKey: null, createAvailable: true }), { type: "create" });
  assert.deepEqual(selectKeyboardAction({ key: "Escape", open: true, searchFocused: false, activeKey: null, createAvailable: false }), { type: "close", restoreFocus: true });
});

test("multiselect transitions own loose toggle, counters and clear", () => {
  assert.deepEqual(multiselectValueTransition([1], { type: "toggle", value: "1" }), []);
  assert.deepEqual(multiselectValueTransition(["a"], { type: "increment", value: "a" }), ["a", "a"]);
  assert.deepEqual(multiselectValueTransition(["a", "a"], { type: "decrement", value: "a" }), ["a"]);
  assert.deepEqual(multiselectValueTransition(["a"], { type: "clear" }), []);
});

test("multiselect overlay policy owns keyboard and close decisions", () => {
  assert.deepEqual(multiselectOverlayAction({ key: "Enter", open: false, query: "", activeKey: null }), { type: "open" });
  assert.deepEqual(multiselectOverlayAction({ key: "ArrowDown", open: true, query: "", activeKey: null }), { type: "move", target: "next" });
  assert.deepEqual(multiselectOverlayAction({ key: "Enter", open: true, query: "a", activeKey: "a" }), { type: "select", optionKey: "a" });
  assert.deepEqual(multiselectOverlayAction({ key: "Escape", open: true, query: "a", activeKey: null }), { type: "close", restoreFocus: true });
  assert.equal(shouldCloseMultiselectOverlay("single", 0), true);
  assert.equal(shouldCloseMultiselectOverlay("single", 1), false);
  assert.equal(shouldCloseMultiselectOverlay("multi", 0), false);
});

test("date value policy canonicalizes selections and rejects bounds violations", () => {
  assert.equal(dateWithinBounds("2026-07-27", "2026-01-01", "2026-12-31"), true);
  assert.equal(dateWithinBounds("2025-12-31", "2026-01-01", null), false);
  assert.equal(dateValueTransition({ type: "select", iso: "2026-07-27T12:00:00Z" }, "2026-01-01", "2026-12-31"), "2026-07-27");
  assert.equal(dateValueTransition({ type: "select", iso: "2027-01-01" }, null, "2026-12-31"), null);
  assert.equal(dateValueTransition({ type: "clear" }), null);
});
