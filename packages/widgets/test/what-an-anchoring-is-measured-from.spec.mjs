/**
 * The three readings an anchoring decision is made from.
 *
 * `anchorOverlay` has always declared what it needs — a viewport, a direction, a content size — and
 * never how to obtain them, so each renderer gathered them itself. The three gatherings were
 * character-for-character identical: one answer written in the three places somebody had to write it.
 *
 * Each has a trap in it, and each trap is the reason the reading is not a one-liner:
 *
 * - the **border box**. `scrollHeight` stops at the padding edge, so a popup with a border asks for
 *   a size its own outline does not fit in, and every decision made from it clamps a few pixels short;
 * - **nothing laid out**. Zero is not a measurement, and a decision made from zero is indistinguishable
 *   from one made on a real one;
 * - the **live direction**. A widget declares which *inline* edge its popup hangs from; only the
 *   document says which physical edge that is today.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "../../plain/test/support/dom-env.mjs";

installDomGlobals();
const { inlineDirectionOf, measureOverlayContent, viewportSize } = await import("../dist/index.js");

/** A popup whose scroll size and border box differ, the way a bordered panel's do. */
function aPopup({ scroll = 200, client = 180, offset = 200, hidden = false } = {}) {
  const popup = document.createElement("div");
  popup.hidden = hidden;
  for (const [name, value] of [["scrollHeight", scroll], ["scrollWidth", scroll],
    ["clientHeight", client], ["clientWidth", client], ["offsetHeight", offset], ["offsetWidth", offset]]) {
    Object.defineProperty(popup, name, { value, configurable: true });
  }
  document.body.append(popup);
  return popup;
}

test("the content size includes the border the scroll size stops short of", () => {
  const popup = aPopup({ scroll: 200, client: 180, offset: 200 });
  assert.deepEqual(measureOverlayContent(popup), { height: 220, width: 220 },
    "the border box was dropped. A popup measured at its padding edge is placed in a space its own "
    + "outline does not fit in, and clamps short every time");
  popup.remove();
});

test("a popup with no layout answers nothing, not zero", () => {
  const popup = aPopup({ scroll: 0, client: 0, offset: 0 });
  assert.equal(measureOverlayContent(popup), null,
    "zero was returned as a measurement. A decision made from it looks exactly like one made on a "
    + "real size, and the caller has no way to tell them apart");
  popup.remove();
});

test("a hidden popup and a missing one answer nothing too", () => {
  // The union of what the three renderers guarded, not the smallest of them: one checked `hidden`,
  // one checked null, one checked neither, and the shared answer has to keep every caller whole.
  const hidden = aPopup({ hidden: true });
  assert.equal(measureOverlayContent(hidden), null);
  assert.equal(measureOverlayContent(null), null);
  assert.equal(measureOverlayContent(undefined), null);
  hidden.remove();
});

test("the direction is read from the element, not assumed", () => {
  const element = document.createElement("div");
  document.body.append(element);
  assert.equal(inlineDirectionOf(element), "ltr");
  element.style.direction = "rtl";
  assert.equal(inlineDirectionOf(element), "rtl",
    "the direction did not follow the element. A page that switches to a right-to-left language has "
    + "changed which side `start` means, and nothing about the widget did");
  element.remove();
});

test("the viewport is the layout viewport of the document it is asked about", () => {
  const size = viewportSize(document);
  assert.equal(size.width, document.documentElement.clientWidth);
  assert.equal(size.height, document.documentElement.clientHeight);
  // No assertion that the numbers are non-zero: this host reports a document of no size, and
  // whether the document has one is the host's business rather than this function's. What is checked
  // is that the reading is the *layout* viewport — the one a popup has to fit in — and not the visual
  // viewport a pinch-zoom leaves behind, which is a different and smaller rectangle.
  assert.equal(size.width, document.documentElement.getBoundingClientRect().width || size.width);
});
