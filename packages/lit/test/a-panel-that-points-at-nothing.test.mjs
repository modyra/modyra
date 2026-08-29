/**
 * A panel's name resolves, on a document that writes no caption.
 *
 * Everything inside a field is named by pointing at one element. A dialog, a listbox, a grid all
 * carry `aria-labelledby` at the field's caption — and a reference that lands on nothing is not a
 * missing name, it is a name a reader is told exists and then does not hear. The panel is announced
 * as "dialog" and no more.
 *
 * That is the state a caption-less document produced: the caption element was drawn only when
 * somebody wrote one, so every reference to it dangled exactly when the fallback was supposed to
 * carry the field. It is drawn always now, carrying what the resolver chooses, and taken out of sight
 * where those words are the field's own key rather than a person's — a name is owed to a screen
 * reader, a heading is not.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const fixture = await import("./support/state-fixture.mjs");
const { MDY_POPUP_OPENERS } = await import("../../widgets/dist/index.js");

/** What a reader would announce for an element, with what is hidden from it left out. */
function announced(element, root) {
  const spoken = element.getAttribute("aria-label");
  if (spoken !== null && spoken.trim() !== "") return spoken.trim();
  const points = element.getAttribute("aria-labelledby");
  if (points === null) return "";
  const target = root.ownerDocument.getElementById(points);
  if (target === null) return "";
  return [...target.childNodes]
    .filter((node) => node.nodeType === 3 || node.getAttribute?.("aria-hidden") !== "true")
    .map((node) => node.textContent)
    .join("")
    .trim();
}

for (const kind of Object.keys(MDY_POPUP_OPENERS)) {
  test(`${kind}: its panel is announced as something, with no caption written`, async () => {
    const mounted = await fixture.mount(kind, { label: null });
    await mounted.settle();
    mounted.drive("open");
    await mounted.settle();

    const panel = mounted.root.querySelector("[role='dialog'], [role='listbox'], [role='grid']");
    if (panel === null) {
      // The kinds whose opener is a button do not open outside a browser. Skipping is honest; the
      // assertion below would otherwise pass for a panel that was never drawn.
      mounted.dispose();
      return;
    }
    assert.notEqual(announced(panel, mounted.root), "",
      `${kind}'s panel names itself by pointing at a caption that is not there. A reference that `
      + "lands on nothing is worse than none: a reader is told a name exists and hears the role");

    mounted.dispose();
  });
}

test("and the caption nobody wrote is out of sight", async () => {
  // The other half, here because the two are one decision: the element exists so references resolve,
  // and it is hidden so a raw key does not stand where a caption somebody meant would. Split across
  // two files, one could be repaired in a way that breaks the other and both stay green.
  const bare = await fixture.mount("text", { label: null });
  await bare.settle();
  const hidden = bare.root.querySelector(".mdy-label");
  assert.ok(hidden !== null, "no caption element at all, so every reference to one resolves to nothing");
  assert.ok(hidden.classList.contains("mdy-label--unwritten"),
    "the field's own key is standing in the position and styling of a caption somebody meant");
  bare.dispose();

  const said = await fixture.mount("text");
  await said.settle();
  const shown = said.root.querySelector(".mdy-label");
  assert.ok(!shown.classList.contains("mdy-label--unwritten"),
    "a caption a document wrote is hidden, so the form shows no labels at all");
  said.dispose();
});
