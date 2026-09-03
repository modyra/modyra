/**
 * Where the keyboard is standing in an open list is something a reader is told.
 *
 * A cursor that exists only as a class has moved for everyone who can see the screen and for nobody
 * else. There are two honest ways to say it, and ARIA allows both: put real focus on the option, so
 * the focused element *is* the cursor; or keep focus where a person is typing and name the option
 * with `aria-activedescendant`. This kind uses each in a different configuration, which is why the
 * claim below is the disjunction rather than either half — asserting only the reference would fail a
 * renderer that took the better road, and asserting only focus would fail the one with a filter box.
 *
 * **The reference is asserted to resolve to the option under the cursor, never merely to be there.**
 * A dangling IDREF is the shape this repository has already paid for once: it reads as correct in
 * every markup dump and points assistive technology at nothing.
 *
 * **And it is read from the element that holds focus.** A reference on an element nobody is standing
 * on is not consulted, so a check that asked "does anything in the document carry this attribute"
 * would pass on a page where the one element that needed it did not have it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
const { partClasses, stateClass } = await import("@modyra/widgets");

defineMdyElements();

const settle = async (element) => {
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 80));
  await element.updateComplete;
};
const OPTION = partClasses("multiselect", "option")[0];
const CURSOR = stateClass(OPTION, "active");

async function openAndMoveCursor({ mode, searchable }) {
  const form = createLitForm({ t: field([]) });
  const host = await mount("mdy-multiselect-field", (element) => {
    element.field = form.f.t;
    element.label = "T";
    element.mode = mode;
    if (searchable) element.searchable = true;
    element.options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
  });
  await settle(host);

  const trigger = host.querySelector("[aria-expanded]");
  trigger.focus();
  trigger.click();
  await settle(host);
  assert.equal(trigger.getAttribute("aria-expanded"), "true", "the list did not open, so there is no cursor to be told about");

  document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  await settle(host);
  // The precondition, and it is the subject: a cursor exists on the page at all.
  const cursor = document.querySelector(`.${CURSOR}`);
  assert.ok(cursor, "no option carries the cursor after ArrowDown, so nothing below is about a cursor");
  assert.ok(cursor.id, "the option under the cursor carries no id, so nothing could name it");
  return { host, cursor };
}

for (const [mode, searchable] of [["single", false], ["multi", false], ["multi", true]]) {
  test(`mode=${mode} searchable=${searchable}: the keyboard's position is announced, one way or the other`, async () => {
    const { host, cursor } = await openAndMoveCursor({ mode, searchable });
    const holder = document.activeElement;
    assert.notEqual(holder, document.body, "focus is on the document, so no element is in a position to say anything");

    const named = holder.getAttribute?.("aria-activedescendant") ?? null;
    const isCursorItself = holder === cursor;

    assert.ok(
      isCursorItself || named !== null,
      `focus is on .${holder.className} and it neither is the option under the cursor nor names one — `
      + "the cursor moved for everyone who can see the screen and for nobody else",
    );

    if (!isCursorItself) {
      const target = document.getElementById(named);
      assert.ok(target, `the reference names "${named}", which resolves to nothing — a dangling IDREF reads as correct and points at nothing`);
      assert.equal(target, cursor, "the reference resolves to an element that is not the option under the cursor");
    }
    host.remove();
  });
}
