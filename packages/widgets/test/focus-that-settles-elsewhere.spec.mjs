/**
 * Where focus landed decides whether a widget is still the one being used.
 *
 * Every kind with a popup declares `dismissOnFocusOutside`, and the rule was written out in each
 * renderer that honoured it — which is why one of four did. This is the rule itself.
 *
 * **Arrival, not departure.** A departure names nowhere, and a panel that repaints destroys the
 * element holding focus and fires one: bound that way, a calendar swapping its grid for its months
 * closes itself.
 *
 * **The panel is inside the widget wherever it is drawn.** The opener names it, so a renderer that
 * portals its panel out of the field does not stop owning it — and a rule written as `contains` on
 * the field would shut the panel the moment somebody reached the thing they opened it for.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { MDY_WIDGET_CONTRACTS, bindDismissOnFocusOutside } from "../dist/index.js";

/** A field, its panel drawn elsewhere in the document, and another field to move to. */
const page = () => {
  const dom = new JSDOM(`<!doctype html><body>
    <div id="field"><button id="trigger" aria-controls="panel" aria-expanded="true">Open</button></div>
    <div id="panel"><input id="inside"></div>
    <div id="other"><input id="elsewhere"></div>
  </body>`);
  const q = (id) => dom.window.document.getElementById(id);
  // `focus()` alone: this environment fires `focusin` for it, and dispatching one as well made every
  // arrival count twice — a bench that then reads "one close" as a failure of the rule rather than
  // of its own arithmetic.
  const focus = (id) => q(id).focus();
  return { dom, q, focus };
};

/** A kind that declares it, taken from the catalogue rather than named here. */
const DECLARING = Object.keys(MDY_WIDGET_CONTRACTS)
  .find((kind) => MDY_WIDGET_CONTRACTS[kind].capabilities.dismissOnFocusOutside === true);

test("a kind that declares it is closed when focus lands outside", () => {
  assert.ok(DECLARING, "no kind declares this, so there is nothing to bind");
  const { q, focus, dom } = page();
  let closed = 0;
  const stop = bindDismissOnFocusOutside(
    DECLARING, () => [q("field")], () => true, () => { closed += 1; }, { document: dom.window.document },
  );

  focus("elsewhere");
  assert.equal(closed, 1, "the keyboard is in another field and the panel was left open behind it");
  stop();
});

test("reaching into the panel it opened is not leaving", () => {
  const { q, focus, dom } = page();
  let closed = 0;
  const stop = bindDismissOnFocusOutside(
    DECLARING, () => [q("field")], () => true, () => { closed += 1; }, { document: dom.window.document },
  );

  focus("inside");
  assert.equal(closed, 0, "the panel is drawn outside the field, and reaching it was read as leaving");
  stop();
});

test("a shut widget answers nothing", () => {
  const { q, focus, dom } = page();
  let closed = 0;
  const stop = bindDismissOnFocusOutside(
    DECLARING, () => [q("field")], () => false, () => { closed += 1; }, { document: dom.window.document },
  );

  // The listener is on the document and hears every focus move on the page. Without this, every
  // field with a panel dispatches a close on every one of them, and six closes landing on one
  // gesture fight over where focus ends up.
  focus("elsewhere");
  assert.equal(closed, 0, "a widget that was not open closed itself");
  stop();
});

test("a kind that does not declare it is given no listener", () => {
  const abstaining = Object.keys(MDY_WIDGET_CONTRACTS)
    .find((kind) => MDY_WIDGET_CONTRACTS[kind].capabilities.dismissOnFocusOutside !== true);
  assert.ok(abstaining, "every kind declares this, so this test has nothing to say");

  const { q, focus, dom } = page();
  let closed = 0;
  const stop = bindDismissOnFocusOutside(
    abstaining, () => [q("field")], () => true, () => { closed += 1; }, { document: dom.window.document },
  );
  focus("elsewhere");
  assert.equal(closed, 0, `${abstaining} declares no focus dismissal and was closed anyway`);
  stop();
});

test("unbinding stops it listening", () => {
  const { q, focus, dom } = page();
  let closed = 0;
  const stop = bindDismissOnFocusOutside(
    DECLARING, () => [q("field")], () => true, () => { closed += 1; }, { document: dom.window.document },
  );
  stop();
  focus("elsewhere");
  assert.equal(closed, 0, "it closed after it had been let go");
});
