/**
 * Tabbing through a required field and leaving it empty says nothing.
 *
 * ADR 0167. Focus arriving and leaving is an act on attention, not on the value: Tab is how a person
 * reads a form, the way eyes scroll it. Somebody tabbing past twenty required fields to learn what a
 * form asks must not collect twenty announcements of "invalid" for fields they were about to fill
 * in — a sighted person scrolling the same form gets no red borders.
 *
 * The question is not "has focus been here" but "did the value change while they were there".
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";
import { MDY_FIELD_SHELL_CLASSES } from "@modyra/widgets";

installDomGlobals();
const fixture = await import("./support/state-fixture.mjs");

/** A kind that always holds a value cannot be required-and-empty, so it has no state to be read in. */
const NEVER_EMPTY = new Set(["slider", "toggle", "number"]);

const saidWrong = (root) => root.querySelectorAll('[aria-invalid="true"]').length > 0;

/**
 * The other channel, and the one a sighted person actually reads.
 *
 * `aria-invalid` and the message under the field answer one question — is this person being told —
 * and they were computed from two different rules: the attribute learned that a traversal is not an
 * answer while the text was painted from "which refusals exist". A field said `false` and printed
 * "required" at the same time.
 */
const saysWrongInWords = (root) =>
  [...root.querySelectorAll(
    `.${MDY_FIELD_SHELL_CLASSES.errors}, .${MDY_FIELD_SHELL_CLASSES.errorItem}, .${MDY_FIELD_SHELL_CLASSES.inlineError}`,
  )]
    .map((element) => (element.textContent ?? "").trim())
    .filter((text) => text !== "").length > 0;

for (const kind of fixture.KINDS.filter((one) => !NEVER_EMPTY.has(one))) {
  test(`${kind}: focus in, focus out, nothing typed — it says nothing`, async () => {
    const mounted = fixture.mount(kind);
    await mounted.settle();

    // Whatever a Tab lands on: a box for the kinds that have one, the opener for the kinds whose
    // control is a button. Asking only for an input skips exactly the kinds whose silence was an
    // accident of nobody having bound a handler to their trigger.
    const control = mounted.control() ?? fixture.openerOf(mounted.root, kind);
    assert.ok(control, `${kind} offers nothing to focus, so this asserts nothing about leaving it`);
    control.focus?.();
    control.dispatchEvent(new window.FocusEvent("focus", { bubbles: false }));
    await mounted.settle();
    // The act, asserted before its consequence: a traversal that never arrived proves nothing.
    assert.ok(mounted.root.contains(document.activeElement),
      `${kind} never took focus, so nothing here is a traversal`);
    control.dispatchEvent(new window.FocusEvent("blur", { bubbles: false }));
    control.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true }));
    await mounted.settle();

    assert.equal(saidWrong(mounted.root), false,
      `${kind} calls itself wrong after a bare traversal. Reading a form is not declining it — ADR 0167`);
    assert.equal(saysWrongInWords(mounted.root), false,
      `${kind} prints a refusal after a bare traversal, whatever its attribute says — ADR 0167`);

    // The perimeter: the same field can still say it, so the silence above is an answer rather than
    // a renderer that never writes the attribute.
    mounted.drive("invalid");
    await mounted.settle();
    assert.equal(saidWrong(mounted.root), true,
      `${kind} never says a field is wrong, so the check above asserts nothing`);
    assert.equal(saysWrongInWords(mounted.root), true,
      `${kind} never prints a refusal, so the words check above asserts nothing`);

    mounted.dispose();
  });
}
