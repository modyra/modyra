/**
 * What still works where a platform feature is missing.
 *
 * A feature below the declared floor is allowed only with a fallback, and a fallback stated in a
 * comment is a claim nobody has checked. These are the checks: each one removes the feature the way
 * an old browser lacks it — the property or the method simply is not there — and asserts what a
 * person is left with.
 *
 * The interesting assertion is never "it did not throw". It is that the control still shows, still
 * hides, and still reports which of the two it just did, because a renderer reflecting a popup's
 * state on every render is driven by that answer.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

import { setOverlayOpen } from "../dist/index.js";

/**
 * A document whose elements have no Popover API at all.
 *
 * jsdom does not implement it, which is what makes it the right stand-in here: this is the shape a
 * browser without popover support presents, rather than a mock of one.
 */
const withoutPopover = () => {
  const dom = new JSDOM("<div id='popup'>contenuto</div>");
  const popup = dom.window.document.getElementById("popup");
  assert.equal(typeof popup.showPopover, "undefined", "the premise of every check below");
  return popup;
};

test("a popup still opens and closes without the Popover API", () => {
  const popup = withoutPopover();

  setOverlayOpen(popup, true);
  assert.equal(popup.hidden, false, "shown by `hidden` alone, which every browser has");

  setOverlayOpen(popup, false);
  assert.equal(popup.hidden, true);
});

test("without the Popover API a popup still reports the moment it changed", () => {
  const popup = withoutPopover();

  // The first call initialises: a fresh element is neither open nor hidden, and reporting a
  // transition there would tell a renderer the popup had just closed.
  assert.equal(setOverlayOpen(popup, false), false);
  assert.equal(setOverlayOpen(popup, true), true, "opened");
  assert.equal(setOverlayOpen(popup, true), false, "already open: nothing changed");
  assert.equal(setOverlayOpen(popup, false), true, "closed");
});

test("a popup whose showPopover throws is left showing rather than taken down", () => {
  const popup = withoutPopover();
  // The other way the call fails in a real browser: the API exists and refuses — already showing,
  // or disconnected from the document.
  popup.showPopover = () => { throw new Error("InvalidStateError"); };
  popup.hidePopover = () => { throw new Error("InvalidStateError"); };

  assert.doesNotThrow(() => setOverlayOpen(popup, true));
  assert.equal(popup.hidden, false, "a refusal from the platform must not close the field's popup");
});
