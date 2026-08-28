/**
 * After a panel closes, focus is somewhere a person can carry on from.
 *
 * A panel that goes away while focus is inside it hands focus to `<body>` — that is the platform,
 * not a decision. From there the next Tab starts at the top of the document, and nobody is told they
 * have been moved. It is also indistinguishable, to everything downstream, from a person leaving the
 * field: whatever answers "has this field been left" answers yes, and it is right by accident.
 *
 * So `body` is not one of the answers. It is a defect wherever it appears, whatever else the close
 * did — which makes this one line assertable across every kind that opens something, without
 * settling anything about what the close should validate (ADR 0167).
 *
 * The rule that produces it: on a close, focus moves back to the opener *before* the panel is
 * removed. Closing first and placing focus afterwards is the same code in the other order and gives
 * `body` a window to win in.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const fixture = await import("./support/state-fixture.mjs");

/** The kinds whose contract declares something that opens. */
const WITH_A_PANEL = ["select", "multiselect", "datepicker", "daterange", "timepicker", "colors"];

for (const kind of WITH_A_PANEL) {
  test(`${kind}: closing the panel leaves focus on the field, never on the document`, async () => {
    const mounted = await fixture.mount(kind);
    await mounted.settle();
    const document_ = mounted.root.ownerDocument;

    // The opener the contract names, not one guessed by selector: three kinds here draw more than
    // one button and only one of them opens the panel — a guess picks a different element per kind
    // and reports "it did not open" about a control that was never asked to.
    const opener = fixture.openerOf(mounted.root, kind);
    assert.ok(opener, `${kind} declares an opener the page does not carry`);

    opener.focus();
    mounted.drive("open");
    await mounted.settle();

    // The perimeter: if nothing opened, closing it asserts nothing at all.
    assert.ok(mounted.root.querySelector("[aria-expanded='true']") !== null,
      `${kind} did not open, so what follows is not a panel closing`);

    // Focus inside the panel, which is the whole subject: a close with focus still on the opener
    // cannot send it to `body`, so the check would pass against a renderer that restores nothing.
    // The first version of this did exactly that, and a mutation that removed the restore survived.
    const panel = mounted.parts().popup ?? mounted.root.querySelector("[role='dialog'], [role='listbox'], [role='grid']");
    assert.ok(panel, `${kind} says it is open and has no panel on the page`);
    const inside = panel.querySelector("button, [tabindex]:not([tabindex='-1']), input, [role='option'], [role='gridcell']");
    assert.ok(inside, `${kind}'s panel holds nothing focusable, so focus cannot be inside it`);
    inside.focus();
    assert.equal(document_.activeElement, inside,
      `${kind}: focus would not go into the panel, so this is not the act being asserted`);

    mounted.press("Escape");
    await mounted.settle();

    // That it *closed* is half the assertion, and the half the first version left out: a panel that
    // ignored the key cannot send focus anywhere, so every renderer passed — including one where the
    // key never reached a handler at all, because the panel renders outside the element that binds
    // them and a keydown inside it bubbles somewhere else entirely.
    assert.equal(mounted.root.querySelector("[aria-expanded='true']"), null,
      `${kind}: Escape from inside the panel did not close it. A person who opened it, narrowed it `
      + `and changed their mind has no way back out with the keyboard`);

    const landed = document_.activeElement;
    assert.notEqual(landed, document_.body,
      `${kind}: the panel closed and focus went to the document. The next key a person presses `
      + `starts at the top of the page, and nothing told them they had been moved`);
    assert.ok(landed !== null && mounted.root.contains(landed),
      `${kind}: focus left the field on a gesture that closes a panel inside it`);

    mounted.dispose();
  });
}
