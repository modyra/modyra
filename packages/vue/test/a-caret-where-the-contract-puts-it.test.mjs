/**
 * The caret sits where the contract puts it, and the box under it belongs to what opens.
 *
 * The first version of this bench asserted the opposite — the caret *inside* the trigger — and the
 * browser tier rejected it in one run: `arrow` declares `inputWrapper` as its parent, and moving it
 * was contradicting a rule the suite guards. The claim was right and the remedy was not: an opener
 * is a box rather than a point, but the box is made to reach under the caret rather than the caret
 * made part of the button.
 *
 * So what is asserted here is the half this environment can see — the caret is where the contract
 * names, and it is a sibling of the element that opens. Whether a press at its centre reaches that
 * element is a question about layout, which jsdom does not compute: it belongs to the browser tier,
 * where it was measured in the first place.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const { MdySelectField, createVueForm } = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, partClasses } = await import("../../widgets/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

test("the caret is where the contract puts it, beside the element that opens", async () => {
  // Both asked of the catalogue rather than named here. Written from memory, the opener was wrong
  // once and the parent was wrong once — and each time the thing that caught it was asking.
  const opener = MDY_POPUP_OPENERS.select?.opener;
  const declared = MDY_WIDGET_CONTRACTS.select.structure.nodes.find((node) => node.part === "arrow");
  assert.ok(opener, "this kind declares no opener, so there is no box this test can be about");
  assert.ok(declared, "this kind declares no caret, so there is nothing to place");

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

    const parent = host.querySelector(`.${partClasses("select", String(declared.parent))[0]}`);
    assert.equal(
      caret.parentElement, parent,
      `the contract puts the caret inside ${String(declared.parent)}, and it is somewhere else`,
    );
    assert.equal(trigger.contains(caret), false, "the caret is inside the opener, which the contract does not name");

    // And the opener still opens, from the press a person makes on its face.
    assert.equal(trigger.getAttribute("aria-expanded"), "false", "it was open before anything was pressed");
    trigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await settle();
    assert.equal(trigger.getAttribute("aria-expanded"), "true");
  } finally {
    app.unmount();
    host.remove();
  }
});
