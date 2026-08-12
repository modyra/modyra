/**
 * A drag ends where the pointer ends, not where it started.
 *
 * The gesture leaves the element on the first move, so it is tracked on the document — which is
 * exactly why every renderer wrote this itself and why two of them wrote it identically. These are
 * the checks on the plumbing: what comes off, what stays on, and the one detail that is not
 * cosmetic — a non-passive `touchmove`, because a dial that cannot prevent the default scrolls the
 * page under the finger instead of turning.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { createPointerDrag, dragPointOf } from "../dist/index.js";

/** A document that records what was bound to it, since no DOM exposes its own listener registry. */
function recordingDocument() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const doc = dom.window.document;
  const bound = new Map();
  const realAdd = doc.addEventListener.bind(doc);
  const realRemove = doc.removeEventListener.bind(doc);
  doc.addEventListener = (type, fn, options) => {
    bound.set(type, { fn, options });
    realAdd(type, fn, options);
  };
  doc.removeEventListener = (type, fn) => {
    bound.delete(type);
    realRemove(type, fn);
  };
  return { doc, window: dom.window, bound };
}

test("nothing is bound until the drag starts, and nothing is left after it ends", () => {
  const { doc, window, bound } = recordingDocument();
  const drag = createPointerDrag({ onMove: () => {}, document: doc });

  assert.equal(bound.size, 0, "a drag that has not started is already listening");
  drag.start();
  assert.ok(bound.size > 0, "a started drag bound nothing");
  assert.equal(drag.dragging, true);

  doc.dispatchEvent(new window.MouseEvent("mouseup"));
  assert.equal(bound.size, 0, "the drag ended and left listeners on the document");
  assert.equal(drag.dragging, false);
});

test("touchmove is bound non-passive, or the page scrolls instead of the dial turning", () => {
  const { doc, bound } = recordingDocument();
  createPointerDrag({ onMove: () => {}, document: doc }).start();
  assert.deepEqual(bound.get("touchmove")?.options, { passive: false });
});

test("moves are reported while live and not after", () => {
  const { doc, window, bound } = recordingDocument();
  const seen = [];
  const drag = createPointerDrag({ onMove: (point) => seen.push(point.clientX), document: doc });

  drag.start();
  doc.dispatchEvent(new window.MouseEvent("mousemove", { clientX: 10, clientY: 0 }));
  doc.dispatchEvent(new window.MouseEvent("mousemove", { clientX: 20, clientY: 0 }));
  assert.deepEqual(seen, [10, 20]);

  drag.stop();
  assert.equal(bound.size, 0);
  doc.dispatchEvent(new window.MouseEvent("mousemove", { clientX: 30, clientY: 0 }));
  assert.deepEqual(seen, [10, 20], "a stopped drag still reported a move");
});

test("starting twice does not bind twice, and stopping twice is not an error", () => {
  const { doc, bound } = recordingDocument();
  const drag = createPointerDrag({ onMove: () => {}, document: doc });
  drag.start();
  const afterFirst = bound.size;
  drag.start();
  assert.equal(bound.size, afterFirst, "a second start double-bound the document");
  drag.stop();
  assert.doesNotThrow(() => drag.stop());
  assert.equal(bound.size, 0);
});

test("the end is announced once, before the listeners come off", () => {
  const { doc, window, bound } = recordingDocument();
  let boundAtEnd = null;
  let ends = 0;
  const drag = createPointerDrag({
    onMove: () => {},
    onEnd: () => { ends += 1; boundAtEnd = bound.size; },
    document: doc,
  });
  drag.start();
  doc.dispatchEvent(new window.MouseEvent("mouseup"));
  doc.dispatchEvent(new window.MouseEvent("mouseup"));
  assert.equal(ends, 1, "the end fired more than once");
  assert.ok(boundAtEnd > 0, "the listeners were gone before the widget was told");
});

test("a touch with no touches left is not a position", () => {
  // The last `touchend` carries an empty list. Read as a point it is (0, 0) — the top-left corner —
  // and a dial would jump there on release.
  assert.equal(dragPointOf({ touches: [] }), null);
  assert.deepEqual(dragPointOf({ touches: [{ clientX: 3, clientY: 4 }] }), { clientX: 3, clientY: 4 });
  assert.deepEqual(dragPointOf({ clientX: 7, clientY: 8 }), { clientX: 7, clientY: 8 });
});
