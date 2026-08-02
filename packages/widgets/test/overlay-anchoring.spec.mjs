/**
 * The anchoring contract. Every adapter measures an anchor and applies what these properties say,
 * so the rules a popup follows are asserted once, here, rather than three times in three renderers.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { anchorOverlay, decideOverlayPlacement, overlayAnchoringFor, overlayStyleProperties, partClasses, popupAlignmentClass, popupPlacementClass, stabilizeOverlayPlacement, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, MDY_OVERLAY_PORTAL_CLASS, MDY_POPUP_CLASS } from "../dist/index.js";

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

/* ── The policy itself ────────────────────────────────────────────────────────────────────────
 * `stabilizeOverlayPlacement` is what every adapter's popup does on scroll, and until now it was
 * only ever reached through `anchorOverlay`'s `current:` door. The tests below call it directly,
 * because the three facts its docstring claims — the shape is held, `fits` is not, and a modal is
 * not un-modalled — are each a separate branch and none of them was asserted.
 */

/** The same control the anchoring tests use, as the geometry the policy is given. */
const geometry = (over = {}) => ({
  viewportWidth: 1000,
  viewportHeight: 800,
  anchorTop: 300,
  anchorBottom: 336,
  anchorLeft: 100,
  anchorRight: 500,
  anchorWidth: 400,
  minSpace: 180,
  minWidth: 160,
  preferred: "below",
  ...over,
});

test("the shape is the decision taken when it opened, not the one this frame would take", () => {
  const opened = decideOverlayPlacement(geometry());
  // The page scrolls 200px: 252px of room left below, still over the 180px minimum.
  const now = geometry({ anchorTop: 500, anchorBottom: 536 });
  const measured = decideOverlayPlacement(now);
  const held = stabilizeOverlayPlacement(opened, measured, now);

  assert.equal(held.placement, "below");
  assert.equal(held.alignment, opened.alignment);
  assert.equal(held.maxHeight, 452, "the height it opened with");
  // The point of the whole function: this frame would have said something else.
  assert.equal(measured.maxHeight, 252);
});

test("the height is held but whether the content still shows whole is not", () => {
  // A 400px popup plus the 6px gap it leaves: it fits the 452px it opened into.
  const opening = geometry({ desiredHeight: 406 });
  const opened = decideOverlayPlacement(opening);
  assert.equal(opened.fits, true);

  // Scrolled until 188px is left — over the minimum, so the side is kept, but the popup is cut.
  const now = geometry({ anchorTop: 564, anchorBottom: 600, desiredHeight: 406 });
  const held = stabilizeOverlayPlacement(opened, decideOverlayPlacement(now), now);
  assert.equal(held.placement, "below", "the shape is held");
  assert.equal(held.maxHeight, 452, "and so is the height");
  assert.equal(held.fits, false, "but it is reported as scrolling, because it now does");
});

test("a modal popup is not un-modalled by room appearing around an anchor it stopped chasing", () => {
  // It went modal because neither side held it; the room rule must not now drag it back onto a
  // side, because the placement it is holding is the one that ignores the anchor.
  const cramped = geometry({ viewportHeight: 240, anchorTop: 100, anchorBottom: 140 });
  const opened = decideOverlayPlacement(cramped);
  assert.equal(opened.placement, "overlay");

  const held = stabilizeOverlayPlacement(opened, decideOverlayPlacement(geometry()), geometry());
  assert.equal(held.placement, "overlay");
  assert.equal(held.maxHeight, opened.maxHeight);
});

test("the width follows the anchor even while the shape is held", () => {
  // The control can be re-laid-out under an open popup — a column widening, a font arriving. The
  // width is the one thing taken from this frame, because a list narrower than its own control
  // reads as broken in a way a held height does not.
  const opened = decideOverlayPlacement(geometry());
  const now = geometry({ anchorRight: 700, anchorWidth: 600 });
  const held = stabilizeOverlayPlacement(opened, decideOverlayPlacement(now), now);
  assert.equal(held.width, 600);
  assert.equal(opened.width, 400);
});

test("nothing held is what opening means", () => {
  const measured = decideOverlayPlacement(geometry());
  assert.deepEqual(stabilizeOverlayPlacement(null, measured, geometry()), measured);
});

test("current and lock are two policies, and the difference is measurable", () => {
  // The same popup, the same scroll, the two doors an adapter can come through. `current` holds
  // the box and lets the side change when it must; `lock` pins the side and lets the box shrink —
  // which is content disappearing rather than a popup moving.
  const opened = anchorOverlay(anchor(), VIEWPORT, { contentHeight: 400 });
  const scrolledTo = anchor({ top: 564, bottom: 600 });

  const stabilized = anchorOverlay(scrolledTo, VIEWPORT, { contentHeight: 400, current: opened.decision });
  const locked = anchorOverlay(scrolledTo, VIEWPORT, {
    contentHeight: 400,
    lock: { placement: opened.decision.placement, alignment: opened.decision.alignment },
  });

  assert.equal(stabilized.decision.placement, locked.decision.placement, "both keep the side");
  assert.equal(stabilized.decision.maxHeight, 452, "current keeps the popup the size it was");
  assert.equal(locked.decision.maxHeight, 188, "lock shrinks it to the room left");
  // Both say the content no longer shows whole; only one of them acts on it by resizing.
  assert.equal(stabilized.decision.fits, false);
  assert.equal(locked.decision.fits, false);
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

/* ── Which corner it opens from ───────────────────────────────────────────────────────────────
 * A popup opens from the end of the control where its trigger is, and keeps doing so. What used
 * to decide this was the pointer against the middle of the *viewport*, which made the same
 * calendar open from the left corner on one form and the right corner on another.
 */

test("every widget with a popup says which edge it hangs from", () => {
  for (const definition of Object.values(MDY_WIDGET_CONTRACTS)) {
    if (!definition.capabilities.overlay) continue;
    assert.equal(
      definition.capabilities.anchoring.alignment,
      "right",
      `${definition.kind}'s trigger sits at the end of its control, so its popup hangs from that end`,
    );
  }
});

test("the declared edge decides, wherever the field sits and wherever it was clicked", () => {
  const declared = { alignment: "right", matchAnchorWidth: false, contentWidth: 320 };
  // Left of the page, right of the page, clicked at either end of the control: same corner.
  const left = anchorOverlay(anchor({ left: 40, right: 440 }), VIEWPORT, declared);
  const right = anchorOverlay(anchor({ left: 500, right: 900 }), VIEWPORT, declared);
  const clickedLeft = anchorOverlay(anchor(), VIEWPORT, { ...declared, pointerX: 110 });
  const clickedRight = anchorOverlay(anchor(), VIEWPORT, { ...declared, pointerX: 490 });
  for (const [name, anchored] of Object.entries({ left, right, clickedLeft, clickedRight })) {
    assert.equal(anchored.decision.alignment, "right", `${name} must open from the declared edge`);
    assert.equal(anchored.properties["--mdy-overlay-left"], "auto", `${name} must hang from the right edge`);
  }
});

test("without a declared edge, the pointer picks the half of the control it landed in", () => {
  // Not the half of the viewport: an anchor sitting entirely in the left half still opens from its
  // own right edge when that is where the pointer went.
  const control = anchor({ left: 100, right: 500 });
  assert.equal(anchorOverlay(control, VIEWPORT, { pointerX: 480 }).decision.alignment, "right");
  assert.equal(anchorOverlay(control, VIEWPORT, { pointerX: 120 }).decision.alignment, "left");
});

test("the anchoring an adapter reads is the anchoring the catalog declares, and carries the kind", () => {
  // The kind rides along so a renderer holding an anchoring can also name the placement state the
  // catalog declares for that widget's popup, without being told the kind a second time.
  assert.deepEqual(overlayAnchoringFor("datepicker"), {
    kind: "datepicker",
    matchAnchorWidth: false,
    minSpace: 240,
    alignment: "right",
  });
  assert.deepEqual(overlayAnchoringFor("select"), {
    kind: "select",
    matchAnchorWidth: true,
    minSpace: 180,
    minWidth: 160,
    alignment: "right",
  });
  // A widget with no popup has no anchoring, and asking for it is not an error.
  assert.deepEqual(overlayAnchoringFor("text"), {});
});

test("declaring anchoring and declaring a popup part go together, both ways", () => {
  // `overlayAnchoringFor` reports the kind as an `MdyPopupWidgetKind` on the strength of the
  // anchoring guard alone — TypeScript cannot narrow a key by a sibling's value, so the cast rests
  // on this. A widget that gains anchoring without a popup part (or the reverse) fails here rather
  // than at the call site, where it would ask `partClasses` for a part that does not exist.
  for (const kind of MDY_WIDGET_KINDS) {
    const hasAnchoring = Boolean(MDY_WIDGET_CONTRACTS[kind].capabilities.anchoring);
    const hasPopup = Object.hasOwn(MDY_WIDGET_CONTRACTS[kind].parts, "popup");
    assert.equal(hasAnchoring, hasPopup, `${kind}: anchoring=${hasAnchoring} but popup part=${hasPopup}`);
  }
});

test("every popup part can be asked for its placement states, and below carries none", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    if (!Object.hasOwn(MDY_WIDGET_CONTRACTS[kind].parts, "popup")) continue;
    const base = partClasses(kind, "popup")[0];
    // "below" is the ordinary case: the contract gives it no class, so a popup sitting below its
    // anchor is spelled exactly like a popup nobody has placed yet.
    assert.deepEqual(partClasses(kind, "popup"), MDY_WIDGET_CONTRACTS[kind].parts.popup.classes);
    for (const state of ["above", "overlay"]) {
      const applied = partClasses(kind, "popup", { [state]: true });
      assert.ok(
        applied.includes(`${base}--${state}`),
        `${kind}: popup must be able to report --${state} on ${base}`,
      );
    }
  }
});

/**
 * The two ways to read a placement must say the same thing.
 *
 * `anchorOverlay` returns the custom properties directly; `overlayStyleProperties` serialises the
 * coordinates for a host that carries them around instead. They are two projections of one
 * decision, and while the second omitted `transform`, `max-height` and `width`, a host on that path
 * had to complete the decision itself — which is how a modal came to be given a height the policy
 * never chose, and the same popup ended up a different size on one renderer than on the others.
 *
 * A projection that omits part of the decision is a projection each host completes differently.
 */
const coordsFrom = (properties, decision, rect) => {
  const px = (name) => {
    const raw = properties[name];
    return raw === undefined || raw === "auto" || raw === "unset" || raw.endsWith("%") ? undefined : Number.parseFloat(raw);
  };
  return {
    top: px("--mdy-overlay-top"), bottom: px("--mdy-overlay-bottom"),
    left: px("--mdy-overlay-left"), right: px("--mdy-overlay-right"),
    maxWidth: px("--mdy-overlay-max-width"), maxHeight: px("--mdy-overlay-max-height"),
    width: rect === undefined ? undefined : decision.width,
    placement: decision.placement,
  };
};

test("overlayStyleProperties agrees with anchorOverlay on every placement", () => {
  const cases = [
    ["below", anchor(), { matchAnchorWidth: true }],
    ["above", anchor({ top: 700, bottom: 736 }), { matchAnchorWidth: true }],
    // Neither side has room, so the popup gives up on its anchor and centres itself.
    ["overlay", anchor({ top: 380, bottom: 420 }), { matchAnchorWidth: true, minSpace: 400 }],
    ["content-sized", anchor(), { matchAnchorWidth: false, contentWidth: 300 }],
  ];
  for (const [name, rect, options] of cases) {
    const { decision, properties } = anchorOverlay(rect, VIEWPORT, options);
    const coords = coordsFrom(properties, decision, options.matchAnchorWidth ? rect : undefined);
    const projected = overlayStyleProperties(coords);
    for (const key of ["--mdy-overlay-top", "--mdy-overlay-bottom", "--mdy-overlay-left", "--mdy-overlay-right", "--mdy-overlay-transform", "--mdy-overlay-max-height"]) {
      assert.equal(
        projected[key], properties[key],
        `${name}: ${key} — anchorOverlay says ${properties[key]}, the coords projection says ${projected[key]}`,
      );
    }
  }
});

test("a modal keeps the policy's height, not a host's guess", () => {
  const { decision, properties } = anchorOverlay(anchor({ top: 380, bottom: 420 }), VIEWPORT, { minSpace: 400 });
  assert.equal(decision.placement, "overlay");
  // 70% of an 800px viewport. The number is the contract's; a host writing `80vh` here is the
  // defect this test exists to catch.
  assert.equal(properties["--mdy-overlay-max-height"], "560px");
  assert.equal(
    overlayStyleProperties(coordsFrom(properties, decision))["--mdy-overlay-max-height"],
    "560px",
  );
});

/**
 * A popup's placement class is the one the state *added*, not the first class shaped like a modifier.
 *
 * The range picker's popup carries `mdy-datepicker__popup--range` in its resting class list — a
 * variant marker, not a placement — and matching by shape returned it for every placement the popup
 * was asked about. A range calendar opening above therefore reported a class that says nothing about
 * where it is, and the class the catalog declares for "above" was never emitted by anything.
 */
test("a popup that already carries a modifier still reports its real placement", () => {
  const resting = partClasses("daterange", "popup");
  assert.ok(
    resting.includes("mdy-datepicker__popup--range"),
    "precondition: the range popup carries a variant class at rest",
  );
  assert.equal(popupPlacementClass("daterange", "above"), "mdy-datepicker__popup--above");
  assert.equal(popupPlacementClass("daterange", "overlay"), "mdy-datepicker__popup--overlay");
  assert.equal(popupAlignmentClass("daterange", "right"), "mdy-datepicker__popup--right");
});

test("every popup kind derives all three placement states, and the ordinary cases carry none", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    if (!MDY_WIDGET_CONTRACTS[kind].parts.popup) continue;
    const base = partClasses(kind, "popup")[0];
    assert.equal(popupPlacementClass(kind, "above"), `${base}--above`, kind);
    assert.equal(popupPlacementClass(kind, "overlay"), `${base}--overlay`, kind);
    assert.equal(popupAlignmentClass(kind, "right"), `${base}--right`, kind);
    // Below and left are the ordinary cases: the contract gives them no class, so a popup in the
    // usual place is spelled exactly like one nobody has placed yet.
    assert.equal(popupPlacementClass(kind, "below"), null, kind);
    assert.equal(popupAlignmentClass(kind, "left"), null, kind);
  }
});
