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
const { beginChipReorder, chipDropIndex, MDY_CHIP_DRAG_THRESHOLD } = await import("../dist/index.js");

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

/**
 * Where a dragged chip lands, asked of the arithmetic rather than of a gesture.
 *
 * The drag above answers with a landing place; this is the rule underneath it, and it has three
 * properties a pointer test cannot isolate.
 *
 * The midpoints arrive in drawing order, so a strip whose text runs right to left hands them over
 * descending. Reading the direction from the numbers is what lets one rule serve both, and a
 * renderer that had to know which way its own text runs is a renderer that gets it wrong in one
 * language.
 */
test("a chip lands where the pointer passed a midpoint, in either direction", () => {
  const ltr = [10, 30, 50];
  assert.equal(chipDropIndex(ltr, 5, 0), 0, "before every midpoint is the first place");
  assert.equal(chipDropIndex(ltr, 100, 0), 2, "past every midpoint is the last place");
  assert.equal(chipDropIndex(ltr, 20, 2), 1,
    "a pointer that has passed one midpoint lands after one chip, and it answered otherwise");
  assert.equal(chipDropIndex(ltr, 5, 2), 0,
    "a chip dragged back past every midpoint did not land first");

  // The same strip drawn right to left: the midpoints descend, and the answers must not change.
  const rtl = [50, 30, 10];
  assert.equal(chipDropIndex(rtl, 100, 0), 0);
  assert.equal(chipDropIndex(rtl, 5, 0), 2,
    "the descending strip was read with the ascending comparison, so a right-to-left row drops "
    + "every chip at the wrong end");
});

test("a chip's own slot is not a place it can land on", () => {
  // Dragged rightwards, a chip passes its own midpoint on the way, which counts one place further
  // than the eye reads.
  assert.equal(chipDropIndex([10, 30, 50], 35, 0), 1,
    "the chip counted its own midpoint, so every rightward drag overshoots by one");
  assert.equal(chipDropIndex([10, 30, 50], 35, 2), 2,
    "dragged leftwards the same pointer answers differently, because the slot left behind is below "
    + "it rather than above");
});

test("a strip with nothing in it leaves the chip where it was", () => {
  assert.equal(chipDropIndex([], 999, 3), 3,
    "an empty strip answered with a place that does not exist");
});
