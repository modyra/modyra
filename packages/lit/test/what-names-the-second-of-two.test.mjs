/**
 * A range has two boxes and one caption, and the second is named by the contract.
 *
 * The caption's `for` points at the first — a range's caption belongs to where the range starts — so
 * nothing claims the second, and what it is called was this renderer's own word. It built
 * `"<caption> — End date"` around a hardcoded English phrase, which a translated page still said in
 * English, and the first box carried the same phrase with a different half.
 *
 * `MDY_PART_NAMES` binds the part to the message; the first keeps the caption that already points at
 * it. Two names for one element is what the binding removes, not a redundancy that makes it safer.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const fixture = await import("./support/state-fixture.mjs");
const { MDY_I18N_MESSAGES_DEFAULT, MDY_PART_NAMES } = await import("../../widgets/dist/index.js");

/** What a reader announces, with whatever is hidden from it left out. */
function announced(element, root) {
  const spoken = element.getAttribute("aria-label");
  if (spoken !== null && spoken.trim() !== "") return spoken.trim();
  const id = element.getAttribute("id");
  const caption = id === null ? null : root.querySelector(`label[for="${id}"]`);
  if (caption === null) return "";
  return [...caption.childNodes]
    .filter((node) => node.nodeType === 3 || node.getAttribute?.("aria-hidden") !== "true")
    .map((node) => node.textContent)
    .join("")
    .trim();
}

test("the second box says what the contract binds to it, and nothing around it", async () => {
  const mounted = await fixture.mount("daterange");
  await mounted.settle();

  const end = mounted.root.querySelector(".mdy-daterange__input--end");
  assert.ok(end !== null, "the range draws no second box, so this asserts nothing");
  assert.equal(end.getAttribute("aria-label"),
    MDY_I18N_MESSAGES_DEFAULT[MDY_PART_NAMES["daterange.endControl"]],
    "the second box says something the contract did not choose, so the other renderers have no "
    + "reason to say the same — and a phrase built here is one no table can translate whole");

  mounted.dispose();
});

test("and the first is named by the caption that already points at it", async () => {
  // The other direction, and the one that makes the removal safe: taking the composed phrase off the
  // first box is only correct because something else names it. Without this, that removal reads as a
  // tidy-up and ships a nameless control.
  const mounted = await fixture.mount("daterange");
  await mounted.settle();

  const start = mounted.root.querySelector(".mdy-daterange__input--start");
  assert.ok(start !== null, "no first box");
  assert.notEqual(announced(start, mounted.root), "",
    "the first box is announced as nothing: the phrase that named it is gone and the caption does "
    + "not reach it");
  assert.equal(start.getAttribute("aria-label"), null,
    "the first box carries a name of its own beside the caption pointing at it, which is two answers "
    + "to one question");

  mounted.dispose();
});
