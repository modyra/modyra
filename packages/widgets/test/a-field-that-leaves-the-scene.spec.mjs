/**
 * A field taken out of the document closes what it holds open, and leaves the keyboard somewhere.
 *
 * This is the third way an overlay closes, and until now nobody owned it. A controller closes on an
 * intention; a component destroys at end of life. A field removed by a rule the document carries is
 * neither — no intention arrives and nothing is destroyed — so an open panel stayed on a page whose
 * field was gone.
 *
 * Three renderers passed this without deciding anything, because they draw the panel inside the
 * field's subtree and whatever removes the field takes the panel too. ADR 0131 says where a renderer
 * puts its popup is not this project's decision, so that pass was a consequence of a free choice
 * rather than a guarantee. The bench below is the guarantee, stated where the choice cannot reach it:
 * **the panel is drawn outside the field**, which is the arrangement that had nothing holding it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { closeWhenFieldLeaves } from "../dist/index.js";

/** A field, a panel drawn elsewhere, and a neighbour for the keyboard to land on. */
const page = () => {
  const dom = new JSDOM(`<!doctype html><body>
    <form>
      <div id="field"><button id="trigger" aria-expanded="true" aria-controls="panel">Open</button></div>
      <div id="after"><input id="next"></div>
    </form>
    <div id="panel">a panel nobody put inside the field</div>
  </body>`);
  const q = (id) => dom.window.document.getElementById(id);
  return { dom, q };
};

test("the panel closes when the field leaves, wherever the panel was drawn", async () => {
  const { dom, q } = page();
  let closed = 0;
  const stop = closeWhenFieldLeaves(q("field"), { close: () => { closed += 1; } });

  assert.equal(closed, 0, "it closed something before the field had gone anywhere");
  q("field").remove();
  // The observer reports on a microtask, which is the earliest a removal can be seen at all.
  await new Promise((resolve) => dom.window.queueMicrotask(resolve));

  assert.equal(closed, 1, "the field left the document and what it held open was never closed");
  stop();
});

test("the keyboard lands on what follows, and only if it was in the field", async () => {
  const { dom, q } = page();
  const trigger = q("trigger");
  trigger.focus();
  assert.equal(dom.window.document.activeElement, trigger, "the keyboard was not in the field to begin with");

  const stop = closeWhenFieldLeaves(q("field"), { close: () => undefined });
  q("field").remove();
  await new Promise((resolve) => dom.window.queueMicrotask(resolve));
  assert.equal(
    dom.window.document.activeElement, q("next"),
    "the field left and took the person's place with it: their next Tab starts at the top of the document",
  );
  stop();
});

test("a field nobody was standing in takes nobody with it", async () => {
  const { dom, q } = page();
  const elsewhere = q("next");
  elsewhere.focus();

  const stop = closeWhenFieldLeaves(q("field"), { close: () => undefined });
  q("field").remove();
  await new Promise((resolve) => dom.window.queueMicrotask(resolve));
  assert.equal(
    dom.window.document.activeElement, elsewhere,
    "a field removed while nobody stood in it moved the keyboard anyway",
  );
  stop();
});

test("unbinding stops it watching", async () => {
  const { dom, q } = page();
  let closed = 0;
  const stop = closeWhenFieldLeaves(q("field"), { close: () => { closed += 1; } });
  stop();
  q("field").remove();
  await new Promise((resolve) => dom.window.queueMicrotask(resolve));
  assert.equal(closed, 0, "it closed after it had been let go");
});
