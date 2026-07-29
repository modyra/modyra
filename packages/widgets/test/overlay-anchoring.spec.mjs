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

/* ── Fitting the content ──────────────────────────────────────────────────────────────────────
 * A popup is placed where it can be *read*: whole, without scrolling. That takes the popup's own
 * height as an input, so these cases all measure it — the ones above deliberately do not, and
 * assert the fallback that applies when nothing measured it.
 */

test("a popup goes where its content fits, not merely where there is room", () => {
  // 264px below, 288px above: both clear the 180px minimum, so the old rule kept the preferred
  // side and let a 280px popup scroll. It belongs above, where it shows whole.
  const tight = anchor({ top: 300, bottom: 524 });
  const measured = anchorOverlay(tight, VIEWPORT, { contentHeight: 280 });
  assert.equal(measured.decision.placement, "above");
  assert.equal(measured.decision.fits, true);

  // Same geometry, nothing measured: the minimum-space rule stands and the popup opens below.
  assert.equal(anchorOverlay(tight, VIEWPORT, {}).decision.placement, "below");
});

test("content that fits the preferred side stays on it", () => {
  const { decision } = anchorOverlay(anchor(), VIEWPORT, { contentHeight: 200 });
  assert.equal(decision.placement, "below");
  assert.equal(decision.fits, true);
});

test("when neither side holds the content, the roomier one takes it and says it scrolls", () => {
  // 100px above, 464px below, and a popup twice as tall as either.
  const { decision } = anchorOverlay(anchor({ top: 112, bottom: 324 }), VIEWPORT, { contentHeight: 900 });
  assert.equal(decision.placement, "below");
  assert.equal(decision.fits, false);
});

test("the popup's own height counts the gap it has to leave", () => {
  // 452px of room below the anchor (800 - 336 - 12), of which the popup may take 452 - 6: 446px
  // fits whole, 448px does not, and the boundary is the gap rather than the room.
  const fitting = anchorOverlay(anchor(), VIEWPORT, { contentHeight: 446 });
  assert.equal(fitting.decision.placement, "below");
  assert.equal(fitting.decision.fits, true);
  assert.equal(fitting.properties["--mdy-overlay-max-height"], "446px");
  assert.equal(anchorOverlay(anchor(), VIEWPORT, { contentHeight: 448 }).decision.fits, false);
});

test("an unmeasured popup is not reported as squeezed", () => {
  assert.equal(anchorOverlay(anchor(), VIEWPORT, {}).decision.fits, true);
});

/* ── Staying on the screen ────────────────────────────────────────────────────────────────── */

test("a popup too wide for either edge is pushed bodily back inside the viewport", () => {
  // A 330px calendar on a phone-width viewport: 238px of room hanging left from the anchor's right
  // edge, 148px hanging right from its left edge. Neither holds it, so instead of leaving it over
  // the edge the popup is moved inside and given the viewport, less its margins, to spread in.
  const phone = { width: 360, height: 800 };
  const control = { top: 300, bottom: 336, left: 200, right: 250, width: 50 };
  const { properties } = anchorOverlay(control, phone, { contentWidth: 330 });
  assert.equal(properties["--mdy-overlay-right"], "auto");
  const left = Number.parseFloat(properties["--mdy-overlay-left"]);
  assert.equal(left, 12);
  assert.ok(left + 330 <= phone.width - 12, `${left} + 330 must stay inside the viewport`);
  assert.equal(properties["--mdy-overlay-max-width"], "336px");
});

test("a measured popup hangs from the edge that has room for it", () => {
  // The anchor's centre is left of middle, so the popup would hang rightwards — but only 188px lie
  // that way and it wants 320, while 458px lie the other way. The edge it hangs from follows the
  // content, not the pointer.
  const narrow = { width: 500, height: 800 };
  const control = { top: 300, bottom: 336, left: 300, right: 470, width: 170 };
  const anchored = anchorOverlay(control, narrow, { contentWidth: 320 });
  assert.equal(anchored.decision.alignment, "right");
  assert.equal(anchored.properties["--mdy-overlay-right"], "30px");
  assert.equal(anchored.properties["--mdy-overlay-left"], "auto");
});

test("every placement states the widest the popup may be", () => {
  // Anchored: the room on the side it hangs from. Modal: the viewport, less its margins.
  const docked = anchorOverlay(anchor(), VIEWPORT, { matchAnchorWidth: true });
  assert.equal(docked.properties["--mdy-overlay-max-width"], "888px"); // 1000 - 100 - 12
  const modal = anchorOverlay(anchor({ top: 130, bottom: 170 }), { width: 1000, height: 300 }, {});
  assert.equal(modal.decision.placement, "overlay");
  assert.equal(modal.properties["--mdy-overlay-max-width"], "976px");
});

test("a popup keeps its measured shape while the anchor scrolls under it", () => {
  const opened = anchorOverlay(anchor(), VIEWPORT, { contentHeight: 200 });
  const scrolled = anchorOverlay(anchor({ top: 500, bottom: 536 }), VIEWPORT, {
    contentHeight: 200,
    current: opened.decision,
  });
  assert.equal(scrolled.decision.placement, "below");
  assert.equal(scrolled.decision.maxHeight, opened.decision.maxHeight);
  // 252px of room left for a 206px popup: still whole, and the coordinate follows the anchor.
  assert.equal(scrolled.decision.fits, true);
  assert.equal(scrolled.properties["--mdy-overlay-top"], "542px");
});
