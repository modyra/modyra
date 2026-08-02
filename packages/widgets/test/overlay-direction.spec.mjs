/**
 * Which edge a popup hangs from when the field is laid out right-to-left.
 *
 * The distinction this suite exists to hold: **the widget's declared edge is inline, the viewport is
 * physical.** `overlayAnchoringFor(kind)` says the popup hangs from the end where the trigger sits —
 * the arrow, the calendar button — and in a right-to-left field that end is the left one. How much
 * room remains before the window's right edge is not an inline idea and must not mirror, or a popup
 * would helpfully place itself off the screen.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { anchorOverlay } from "../dist/index.js";

const VIEWPORT = { width: 1200, height: 900 };
/** A control comfortably inside the viewport, so nothing is forced by the edges. */
const anchor = { top: 300, bottom: 340, left: 500, right: 700, width: 200 };

const place = (options) => anchorOverlay(anchor, VIEWPORT, { minWidth: 160, ...options });

test("a declared edge mirrors under rtl", () => {
  const ltr = place({ alignment: "right" });
  const rtl = place({ alignment: "right", direction: "rtl" });
  assert.equal(ltr.decision.alignment, "right");
  assert.equal(rtl.decision.alignment, "left", "the same declared edge is the other side in rtl");
});

test("mirroring is symmetric", () => {
  assert.equal(place({ alignment: "left" }).decision.alignment, "left");
  assert.equal(place({ alignment: "left", direction: "rtl" }).decision.alignment, "right");
});

test("ltr is the default, so nothing changes for a field that never says", () => {
  assert.equal(
    place({ alignment: "right" }).decision.alignment,
    place({ alignment: "right", direction: "ltr" }).decision.alignment,
  );
});

test("the viewport does not mirror: a popup near the right edge still stays on screen", () => {
  // The half this contract must NOT flip. A wide popup on a control near the right edge is moved
  // bodily inside the window; mirroring that arithmetic would move it further out.
  const nearRight = { top: 300, bottom: 340, left: 1050, right: 1180, width: 130 };
  const placed = anchorOverlay(nearRight, VIEWPORT, {
    alignment: "left", direction: "rtl", contentWidth: 400, minWidth: 160,
  });
  const left = Number.parseInt(placed.properties["--mdy-overlay-left"] ?? "0", 10);
  const right = Number.parseInt(placed.properties["--mdy-overlay-right"] ?? "0", 10);
  const offScreen = (Number.isFinite(left) && left < 0) || (Number.isFinite(right) && right < 0);
  assert.equal(offScreen, false, "the popup must stay inside the viewport whatever the direction");
});

test("an undeclared alignment is left to the pointer and the anchor, in either direction", () => {
  // Where the user's hand was is a fact about the screen. A field with no declared edge takes the
  // same answer in both directions, because nothing inline was stated to mirror.
  const ltr = place({ pointerX: 520 });
  const rtl = place({ pointerX: 520, direction: "rtl" });
  assert.equal(ltr.decision.alignment, rtl.decision.alignment);
});
