import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
const { readAccessibleName } = await import("@modyra/widgets/testing");

defineMdyElements();

/**
 * A name a document declares reaches the box a person types in.
 *
 * A colour field draws two controls: the platform's own picker, which the themes hide, and the hex
 * box the caption points at. The declared name has to land on the second — the first is not
 * something anybody reaches, so a name written there is a name nobody hears.
 *
 * This renderer wrote the caption's words on the hex box and never asked for the declared name at
 * all, so a document that named the control was ignored while three other renderers honoured it. It
 * stayed invisible because the field still *had* a name: the caption's. A check asking "is this
 * named" answers yes, and the question that finds it is "named **what**".
 */
test("a colour field's hex box carries the name its document declared", async () => {
  const mounted = await mount("mdy-colors-field", (element) => {
    const form = createLitForm({ brand: field("#336699", []) });
    element.field = form.f.brand;
    element.label = "L";
    // How a document declares a name to a custom element: an attribute on the element itself.
    element.setAttribute("aria-label", "spoken name");
  });
  await mounted.updateComplete;

  const caption = mounted.querySelector("label");
  const forId = caption?.getAttribute("for");
  const box = forId ? mounted.querySelector(`[id="${forId}"]`) : null;
  assert.ok(box, "the caption points at nothing");

  const { name } = readAccessibleName(box, "bench", mounted.ownerDocument).value;
  assert.equal(name, "spoken name");
});
