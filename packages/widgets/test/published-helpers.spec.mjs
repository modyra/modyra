/**
 * Three helpers a renderer is expected to reach for, asked directly.
 *
 * Each was published for a renderer to use and had no check of its own: what they decide was only
 * ever observed through a widget that happened to call them, so a change of mind inside one of them
 * showed up as a widget behaving oddly rather than as a rule that had moved.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { chipStripWheelDelta, keepKeyboardInPlay, visibleErrorsOf } from "../dist/index.js";

test("a wheel over a strip that does not overflow scrolls nothing", () => {
  // The guard, and the reason the function exists at all: a strip whose chips fit has nowhere to
  // go, and a page that scrolled it anyway would swallow the wheel the document wanted.
  assert.equal(chipStripWheelDelta(0, 40, 300, 300), 0);
  assert.equal(chipStripWheelDelta(0, 40, 200, 300), 0);
});

test("the larger of the two axes is the one the strip follows", () => {
  // A trackpad reports both axes at once. A strip is horizontal, and a person swiping down over one
  // means the page — so the axis with the intent behind it is the one that decides, and its sign is
  // kept: a wheel back scrolls back.
  assert.equal(chipStripWheelDelta(12, 3, 900, 300), 12);
  assert.equal(chipStripWheelDelta(3, 12, 900, 300), 12);
  assert.equal(chipStripWheelDelta(-12, 3, 900, 300), -12);
  assert.equal(chipStripWheelDelta(0, -40, 900, 300), -40);
});

/** A field with a control between two others, in a document that can be asked about focus. */
function page() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const { document } = dom.window;
  globalThis.document = document;
  document.body.innerHTML = `
    <div class="mdy-renderer">
      <button class="before">before</button>
      <input class="leaving" />
      <button class="after">after</button>
    </div>
  `;
  const root = document.querySelector(".mdy-renderer");
  return { document, root, leaving: root.querySelector(".leaving"), after: root.querySelector(".after") };
}

test("a control that goes out of play under the keyboard hands it to the next one", () => {
  const p = page();
  p.leaving.focus();
  keepKeyboardInPlay(p.leaving, p.root);
  assert.equal(p.document.activeElement, p.after, "focus went somewhere other than the next control");
});

test("a control nobody was standing in does not pull the keyboard to itself", () => {
  const p = page();
  // Focus is nowhere and the caller did not say it had just been blurred, which is the ordinary
  // case: a field re-rendering while the person works somewhere else entirely.
  keepKeyboardInPlay(p.leaving, p.root);
  assert.equal(p.document.activeElement, p.document.body, "a widget nobody visited took the keyboard");
});

test("after the platform has already blurred it, nowhere is the case this repairs", () => {
  const p = page();
  keepKeyboardInPlay(p.leaving, p.root, { afterBlur: true });
  assert.equal(p.document.activeElement, p.after);
});

/** A handle stub shaped like the part of a field handle the verdict reads. */
const handle = (over) => ({
  disabled: () => false,
  touched: () => false,
  errors: () => [],
  ...over,
});

test("a rule nobody has answered yet is not news", () => {
  const untouched = handle({ errors: () => [{ kind: "required", message: "Required" }] });
  assert.deepEqual(visibleErrorsOf(untouched), [], "a field at rest showed an error");
});

test("the same rule is shown once the field has been visited", () => {
  const touched = handle({
    touched: () => true,
    errors: () => [{ kind: "required", message: "Required" }],
  });
  assert.deepEqual(visibleErrorsOf(touched).map((e) => e.message), ["Required"]);
});

test("out of play, no verdict", () => {
  const off = handle({
    disabled: () => true,
    touched: () => true,
    errors: () => [{ kind: "required", message: "Required" }],
  });
  assert.deepEqual(visibleErrorsOf(off), [], "a field the form is not asking about reported a failure");
});

test("what the field was handed speaks before anybody has touched it", () => {
  // A value the field was given rather than typed, and a rule it already breaks: nobody has been at
  // the control, and the sentence is still true about what it holds.
  const given = handle({
    value: () => "not-an-address",
    dirty: () => false,
    errors: () => [{ kind: "email", message: "Not an address", origin: "validation" }],
  });
  assert.deepEqual(given.errors().length && visibleErrorsOf(given).map((e) => e.message), ["Not an address"]);
});
