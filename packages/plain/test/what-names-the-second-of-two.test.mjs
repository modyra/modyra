/**
 * A range has two boxes and one caption, and the second box is named by the contract.
 *
 * The caption's `for` points at the first — a range's caption belongs to where the range starts, and
 * the relations say so. Nothing points at the second, so what it is called was each renderer's own
 * decision: this one built `"<caption> — end"` from an English word, and a page in Italian said
 * "end" in the middle of a sentence nobody wrote.
 *
 * `MDY_PART_NAMES` says which message names it. The word already existed in the table in five
 * languages; what was missing was the line saying it belongs to this part.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { MDY_I18N_PRESETS, MDY_PART_NAMES, MDY_I18N_MESSAGES_DEFAULT } = await import("@modyra/widgets");

function ranged(locale) {
  const host = document.createElement("div");
  document.body.append(host);
  const { reactivity, dispose } = mountMdyForm(
    host,
    [{ name: "quando", kind: "daterange", label: "Quando", locale }],
    { submitLabel: null },
  );
  return { host, reactivity, dispose };
}

test("the second box is named, and named by what the contract binds to it", async () => {
  const { host, reactivity, dispose } = ranged("en");
  await reactivity.flush();

  const end = host.querySelector(".mdy-daterange__input--end");
  assert.ok(end !== null, "the range draws no second box, so this asserts nothing");
  const expected = MDY_I18N_PRESETS.en[MDY_PART_NAMES["daterange.endControl"]];
  assert.equal(end.getAttribute("aria-label"), expected,
    "the second box says something the contract did not choose for it, so the other renderers have "
    + "no reason to say the same");

  dispose?.();
  host.remove();
});

test("and it says it in the language the field speaks", async () => {
  // The half a single-language check cannot see. A name assembled in a renderer reads correctly in
  // English and stays English on a translated page, which is the state this replaced.
  const { host, reactivity, dispose } = ranged("it");
  await reactivity.flush();

  const end = host.querySelector(".mdy-daterange__input--end");
  const italian = MDY_I18N_PRESETS.it[MDY_PART_NAMES["daterange.endControl"]];
  assert.notEqual(italian, MDY_I18N_PRESETS.en[MDY_PART_NAMES["daterange.endControl"]],
    "the two languages carry the same word for this, so the check below cannot tell them apart");
  assert.equal(end.getAttribute("aria-label"), italian);

  dispose?.();
  host.remove();
});

test("and the first box says its own role, inside a group the caption names", async () => {
  // Rewritten with ADR 0175, and the rule it replaces was the one that made both boxes say the same
  // thing. The caption names the *pair*; each box says which end it is, from the table that holds
  // those words. A box pointed at the caption gets the name of the whole — and `aria-labelledby`
  // wins the computation, so the name beside it never speaks.
  const { host, reactivity, dispose } = ranged("en");
  await reactivity.flush();

  const start = host.querySelector(".mdy-daterange__input:not(.mdy-daterange__input--end)");
  assert.ok(start !== null, "no first box");
  assert.equal(start.getAttribute("aria-label"), MDY_I18N_MESSAGES_DEFAULT.daterangeStartLabel,
    "the first box does not say which end it is, so a reader moving between the two hears the same "
    + "words twice");

  // And the pair is grouped, with the caption's words on the group.
  const group = host.querySelector('[role="group"]');
  assert.ok(group !== null, "nothing groups the two ends");
  assert.equal(group.getAttribute("aria-label"), "Quando",
    "the group does not carry the caption, so neither box says what it is an end of");

  dispose?.();
  host.remove();
});
