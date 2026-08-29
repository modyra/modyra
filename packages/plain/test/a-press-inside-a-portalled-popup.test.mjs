/**
 * A popup this field portalled is still this field's popup.
 *
 * The light-dismiss rule closes an overlay when a primary interaction begins and ends outside its
 * logical branch. "Outside" is a question about the branch, and a portalled popup is the one part of
 * a branch that containment cannot find: this renderer appends a select's popup to `document.body`,
 * where it is a sibling of the field rather than a descendant.
 *
 * The renderer used to answer that question itself, by listing the popup among the elements it
 * called inside — which works exactly as long as nobody forgets. It no longer has to: a widget that
 * portals a popup declares the relationship through its opener's `aria-controls`, and the contract
 * follows that declaration out.
 *
 * The press lands on the popup itself rather than on an option, because choosing an option closes
 * the overlay for a reason that has nothing to do with dismissal — a check driven through an option
 * would report "closed" either way.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");

test("a press inside a portalled popup does not dismiss it", async () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const mounted = mountMdyForm(
    host,
    [{ name: "c", kind: "select", label: "C", searchable: true, options: [{ value: "IT", label: "Italy" }] }],
    { submitLabel: null },
  );

  const trigger = host.querySelector(".mdy-select__trigger");
  trigger.click();
  await Promise.resolve();

  const popups = document.body.querySelectorAll(".mdy-select__dropdown");
  const popup = popups[popups.length - 1];
  // The control on the measurement: a popup rendered inside the field would make this test pass
  // without ever exercising the portal.
  assert.ok(popup, "the select portals its popup");
  assert.equal(host.contains(popup), false, "and it really is outside the field");

  const fire = (target, type, opts = {}) =>
    target.dispatchEvent(Object.assign(new window.Event(type, { bubbles: true }), opts));
  fire(popup, "pointerdown", { pointerId: 1, isPrimary: true, button: 0 });
  fire(popup, "pointerup", { pointerId: 1 });
  fire(popup, "click");
  await Promise.resolve();

  assert.equal(popup.hidden, false, "the popup stayed open");
  assert.equal(trigger.getAttribute("aria-expanded"), "true");

  mounted.dispose();
  host.remove();
});
