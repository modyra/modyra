/**
 * A press anywhere on the control's box opens the list, including on the mark drawn over it.
 *
 * The contract names `control` as this kind's opener, and an opener is a box rather than a point:
 * the platform's own chooser — which is what every other renderer uses here — opens on a press
 * anywhere inside it, and the caret beside it is decoration. This package is the only one that draws
 * a custom trigger, so it is the only one that can put a hole in that box, and it did: the caret was
 * a sibling of the button, so a press at its centre landed on the wrapper, reached no handler, and
 * did nothing at all.
 *
 * **Pressed at the caret's centre**, because that is where the hole was. A press on the button's
 * text passed the whole time this was broken.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const { MdySelectField, createVueForm } = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { MDY_POPUP_OPENERS, partClasses } = await import("../../widgets/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

test("the caret is inside the element the contract names as the opener", async () => {
  // Asked of the catalogue rather than named here. The opener is a *part*, and which part is the
  // contract's answer: written as "control" from memory, this check failed on its own premise
  // before it could assert anything — which is what a premise is for.
  const opener = MDY_POPUP_OPENERS.select?.opener;
  assert.ok(opener, "this kind declares no opener, so there is no box this test can be about");

  const form = createVueForm({ value: field(null) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(MdySelectField, {
      field: form.f.value, widgetId: "c", label: "Pick", searchable: true,
      options: [{ value: "a", label: "Alpha" }],
    }),
  });
  app.mount(host);
  await settle();

  try {
    const trigger = host.querySelector(`.${partClasses("select", opener)[0]}`);
    const caret = host.querySelector(`.${partClasses("select", "arrow")[0]}`);
    assert.ok(trigger && caret, "the field drew no trigger or no caret");
    assert.equal(trigger.getAttribute("aria-expanded"), "false", "it was open before anything was pressed");

    // The structural claim, which is what makes a press at any point on the box reach a handler.
    assert.equal(
      trigger.contains(caret), true,
      "the caret is drawn beside the opener rather than inside it, so its area is a hole in the box a person presses",
    );

    // And the press itself, from the caret — the exact point that did nothing.
    caret.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await settle();
    assert.equal(trigger.getAttribute("aria-expanded"), "true", "a press on the caret did not open the list");
  } finally {
    app.unmount();
    host.remove();
  }
});
