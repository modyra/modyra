/**
 * One press moves a chip, and the strip shows it.
 *
 * WCAG 2.5.7 asks for a single-pointer path to reordering that does not depend on dragging or on the
 * keyboard: somebody who cannot hold and drag has no other way. The handle is owed to a field that
 * says it offers reordering, and drawn on one that does not it is a control that claims an act it
 * cannot perform.
 *
 * The strip is asserted beside the value because the two came apart: the chips were drawn in the
 * order the *option list* happened to be in, so a value reordered under them left the strip looking
 * exactly as before. A move nobody can see is, for everyone who cannot read the model, a move that
 * did not happen.
 *
 * The **last** chip is the one pressed. The first cannot move earlier, so a press on it cannot tell
 * "moved" apart from "clamped" — the same reason an ordinal case is never probed at its first entry.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { installDomGlobals } from "./support/dom-env.mjs";
installDomGlobals();
const cfg = await import("../conformance.config.mjs");

const strip = (root) =>
  [...root.querySelectorAll(".mdy-chip--value")].map((chip) => (chip.textContent ?? "").trim());

test("a press on a chip's handle moves it, in the value and on the page", async () => {
  const fixture = await cfg.mount("multiselect", { value: ["a", "b", "c"], config: { reorderable: true } });
  await fixture.settle?.();

  const before = fixture.value();
  const stripBefore = strip(fixture.root);
  const chips = [...fixture.root.querySelectorAll(".mdy-chip--value")];
  const handle = chips[chips.length - 1]?.querySelector("[class*='chip__move']");
  assert.ok(handle, "the field offers reordering and no chip carries a handle to do it with");

  handle.click();
  await fixture.settle?.();

  assert.notDeepEqual(fixture.value(), before, "the handle was pressed and the value did not move");
  assert.notDeepEqual(strip(fixture.root), stripBefore,
    "the value moved and the strip did not: the chips are drawn in an order of their own");
  fixture.dispose?.();
});

test("a field that does not offer reordering draws no handle to do it with", async () => {
  // The other half, and the reason the first cannot stand alone: a renderer that always drew the
  // handles would pass it while claiming an act on every field that cannot perform one.
  const fixture = await cfg.mount("multiselect", { value: ["a", "b"] });
  await fixture.settle?.();
  assert.equal(fixture.root.querySelectorAll("[class*='chip__move']").length, 0,
    "a handle was drawn on a field that never said it offers reordering");
  fixture.dispose?.();
});
