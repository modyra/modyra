/**
 * What `anchorOverlay` promises, checked over the whole space rather than at a few points.
 *
 * The rules for an overlay are short: it must be visible in full, and it must not have to scroll
 * when there is anywhere it could have fitted. Individual cases are asserted in
 * `overlay-anchoring.spec.mjs`; this file takes the box the properties actually describe — the same
 * arithmetic the browser does when it applies them — and asserts those two rules for every
 * combination of viewport, anchor position and content size below.
 *
 * A property that is only true of the examples someone thought to write down is not a contract, and
 * this is what makes the difference visible: an off-by-one in a coordinate, a max-height taken from
 * the wrong side, an alignment that hangs a popup over the edge all surface here as a box outside
 * the viewport, whichever geometry produced it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { anchorOverlay, MDY_OVERLAY_GAP, MDY_OVERLAY_VIEWPORT_MARGIN } from "../dist/index.js";

const VIEWPORTS = [
  { width: 1440, height: 900 }, // desktop
  { width: 1000, height: 800 },
  { width: 768, height: 1024 }, // tablet, portrait
  { width: 390, height: 844 }, // phone
  { width: 640, height: 360 }, // short: a landscape phone, where nothing has room
];

/**
 * Anchors down the viewport, at the edges and through the middle.
 *
 * The fractions matter: a control at 42% of the page has a few hundred pixels below it and a few
 * hundred more above, which is the band where the two rules disagree — enough room to open into,
 * not enough to show the popup whole. A grid of only edges and centres never lands there, and the
 * whole point of measuring the content is what happens in that band.
 */
function anchorsFor(viewport) {
  const anchors = [];
  const height = 40;
  const tops = [0, 0.08, 0.3, 0.42, 0.5, 0.58, 0.72, 0.9, 1]
    .map((fraction) => Math.min(Math.max(0, Math.round(viewport.height * fraction) - height / 2), viewport.height - height));
  for (const top of tops) {
    for (const [left, width] of [[0, 120], [8, 320], [Math.round(viewport.width / 2) - 60, 120], [viewport.width - 128, 120], [viewport.width - 60, 50]]) {
      if (left < 0 || left + width > viewport.width) continue;
      anchors.push({ top, bottom: top + height, left, right: left + width, width });
    }
  }
  return anchors;
}

const CONTENTS = [
  { height: 120, width: 200 }, // a short list
  { height: 320, width: 320 }, // a calendar
  { height: 560, width: 280 }, // a long list
  { height: 900, width: 640 }, // taller and wider than most viewports
];

/** The box the browser will lay out, given these properties and this content. */
function resolveBox(properties, viewport, content) {
  const number = (name) => {
    const raw = properties[name];
    return raw === undefined || raw === "auto" || raw.endsWith("%") ? null : Number.parseFloat(raw);
  };
  const maxHeight = number("--mdy-overlay-max-height") ?? Infinity;
  const maxWidth = number("--mdy-overlay-max-width") ?? Infinity;
  const width = Math.min(number("--mdy-overlay-width") ?? content.width, maxWidth);
  const height = Math.min(content.height, maxHeight);

  const top = number("--mdy-overlay-top");
  const bottom = number("--mdy-overlay-bottom");
  const left = number("--mdy-overlay-left");
  const right = number("--mdy-overlay-right");
  return {
    top: top ?? (bottom === null ? null : viewport.height - bottom - height),
    left: left ?? (right === null ? null : viewport.width - right - width),
    width,
    height,
  };
}

test("an anchored popup is laid out inside the viewport, whatever the geometry", () => {
  for (const viewport of VIEWPORTS) {
    for (const anchor of anchorsFor(viewport)) {
      for (const content of CONTENTS) {
        for (const matchAnchorWidth of [true, false]) {
          const { decision, properties } = anchorOverlay(anchor, viewport, {
            matchAnchorWidth,
            contentHeight: content.height,
            contentWidth: content.width,
          });
          // A modal placement is centred by a translation rather than by coordinates; what it
          // promises is that it does not exceed the viewport, which its two ceilings state.
          if (decision.placement === "overlay") {
            assert.ok(
              Number.parseFloat(properties["--mdy-overlay-max-height"]) <= viewport.height,
              "a modal popup may not be taller than the viewport",
            );
            assert.ok(
              Number.parseFloat(properties["--mdy-overlay-max-width"]) <= viewport.width - MDY_OVERLAY_VIEWPORT_MARGIN * 2,
              "a modal popup may not be wider than the viewport, less its margins",
            );
            continue;
          }

          const box = resolveBox(properties, viewport, content);
          const where = `${JSON.stringify({ viewport, anchor, content, matchAnchorWidth })}`;
          assert.ok(box.top !== null && box.left !== null, `both coordinates must be stated: ${where}`);
          assert.ok(box.top >= 0, `top ${box.top} is above the viewport: ${where}`);
          assert.ok(box.left >= 0, `left ${box.left} is left of the viewport: ${where}`);
          assert.ok(
            box.top + box.height <= viewport.height,
            `bottom ${box.top + box.height} is below the viewport (${viewport.height}): ${where}`,
          );
          assert.ok(
            box.left + box.width <= viewport.width,
            `right ${box.left + box.width} is past the viewport (${viewport.width}): ${where}`,
          );
        }
      }
    }
  }
});

test("a popup that could have fitted somewhere is not made to scroll", () => {
  for (const viewport of VIEWPORTS) {
    for (const anchor of anchorsFor(viewport)) {
      for (const content of CONTENTS) {
        const roomAbove = Math.max(0, anchor.top - MDY_OVERLAY_VIEWPORT_MARGIN);
        const roomBelow = Math.max(0, viewport.height - anchor.bottom - MDY_OVERLAY_VIEWPORT_MARGIN);
        const couldFit = Math.max(roomAbove, roomBelow) >= content.height + MDY_OVERLAY_GAP;
        const { decision, properties } = anchorOverlay(anchor, viewport, {
          contentHeight: content.height,
          contentWidth: content.width,
        });
        const where = `${JSON.stringify({ viewport, anchor, content })}`;
        if (!couldFit) continue;
        assert.equal(decision.fits, true, `a side had room for the whole popup: ${where}`);
        assert.ok(
          Number.parseFloat(properties["--mdy-overlay-max-height"]) >= content.height,
          `the popup is given less height than its content, so it scrolls: ${where}`,
        );
      }
    }
  }
});

test("a popup wide enough to fit somewhere is not squeezed either", () => {
  for (const viewport of VIEWPORTS) {
    for (const anchor of anchorsFor(viewport)) {
      for (const content of CONTENTS) {
        const spannable = viewport.width - MDY_OVERLAY_VIEWPORT_MARGIN * 2;
        if (content.width > spannable) continue; // nothing could hold it; the ceiling is the answer
        const { decision, properties } = anchorOverlay(anchor, viewport, {
          contentHeight: content.height,
          contentWidth: content.width,
        });
        if (decision.placement === "overlay") continue;
        assert.ok(
          Number.parseFloat(properties["--mdy-overlay-max-width"]) >= content.width,
          `the popup is given less width than its content: ${JSON.stringify({ viewport, anchor, content })}`,
        );
      }
    }
  }
});
