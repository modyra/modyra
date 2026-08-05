/**
 * Finding a part from the contract, including the two ways it can find the wrong one.
 *
 * `findPartElement` is what lets a conformance harness stop hardcoding where a part lives. It is
 * also the thing an external implementer's config leans on, so the cases below are the ones that
 * produced a *wrong element* rather than none — a lookup that returns another widget's node is worse
 * than one that returns nothing, because the suite then reports a defect in the wrong renderer.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "../../plain/test/support/dom-env.mjs";

installDomGlobals();
const { findPartElement, partSelector } = await import("../dist/testing/index.js");

/** A field root with the classes a kind's parts declare, built by hand so the DOM is the fixture. */
function html(markup) {
  const host = document.createElement("div");
  host.innerHTML = markup;
  document.body.append(host);
  return host;
}

test("a part is found by the classes the contract declares", () => {
  const host = html(`<div class="mdy-input-wrapper"><span class="mdy-label">L</span></div>`);
  assert.equal(findPartElement(host, "text", "label"), host.querySelector(".mdy-label"));
  assert.equal(partSelector("text", "label"), ".mdy-label");
  host.remove();
});

test("a part with no declared class is found by its declared semantic element", () => {
  // A text field's `control` is a bare <input>: nothing to select on, and the anatomy says `input`.
  assert.equal(partSelector("text", "control"), null);
  const host = html(`<div class="mdy-input-wrapper"><input /></div>`);
  assert.equal(findPartElement(host, "text", "control"), host.querySelector("input"));
  host.remove();
});

test("the semantic fallback declines when it would have to guess", () => {
  // Two inputs and no class to tell them apart: answering would be picking one.
  const host = html(`<div class="mdy-input-wrapper"><input /><input /></div>`);
  assert.equal(findPartElement(host, "text", "control"), null);
  host.remove();
});

test("a part outside the root is not taken from another widget", () => {
  // The trap this had twice. `suffix` is not inside any popup, so the portal roots must not be
  // consulted for it — a sibling field's suffix is not this field's.
  const mine = html(`<div class="mdy-input-wrapper"><input /></div>`);
  const theirs = html(`<div class="mdy-input-wrapper"><span class="mdy-input-suffix">.com</span></div>`);
  assert.equal(
    findPartElement(mine, "text", "suffix", { portalRoots: [document.body] }),
    null,
    "a suffix belonging to another field was returned as this one's",
  );
  mine.remove();
  theirs.remove();
});

test("a portalled part is reached through the relation, not by scanning", () => {
  // Two datepickers, both portalling a popup to the body, both using the same classes. Only
  // `aria-controls` distinguishes them — which is why the lookup follows it instead of searching.
  //
  // The relation is the contract's, not this test's guess: `MDY_POPUP_OPENERS.datepicker` says the
  // opener is the typeable `control` and that it controls the `grid`. Writing it on the toggle, as
  // the first version of this test did, describes a widget the contract does not declare.
  const first = html(`<div class="mdy-input-wrapper"><input class="mdy-datepicker__input" aria-controls="g1" /></div>`);
  const second = html(`<div class="mdy-input-wrapper"><input class="mdy-datepicker__input" aria-controls="g2" /></div>`);
  const popups = html(
    `<div class="mdy-datepicker__popup mdy-popup mdy-popup--surface"><div class="mdy-datepicker__grid" id="g1"></div><div class="mdy-datepicker__actions">A1</div></div>`
    + `<div class="mdy-datepicker__popup mdy-popup mdy-popup--surface"><div class="mdy-datepicker__grid" id="g2"></div><div class="mdy-datepicker__actions">A2</div></div>`,
  );

  const found = findPartElement(first, "datepicker", "actions", { portalRoots: [document.body] });
  assert.ok(found, "the portalled part was not found at all");
  assert.equal(found.textContent, "A1", "the other datepicker's actions were returned");

  const other = findPartElement(second, "datepicker", "actions", { portalRoots: [document.body] });
  assert.equal(other?.textContent, "A2");

  first.remove(); second.remove(); popups.remove();
});

test("a closed widget's portalled part is absent, not another's", () => {
  // No `aria-controls`, so nothing identifies a popup — and a popup belonging to someone else is
  // still on the page.
  const closed = html(`<div class="mdy-input-wrapper"><input class="mdy-datepicker__input" /></div>`);
  const strays = html(`<div class="mdy-datepicker__popup mdy-popup mdy-popup--surface"><div class="mdy-datepicker__grid" id="gx"></div><div class="mdy-datepicker__actions">A</div></div>`);
  assert.equal(findPartElement(closed, "datepicker", "actions", { portalRoots: [document.body] }), null);
  closed.remove(); strays.remove();
});
