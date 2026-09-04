/**
 * A panel that has moved wears one answer about where it is, not two.
 *
 * Placing an overlay ends in four writes: the coordinates as custom properties, the placement as
 * data, the stale placement classes off, and the new ones on. Written per renderer, the third one is
 * the one that goes missing — nothing looks wrong when a panel opens, and the defect appears only
 * after it flips, as a panel wearing `--above` and `--right` from where it used to be while sitting
 * below and left. Which class the theme then honours is whichever the stylesheet mentions last.
 *
 * So the four writes are one door, and this is what makes the third one a property rather than a
 * habit: the same panel is placed twice, in two different places, and asked what it is wearing.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { applyAnchoredOverlay, popupAlignmentClass, popupPlacementClass } from "../dist/index.js";

const KIND = "select";

/** An anchoring answer, as `anchorOverlay` shapes one. */
const decided = (placement, alignment) => ({
  placement,
  decision: { placement, alignment },
  properties: { "--mdy-overlay-top": "10px" },
});

const panelIn = () => {
  const dom = new JSDOM("<!doctype html><body><div id='panel' class='mdy-select__popup'></div></body>");
  return { dom, panel: dom.window.document.getElementById("panel") };
};

test("the class from where it was comes off when it moves", () => {
  const { panel } = panelIn();
  const above = popupPlacementClass(KIND, "above");
  const right = popupAlignmentClass(KIND, "right");
  assert.ok(above && right, "this kind names no class for either, so the test has nothing to watch");

  applyAnchoredOverlay(panel, KIND, decided("above", "right"));
  assert.equal(panel.classList.contains(above), true);
  assert.equal(panel.classList.contains(right), true);
  assert.equal(panel.dataset.placement, "above");

  // Below and left are the ordinary cases and wear no class of their own, so what this asserts is
  // that the previous answer was taken off rather than added to.
  applyAnchoredOverlay(panel, KIND, decided("below", "left"));
  assert.equal(panel.classList.contains(above), false, "the panel still says it is above");
  assert.equal(panel.classList.contains(right), false, "the panel still says it hangs right");
  assert.equal(panel.dataset.placement, "below");
});

test("the coordinates the decision carries are written", () => {
  const { panel } = panelIn();
  applyAnchoredOverlay(panel, KIND, decided("below", "left"));
  assert.equal(panel.style.getPropertyValue("--mdy-overlay-top"), "10px");
});

test("a panel keeps the classes that are not about where it is", () => {
  const { panel } = panelIn();
  applyAnchoredOverlay(panel, KIND, decided("above", "right"));
  // The part's own class is not a placement, and a door that cleared by shape would take it too.
  assert.equal(panel.classList.contains("mdy-select__popup"), true);
});
