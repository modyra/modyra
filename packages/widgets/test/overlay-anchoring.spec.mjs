/**
 * The anchoring contract. Every adapter measures an anchor and applies what these properties say,
 * so the rules a popup follows are asserted once, here, rather than three times in three renderers.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { anchorOverlay, MDY_WIDGET_CONTRACTS, MDY_OVERLAY_PORTAL_CLASS, MDY_POPUP_CLASS } from "../dist/index.js";

const VIEWPORT = { width: 1000, height: 800 };
/** A control in the middle of the page, with room on both sides. */
const anchor = (over = {}) => ({ top: 300, bottom: 336, left: 100, right: 500, width: 400, ...over });

test("a popup sits under its anchor, aligned to the same edge, matching its width", () => {
  const { decision, properties } = anchorOverlay(anchor(), VIEWPORT, { matchAnchorWidth: true });
  assert.equal(decision.placement, "below");
  assert.equal(decision.alignment, "left");
  // 336 (anchor bottom) + 6 (gap): the popup clears the control rather than touching it.
  assert.equal(properties["--mdy-overlay-top"], "342px");
  assert.equal(properties["--mdy-overlay-bottom"], "auto");
  assert.equal(properties["--mdy-overlay-left"], "100px");
  assert.equal(properties["--mdy-overlay-width"], "400px");
});

test("a control near the bottom opens upwards, measured from the viewport", () => {
  const { decision, properties } = anchorOverlay(anchor({ top: 700, bottom: 736 }), VIEWPORT, {});
  assert.equal(decision.placement, "above");
  assert.equal(properties["--mdy-overlay-top"], "auto");
  // 800 (viewport) - 700 (anchor top) + 6 (gap).
  assert.equal(properties["--mdy-overlay-bottom"], "106px");
});

test("a control on the right half aligns the popup to its right edge", () => {
  const { decision, properties } = anchorOverlay(anchor({ left: 700, right: 950, width: 250 }), VIEWPORT, {});
  assert.equal(decision.alignment, "right");
  assert.equal(properties["--mdy-overlay-left"], "auto");
  assert.equal(properties["--mdy-overlay-right"], "50px");
});

test("with room on neither side the popup stops chasing the anchor and centres itself", () => {
  // Both sides below the 180px minimum: 118px above, 118px below.
  const squeezed = anchorOverlay(anchor({ top: 130, bottom: 170 }), { width: 1000, height: 300 }, {});
  assert.equal(squeezed.decision.placement, "overlay");
  assert.equal(squeezed.properties["--mdy-overlay-top"], "50%");
  assert.equal(squeezed.properties["--mdy-overlay-left"], "50%");
  assert.equal(squeezed.properties["--mdy-overlay-transform"], "translate(-50%, -50%)");
});

test("the height offered is the space that side actually has", () => {
  const below = anchorOverlay(anchor(), VIEWPORT, {});
  // 800 - 336 - 12 (viewport margin), less the gap the popup leaves against its anchor.
  assert.equal(below.properties["--mdy-overlay-max-height"], "446px");
});

test("an open popup keeps the side and height it opened with while its anchor moves", () => {
  const opened = anchorOverlay(anchor(), VIEWPORT, {});
  assert.equal(opened.decision.placement, "below");

  // The page scrolls: the anchor moves down, but the side it opened on still fits.
  const scrolled = anchorOverlay(anchor({ top: 524, bottom: 560 }), VIEWPORT, { current: opened.decision });
  assert.equal(scrolled.decision.placement, "below", "an open popup must not flip under the pointer");
  assert.equal(scrolled.decision.maxHeight, opened.decision.maxHeight, "nor resize as the page moves");
  // Coordinates still follow the anchor — that is what keeps it attached.
  assert.equal(scrolled.properties["--mdy-overlay-top"], "566px");
});

test("a side that has genuinely stopped fitting is re-decided", () => {
  const opened = anchorOverlay(anchor(), VIEWPORT, {});
  const noRoom = anchorOverlay(anchor({ top: 780, bottom: 796 }), VIEWPORT, { current: opened.decision });
  assert.notEqual(noRoom.decision.placement, "below");
});

test("a lock keeps the corner but re-measures the height", () => {
  const locked = anchorOverlay(anchor({ top: 600, bottom: 636 }), VIEWPORT, {
    lock: { placement: "below", alignment: "left" },
  });
  assert.equal(locked.decision.placement, "below");
  assert.equal(locked.decision.alignment, "left");
  // Measured for this position, not inherited: a frozen height is how popups end up off-screen.
  // 152px of real space, raised to the 180px floor the policy guarantees, less the 6px gap.
  assert.equal(locked.properties["--mdy-overlay-max-height"], "174px");
});

test("the pointer decides the alignment when one is given", () => {
  const centred = anchor();
  assert.equal(anchorOverlay(centred, VIEWPORT, { pointerX: 900 }).decision.alignment, "right");
  assert.equal(anchorOverlay(centred, VIEWPORT, { pointerX: 20 }).decision.alignment, "left");
});

test("a content-sized popup is not given a width", () => {
  const { properties } = anchorOverlay(anchor(), VIEWPORT, {});
  assert.equal("--mdy-overlay-width" in properties, false);
});

test("every widget with an overlay says how its popup attaches", () => {
  for (const definition of Object.values(MDY_WIDGET_CONTRACTS)) {
    if (!definition.capabilities.overlay) {
      assert.equal(definition.capabilities.anchoring, undefined, `${definition.kind} has no overlay to anchor`);
      continue;
    }
    const anchoring = definition.capabilities.anchoring;
    assert.ok(anchoring, `${definition.kind} must declare its anchoring`);
    assert.equal(typeof anchoring.matchAnchorWidth, "boolean");
    assert.ok(anchoring.minSpace > 0);
    // And its popup must carry the shared container class, so it is the same container as the rest.
    assert.ok(
      definition.parts.popup.classes.includes(MDY_POPUP_CLASS),
      `${definition.kind}'s popup must carry ${MDY_POPUP_CLASS}`,
    );
  }
});

test("a list matches its control's width; a calendar is sized by its content", () => {
  assert.equal(MDY_WIDGET_CONTRACTS.select.capabilities.anchoring.matchAnchorWidth, true);
  assert.equal(MDY_WIDGET_CONTRACTS.multiselect.capabilities.anchoring.matchAnchorWidth, true);
  assert.equal(MDY_WIDGET_CONTRACTS.datepicker.capabilities.anchoring.matchAnchorWidth, false);
  assert.equal(MDY_OVERLAY_PORTAL_CLASS, "mdy-overlay");
});
