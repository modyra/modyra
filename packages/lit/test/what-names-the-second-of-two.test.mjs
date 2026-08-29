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

test("and the first box names itself, inside a group the caption names", async () => {
  // This replaces a rule that said the opposite, and the measurement is why. The first box used to
  // point at the caption *and* carry its own name; `aria-labelledby` wins the computation, so both
  // boxes announced the field's words and neither said which end it was. Pointing a box at the
  // caption gives a part the name of the whole.
  //
  // What carries "of what" is the group around the pair, said once on entry. ADR 0175.
  const mounted = await fixture.mount("daterange");
  await mounted.settle();

  const start = mounted.root.querySelector(".mdy-daterange__input--start");
  assert.ok(start !== null, "no first box");
  assert.equal(start.getAttribute("aria-label"),
    MDY_I18N_MESSAGES_DEFAULT[MDY_PART_NAMES["daterange.startControl"]] ?? "Start date",
    "the first box says nothing of its own, so a reader hears the same words on both ends");
  assert.equal(start.getAttribute("aria-labelledby"), null,
    "the first box points at the caption as well, which wins the name computation and silences the "
    + "name beside it");

  // The pair is a group and the caption's words are its name — the words rather than a reference to
  // them, because a reference is one more thing that can point at nothing when a document wrote no
  // caption, and a reader hears the same sentence either way.
  const group = mounted.root.querySelector('[role="group"]');
  assert.ok(group !== null, "nothing groups the two ends, so neither says what it is an end of");
  assert.equal(group.getAttribute("aria-label"), mounted.root.label,
    "the group does not carry the caption's words, so neither box says what it is an end of");

  mounted.dispose();
});
