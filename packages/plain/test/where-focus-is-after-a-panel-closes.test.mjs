/**
 * After a panel closes, focus is somewhere a person can carry on from.
 *
 * A panel that goes away while focus is inside it hands focus to `<body>` — that is the platform,
 * not a decision. From there the next Tab starts at the top of the document, and nobody is told they
 * have been moved. It is also indistinguishable, to everything downstream, from a person leaving the
 * field: whatever answers "has this field been left" answers yes, and it is right by accident.
 *
 * So `body` is not one of the answers. It is a defect wherever it appears, whatever else the close
 * did — assertable without settling what a close should validate (ADR 0167).
 *
 * The rule that produces it: on a close, focus moves back to the opener *before* the panel is
 * removed. The same code in the other order gives `body` a window to win in.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { MDY_POPUP_OPENERS, partClasses } = await import("@modyra/widgets");

const OPTIONS = [{ value: "a", label: "A" }];

/**
 * The opener the contract names, not one found by guessing at a selector.
 *
 * Three of these kinds draw more than one button and only one of them opens the panel. A guess picks
 * a different element per kind and then reports "it did not open" about a control nobody asked to.
 */
function openerOf(host, kind) {
  const part = MDY_POPUP_OPENERS[kind].opener;
  const classes = partClasses(kind, part)?.classes ?? partClasses(kind, part) ?? [];
  for (const name of classes) {
    const found = host.querySelector(`.${name}`);
    if (found !== null) return found;
  }
  return null;
}

const press = (element, key) =>
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

for (const kind of Object.keys(MDY_POPUP_OPENERS)) {
  test(`${kind}: closing the panel leaves focus on the field, never on the document`, async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const { reactivity, dispose } = mountMdyForm(
      host,
      [{ name: "f", kind, label: "F", options: OPTIONS, searchable: true }],
      { submitLabel: null },
    );
    await reactivity.flush();

    const opener = openerOf(host, kind);
    assert.ok(opener !== null, `${kind} declares an opener the page does not carry`);
    opener.focus();
    // Both, because a kind's opener is a button in some kinds and a text box in others: a button
    // opens on a press the platform synthesises from Enter, which a dispatched keydown does not do.
    press(opener, "Enter");
    await reactivity.flush();
    if (host.querySelector("[aria-expanded='true']") === null) {
      // From the document's own window: this environment installs the DOM without putting every
      // event constructor on the global, and a bare `MouseEvent` is a `ReferenceError` here.
      const Click = host.ownerDocument.defaultView.MouseEvent;
      opener.dispatchEvent(new Click("click", { bubbles: true }));
    }
    await reactivity.flush();

    // The perimeter: if nothing opened, closing it asserts nothing at all.
    assert.ok(host.querySelector("[aria-expanded='true']") !== null,
      `${kind} did not open, so what follows is not a panel closing`);

    // Focus inside the panel, which is the whole subject: a close with focus still on the opener
    // cannot send it anywhere, so the check would pass against a renderer that restores nothing.
    // Found by the link the opener declares, never by walking the tree: this renderer moves a panel
    // out of the field so a scrolling ancestor cannot clip it, and a lookup inside the field then
    // finds nothing while the panel is on screen. `aria-controls` is the same link a screen reader
    // follows, and it holds wherever the panel was put.
    const controls = host.querySelector("[aria-controls]")?.getAttribute("aria-controls");
    const panel = controls ? host.ownerDocument.getElementById(controls) : null;
    assert.ok(panel !== null, `${kind} says it is open and names no panel a reader could reach`);
    const inside = panel.querySelector(
      "button, [tabindex]:not([tabindex='-1']), input, [role='option'], [role='gridcell']",
    );
    assert.ok(inside !== null, `${kind}'s panel holds nothing focusable, so focus cannot be inside it`);
    // Not every kind's panel takes focus. A listbox driven by `aria-activedescendant` keeps focus on
    // the opener and moves a marker instead — deliberately, and it is why that pattern exists. For
    // those the premise of this check is unreachable rather than failed, and the close is pressed
    // from where focus actually is.
    inside.focus();
    const focusEntered = host.ownerDocument.activeElement === inside;
    const from = focusEntered ? inside : opener;

    press(from, "Escape");
    await reactivity.flush();

    assert.equal(host.querySelector("[aria-expanded='true']"), null,
      `${kind}: Escape from inside the panel did not close it. A person who opened it, narrowed it `
      + `and changed their mind has no way back out with the keyboard`);

    const landed = host.ownerDocument.activeElement;
    assert.notEqual(landed, host.ownerDocument.body,
      `${kind}: the panel closed and focus went to the document. The next key a person presses `
      + `starts at the top of the page, and nothing told them they had been moved`);
    assert.ok(landed !== null && host.contains(landed),
      `${kind}: focus left the field on a gesture that closes a panel inside it`);

    dispose?.();
    host.remove();
  });
}
