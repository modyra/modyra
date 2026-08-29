/**
 * A field's focus scope is the control and the panel it opened, wherever that panel is drawn.
 *
 * Where a popup lives in the document is a rendering decision, taken so a list is not clipped by a
 * scrolling ancestor. A renderer that answers "has focus left this field" with `contains` says yes
 * the moment the keyboard enters a panel drawn elsewhere, and a renderer that draws its panel in
 * place says no — one contract, two behaviours, decided by where a `<div>` was appended.
 *
 * So the scope follows the link the opener declares. ADR 0167.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { focusIsInsideField } from "../dist/index.js";

/** A field whose panel is portalled to the end of the document, as three renderers draw it. */
function pageWithAPortalledPanel() {
  const dom = new JSDOM(`<!doctype html><body>
    <div id="field">
      <button id="opener" aria-controls="panel" aria-expanded="true">Open</button>
    </div>
    <div id="elsewhere"><span id="stranger">not this field</span></div>
    <div id="panel"><input id="search"></div>
  </body>`);
  const q = (id) => dom.window.document.getElementById(id);
  return { field: q("field"), opener: q("opener"), search: q("search"), stranger: q("stranger"), panel: q("panel") };
}

test("the panel the opener names belongs to the field, though it is drawn outside it", () => {
  const page = pageWithAPortalledPanel();
  assert.equal(page.field.contains(page.search), false,
    "the fixture stopped portalling the panel, so it no longer poses the question");
  assert.equal(focusIsInsideField(page.field, page.search), true);
  assert.equal(focusIsInsideField(page.field, page.panel), true);
});

test("the control itself is inside, and a stranger is not", () => {
  const page = pageWithAPortalledPanel();
  assert.equal(focusIsInsideField(page.field, page.opener), true);
  assert.equal(focusIsInsideField(page.field, page.stranger), false);
});

/**
 * Focus going nowhere is not a leaving, and is deliberately the caller's question: re-rendering an
 * element removes whatever was focused and blurs it into nowhere — a calendar cell replaced when the
 * view changes — and reading that as somebody walking out closed the popup on the click operating it.
 */
test("focus that went nowhere is not inside, and is not a leaving either", () => {
  const page = pageWithAPortalledPanel();
  assert.equal(focusIsInsideField(page.field, null), false);
});

test("a panel named by an opener that is not this field's is not this field's", () => {
  const page = pageWithAPortalledPanel();
  // The other field, asking about the same page: its own scope does not swallow the neighbour's
  // panel just because the panel is a sibling of them both.
  const other = page.stranger.parentElement;
  assert.equal(focusIsInsideField(other, page.search), false);
});
