/**
 * A panel says where it went, on both axes, and stops saying it when it closes.
 *
 * This renderer wrote the placement itself and reflected only the vertical half: a popup that flipped
 * to hang off the other inline edge carried no class saying so. Nothing in this repository paints
 * that class — by decision, recorded in DESIGN.md — which is exactly why nothing here noticed. A
 * theme outside it may match the class today, and the statement "this panel is anchored right" is
 * true whether or not anything in this tree acts on it.
 *
 * The clearing had the same hole from the other side: closing took the vertical class off and left
 * the horizontal one on, so a popup that had once hung right kept saying so while shut.
 *
 * **The viewport and the anchor are stated, not inherited.** Every rectangle in this environment is
 * zero, and a placement decided against zeroes is the ordinary case for both axes — which is the
 * answer that cannot tell a renderer that emits the class from one that does not.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { anchorOverlay, overlayAnchoringFor, partClasses, popupAlignmentClass } = await import("../../widgets/dist/index.js");

const settle = () => new Promise((resolve) => setTimeout(resolve, 40));
const VIEWPORT = { width: 1000, height: 800 };

/** A viewport with a size, which jsdom does not give one. */
const statedViewport = () => {
  for (const [name, value] of Object.entries({ clientWidth: VIEWPORT.width, clientHeight: VIEWPORT.height })) {
    Object.defineProperty(document.documentElement, name, { configurable: true, value });
  }
};

/** An anchor hard against the right edge, which is what makes the decision flip. */
const RIGHT_EDGE = {
  x: VIEWPORT.width - 40, y: 100, top: 100, bottom: 130, left: VIEWPORT.width - 40,
  right: VIEWPORT.width - 10, width: 30, height: 30,
};
const anchoredAtTheRightEdge = (element) => {
  element.getBoundingClientRect = () => ({ ...RIGHT_EDGE, toJSON: () => ({}) });
};

const mount = () => {
  const host = document.createElement("div");
  document.body.append(host);
  const form = mountMdyForm(
    host,
    [{ name: "pick", kind: "select", label: "Pick", searchable: true, options: [{ value: "a", label: "A" }] }],
    { submitLabel: null },
  );
  return { host, form, dispose: () => { form.destroy?.(); host.remove(); } };
};

test("a panel hung from the other inline edge says so, and stops saying it when it closes", async () => {
  statedViewport();
  const right = popupAlignmentClass("select", "right");
  assert.ok(right, "this kind names no class for the other edge, so there is nothing to watch");
  // The decision is the contract's, and it is asked here first: if this arrangement did not flip the
  // alignment, the assertions below would pass on a renderer that never emits the class at all.
  assert.equal(
    anchorOverlay(RIGHT_EDGE, VIEWPORT, { ...overlayAnchoringFor("select"), direction: "ltr" }).decision.alignment,
    "right",
    "the stated anchor and viewport do not produce a right-hung panel, so this bench proves nothing",
  );

  const view = mount();
  const trigger = view.host.querySelector(`.${partClasses("select", "trigger")[0]}`);
  const popup = document.querySelector(`.${partClasses("select", "popup")[0]}`);
  assert.ok(trigger && popup, "the field drew no trigger or no popup");
  anchoredAtTheRightEdge(trigger);

  trigger.click();
  await settle();
  assert.equal(trigger.getAttribute("aria-expanded"), "true", "the panel never opened, so nothing below is about placement");
  assert.equal(popup.dataset.placement !== undefined, true, "the popup carries no placement at all");
  assert.equal(popup.classList.contains(right), true, `the panel hangs right and does not wear ${right}`);

  trigger.click();
  await settle();
  assert.equal(popup.classList.contains(right), false, "a closed panel still says which edge it hung from");
  view.dispose();
});
