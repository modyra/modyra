/**
 * The gesture that reorders a strip: from the press that starts it to the index it lands on.
 *
 * Written out identically wherever a strip is drawn, down to the six pixels and the swallowed click.
 * Three details decide whether it works, and each was a detail every renderer had to get right alone:
 *
 * - **the threshold.** A drag may start anywhere on a chip, its own buttons included — they cover
 *   most of it, and a chip draggable only by its bare edges is a chip nobody can drag. Travel is what
 *   separates a press from a drag;
 * - **the swallowed click.** A press that began on a button and ended as a gesture still produces a
 *   click nobody asked for. Once, in the capture phase, and only after an actual drag;
 * - **no pointer capture.** Capturing retargets every later pointer event, the one that becomes a
 *   `click` included, so the chip's own buttons stop receiving clicks entirely.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "../../plain/test/support/dom-env.mjs";

installDomGlobals();
const { beginChipReorder, MDY_CHIP_DRAG_THRESHOLD } = await import("../dist/index.js");

function aStrip() {
  const strip = document.createElement("div");
  const chip = document.createElement("div");
  const button = document.createElement("button");
  chip.append(button);
  strip.append(chip);
  document.body.append(strip);
  return { strip, chip, button };
}

const press = (clientX, button = 0) => ({ button, clientX });

/**
 * A pointer event this host can make.
 *
 * No `PointerEvent` constructor here, and none is needed: the gesture reads one property off the
 * event, so a plain event carrying that property is the same subject. Building a richer one would be
 * building a fixture the code cannot tell from this.
 */
function at(type, clientX) {
  const event = new (document.defaultView?.Event ?? Event)(type, { bubbles: true });
  Object.defineProperty(event, "clientX", { value: clientX });
  return event;
}
const move = (clientX) => at("pointermove", clientX);
const up = (clientX) => at("pointerup", clientX);

function reorder(chip, { midpoints, from, onDrop }) {
  beginChipReorder(press(0), chip, { draggingClass: "dragging", midpoints: () => midpoints, from: () => from, onDrop });
}

test("a press that does not travel is the button's, not the strip's", () => {
  const { strip, chip } = aStrip();
  let dropped = null;
  reorder(chip, { midpoints: [10, 50, 90], from: 0, onDrop: (to) => { dropped = to; } });
  document.dispatchEvent(move(MDY_CHIP_DRAG_THRESHOLD - 1));
  // Read *during* the gesture. After it, the teardown has taken the class off either way, so a check
  // that only looks at the end cannot tell a press that was never a drag from one that was.
  assert.equal(chip.className, "",
    "a press that has not travelled far enough was already marked as a drag, so the chip's own "
    + "buttons are being dragged out from under the finger that meant to press them");
  document.dispatchEvent(up(MDY_CHIP_DRAG_THRESHOLD - 1));
  assert.equal(dropped, null,
    "a steady press reordered the strip. The chip's own buttons are underneath it, and a press that "
    + "stays put belongs to them");
  assert.equal(chip.className, "", "a press that never became a drag left the dragging class on");
  strip.remove();
});

test("a press that travels moves the chip and lands where the pointer let go", () => {
  const { strip, chip } = aStrip();
  let dropped = null;
  reorder(chip, { midpoints: [10, 50, 90], from: 0, onDrop: (to) => { dropped = to; } });
  document.dispatchEvent(move(95));
  assert.equal(chip.className, "dragging", "the chip is not marked while it is being dragged");
  document.dispatchEvent(up(95));
  assert.equal(dropped, 2, `landed at ${dropped} rather than the far end`);
  assert.equal(chip.className, "", "the dragging class outlived the drag");
  strip.remove();
});

test("landing where it started drops nothing", () => {
  const { strip, chip } = aStrip();
  let calls = 0;
  reorder(chip, { midpoints: [10, 50, 90], from: 1, onDrop: () => { calls += 1; } });
  document.dispatchEvent(move(50));
  document.dispatchEvent(up(50));
  assert.equal(calls, 0, "a chip dropped back where it started was announced as moved");
  strip.remove();
});

test("the click a drag produces is swallowed, and only after a drag", () => {
  const { strip, chip, button } = aStrip();
  let clicks = 0;
  button.addEventListener("click", () => { clicks += 1; });

  reorder(chip, { midpoints: [10, 90], from: 0, onDrop: () => {} });
  document.dispatchEvent(move(95));
  document.dispatchEvent(up(95));
  button.click();
  assert.equal(clicks, 0, "the click a drag produced reached the button under it");

  // Once only: the next real press on that button still works, which is what `once` is for.
  button.click();
  assert.equal(clicks, 1, "the swallow outlived its own gesture and ate a press somebody meant");
  strip.remove();
});

test("a press that is not the primary button is nobody's gesture", () => {
  const { strip, chip } = aStrip();
  let dropped = null;
  beginChipReorder(press(0, 2), chip, {
    draggingClass: "dragging", midpoints: () => [10, 90], from: () => 0, onDrop: (to) => { dropped = to; },
  });
  document.dispatchEvent(move(95));
  document.dispatchEvent(up(95));
  assert.equal(dropped, null, "a right-click began a drag");
  strip.remove();
});
