import assert from "node:assert/strict";
import test from "node:test";
import { decideOverlayPlacement, optionNavigationIndex, overlayCloseCommands, widgetKeyIntent } from "../dist/index.js";

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
