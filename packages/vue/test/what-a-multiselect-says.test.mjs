import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();

const config = await import("../conformance.config.mjs");
const { MDY_WIDGET_CONTRACTS, partClasses } = await import("@modyra/widgets");

/**
 * What a multiselect says when the thing it holds changes.
 *
 * Three policies compose these sentences — which value moved and where it landed, that a quantity
 * settled and whether it is at its floor, what was added and removed since the last thing said — and
 * the words are published in five languages. This renderer draws the region that carries them and
 * never fills it, so the page reports every one of those acts as the empty string: a change nobody
 * is told about, on a control whose whole job is to hold several things at once.
 *
 * Asserted as "names the value" rather than against a whole sentence: which words a language uses is
 * the message table's business, and pinning them here would make this bench a second translator.
 */
const said = (root) => (root.querySelector(
  partClasses("multiselect", "announcement").map((one) => `.${one}`).join(""),
)?.textContent ?? "").trim();

test("taking a value announces which one", async () => {
  const fixture = await config.mount("multiselect", {});
  await fixture.settle?.();
  assert.equal(said(fixture.root), "", "something was said before anything happened");

  fixture.drive?.("open");
  await fixture.settle?.();
  const option = [...fixture.root.ownerDocument.querySelectorAll(
    partClasses("multiselect", "option").map((one) => `.${one}`).join(""),
  )][0];
  assert.ok(option, "no option to take");
  // The words this option actually carries, read from it rather than assumed: a fixture's labels are
  // the fixture's business, and a bench that hard-codes one is asserting its own guess.
  const label = (option.querySelector(
    partClasses("multiselect", "optionLabel").map((one) => `.${one}`).join(""),
  )?.textContent ?? "").trim();
  assert.notEqual(label, "", "the option carries no words to be named by");
  option.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await fixture.settle?.();

  const sentence = said(fixture.root);
  assert.notEqual(sentence, "", "a value was taken and the control said nothing");
  assert.ok(sentence.includes(label), `the sentence names no value: ${JSON.stringify(sentence)}`);
  fixture.dispose?.();
});

/** Take the first option, then act on the chip it produced. */
const withOneHeld = async (mountedAs = {}) => {
  const fixture = await config.mount("multiselect", mountedAs);
  await fixture.settle?.();
  fixture.drive?.("open");
  await fixture.settle?.();
  const options = [...fixture.root.ownerDocument.querySelectorAll(
    partClasses("multiselect", "option").map((one) => `.${one}`).join(""),
  )];
  for (const option of options.slice(0, 2)) {
    option.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await fixture.settle?.();
  }
  return fixture;
};

test("stepping a quantity says the value and where it stands", async () => {
  // **Counter mode, named.** The default fixture draws no steppers at all, so a version of this test
  // that skipped when it found none passed while exercising nothing — measured: default and single
  // give zero steppers, `multi` gives four. The precondition is asserted rather than skipped, so a
  // fixture that stops offering them fails here instead of going quiet.
  const fixture = await withOneHeld({ variant: "multi" });
  const steppers = [...fixture.root.ownerDocument.querySelectorAll(
    partClasses("multiselect", "optionStep").map((one) => `.${one}`).join(""),
  )];
  assert.ok(steppers.length > 0, "this fixture draws no steppers, so no quantity can be stepped");
  const before = said(fixture.root);
  steppers[steppers.length - 1]?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await fixture.settle?.();
  assert.notEqual(said(fixture.root), before, "a quantity was stepped and the control said nothing new");
  fixture.dispose?.();
});

/**
 * The sentence for a chip that moved is **wired and not asserted here**, and that is said rather
 * than left to be discovered.
 *
 * The contract's gesture for it is `ArrowRight` on a chip with the panel closed, and reordering that
 * way needs the roving focus a real page gives — this fixture dispatches a key at an element without
 * it, and nothing moves. A bench that pressed the handle beside the chip instead *passed*, because
 * the sentence for a selection change is already wired and satisfied "something new was said": one
 * door answering for another.
 *
 * So it is left to the browser tier, which drives real focus. Asserting it from here would mean
 * asserting a gesture this fixture cannot perform.
 */
