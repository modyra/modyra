/**
 * What a Lit popup does while the page scrolls under it.
 *
 * This adapter used to come through `anchorOverlay`'s `lock` door: it pinned the side the popup
 * opened on and re-measured the height every frame, so a popup near the bottom of the window shrank
 * as you scrolled and its content went behind a scrollbar. Plain and Angular come through `current`,
 * which holds the shape and changes side only once the side has genuinely stopped fitting.
 *
 * These assert the policy from this adapter's own state, because "all three adapters agree" is a
 * claim about three call sites and the widgets suite can only prove the function they call.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { computeOverlayPanelState } = await import("../dist/components/popup-styles.js");

/**
 * jsdom does no layout, so the document element reports a 0×0 viewport and every popup is decided
 * against nothing. The size is stated here, once, so these tests measure the policy rather than an
 * absent layout engine.
 */
const VIEWPORT = { width: 1000, height: 800 };
for (const [name, value] of [["clientWidth", VIEWPORT.width], ["clientHeight", VIEWPORT.height]]) {
  Object.defineProperty(document.documentElement, name, { value, configurable: true });
}

/** A control 400px wide, wherever the page has scrolled it to. */
function anchorAt(top) {
  const rect = { top, bottom: top + 36, left: 100, right: 500, width: 400, height: 36, x: 100, y: top };
  const element = document.createElement("div");
  element.getBoundingClientRect = () => rect;
  return element;
}

const viewportHeight = () => VIEWPORT.height;

test("a Lit popup keeps the size it opened with while its anchor scrolls", () => {
  const opened = computeOverlayPanelState(anchorAt(200), { minSpace: 180 });
  assert.equal(opened.position, "below");

  // Scrolled down until the room below is narrower than the popup, but still over the minimum.
  const scrolled = computeOverlayPanelState(anchorAt(viewportHeight() - 260), {
    minSpace: 180,
    current: opened.decision,
  });
  assert.equal(scrolled.position, "below", "the popup must not flip while the side still fits");
  assert.equal(
    scrolled.cssVars.maxHeight,
    opened.cssVars.maxHeight,
    "nor shrink: content the user could read must not disappear because the page moved",
  );
});

test("it does flip once the side it opened on has stopped fitting", () => {
  const opened = computeOverlayPanelState(anchorAt(200), { minSpace: 180 });
  const noRoom = computeOverlayPanelState(anchorAt(viewportHeight() - 60), {
    minSpace: 180,
    current: opened.decision,
  });
  assert.notEqual(noRoom.position, "below");
});

test("opening decides afresh, and holds nothing from the last time it was open", () => {
  const nearTheBottom = computeOverlayPanelState(anchorAt(viewportHeight() - 60), { minSpace: 180 });
  assert.equal(nearTheBottom.position, "above");
  // No `current`: this is what the controller passes when it opens or the window resizes.
  const nearTheTop = computeOverlayPanelState(anchorAt(100), { minSpace: 180 });
  assert.equal(nearTheTop.position, "below");
});

test("the state carries the whole decision, which is what makes holding it possible", () => {
  // Position and alignment alone cannot be handed back: the height is the part that used to be
  // re-measured, and it is the part that was going missing.
  const { decision } = computeOverlayPanelState(anchorAt(200), { minSpace: 180 });
  assert.equal(typeof decision?.maxHeight, "number");
  assert.equal(decision?.placement, "below");
  // Nothing measured yet is nothing to hold, rather than a decision made up on the spot.
  assert.equal(computeOverlayPanelState(undefined).decision, null);
});
