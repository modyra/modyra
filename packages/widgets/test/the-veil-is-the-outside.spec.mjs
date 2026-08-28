/**
 * A press on the dimming veil is a press outside the panel.
 *
 * The veil is drawn as the panel's **sibling, inside the same portal**, so the containment test that
 * answers "did this happen inside the overlay" said yes about it. A press on the darkened area — the
 * gesture a person reaches for to close a modal — was therefore counted as a press inside, and the
 * panel stayed open. With no pointer way out, only `Escape` remained, which not everybody knows.
 *
 * The rule reads the DOM, so this does too: the veil is built by the same function the renderers
 * call, and the branch is the real portal it lands in.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "../../plain/test/support/dom-env.mjs";

installDomGlobals();
const { MDY_BACKDROP_ATTRIBUTE, overlayBranchContains, syncOverlayBackdrop } =
  await import("../dist/index.js");

/**
 * The real geometry, because a simpler one does not reach the rule.
 *
 * The branch is rooted at the **field**, and the portal is found from it: a trigger inside the field
 * names a panel that lives elsewhere, and everything in that panel's outermost container counts as
 * inside. A fixture rooted at the panel itself has the veil as a plain sibling and answers "outside"
 * with no rule at all — which is how the first version of this file passed without the thing it was
 * written to check.
 */
function anOpenPanel() {
  const field = document.createElement("div");
  const trigger = document.createElement("button");
  trigger.setAttribute("aria-controls", "the-panel");
  field.append(trigger);

  const portal = document.createElement("div");
  const panel = document.createElement("div");
  panel.id = "the-panel";
  const insideThePanel = document.createElement("button");
  panel.append(insideThePanel);
  portal.append(panel);
  document.body.append(field, portal);

  syncOverlayBackdrop(panel, true);
  return { field, portal, panel, trigger, insideThePanel,
    veil: portal.querySelector(`[${MDY_BACKDROP_ATTRIBUTE}]`) };
}

test("the veil the renderers draw carries the attribute the contract names", () => {
  const { field, portal, veil } = anOpenPanel();
  assert.ok(veil, `no element carries ${MDY_BACKDROP_ATTRIBUTE} after the veil was drawn — the name `
    + "and the thing it names have come apart, and every rule reading the name is now blind");
  portal.remove();
  field.remove();
});

test("a press on the veil is outside the panel", () => {
  const { field, portal, panel, veil } = anOpenPanel();
  assert.equal(overlayBranchContains({ root: field }, veil), false,
    "the veil counted as inside. It is the panel's sibling in the same portal, so containment says "
    + "yes — and a press on the darkened area is the one gesture a person expects to close it with");
  portal.remove();
  field.remove();
});

test("something drawn on top of the veil is outside too", () => {
  const { field, portal, panel, veil } = anOpenPanel();
  const onTheVeil = document.createElement("span");
  veil.append(onTheVeil);
  assert.equal(overlayBranchContains({ root: field }, onTheVeil), false,
    "a node inside the veil counted as inside the panel");
  portal.remove();
  field.remove();
});

test("the panel's own contents are still inside", () => {
  // The premise: a rule that answered "outside" about everything would pass the checks above and
  // dismiss the panel on its own buttons.
  const { field, portal, panel, insideThePanel } = anOpenPanel();
  assert.equal(overlayBranchContains({ root: field }, insideThePanel), true,
    "the panel's own content reads as outside — the rule now dismisses on its own buttons");
  assert.equal(overlayBranchContains({ root: field }, panel), true);
  portal.remove();
  field.remove();
});

test("a press on the page is outside", () => {
  const { field, portal, panel } = anOpenPanel();
  const elsewhere = document.createElement("div");
  document.body.append(elsewhere);
  assert.equal(overlayBranchContains({ root: field }, elsewhere), false);
  elsewhere.remove();
  portal.remove();
  field.remove();
});
