/**
 * The parts that must say whether they can act, published so a renderer can obey them.
 *
 * `MDY_ARIA_DISABLED_PARTS` names the few parts drawn at all times that are not natively disabled: a
 * button that stays on the page whether or not it can do anything owes a reader that answer, and no
 * `disabled` attribute is carrying it. The DOM contract has always refused a page that omits it.
 *
 * **It was enforced and unreadable.** Until it was exported, every adapter had to know the three
 * names by heart — a rule declared in one place and obeyed from memory in four, which is the shape
 * this contract exists to remove. The check below is deliberately about the list's *properties*
 * rather than its contents: pinning the three names here would be the fifth copy.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MDY_ARIA_DISABLED_PARTS, MDY_WIDGET_CONTRACTS } from "../dist/index.js";

test("every entry names a part its kind actually declares", () => {
  assert.ok(MDY_ARIA_DISABLED_PARTS.length > 0, "the list is empty, so nothing below is about a rule");

  for (const entry of MDY_ARIA_DISABLED_PARTS) {
    const [kind, part] = entry.split(".");
    assert.ok(kind in MDY_WIDGET_CONTRACTS, `${entry} names a kind the catalogue does not have`);
    assert.ok(part in MDY_WIDGET_CONTRACTS[kind].parts, `${entry} names a part ${kind} does not declare`);
  }
});

test("every entry is a part drawn at all times, which is why it owes the answer", () => {
  // The rule is for parts that are always on the page: one that comes and goes says it cannot act by
  // not being there. An optional part in this list would be asking for an attribute nobody can see.
  for (const entry of MDY_ARIA_DISABLED_PARTS) {
    const [kind, part] = entry.split(".");
    const node = MDY_WIDGET_CONTRACTS[kind].structure.nodes.find((one) => one.part === part);
    // Asserted as "not optional" rather than "undefined": the catalogue states the field as `false`
    // rather than omitting it, and a check reading absence would fail on a declaration that says the
    // same thing out loud.
    assert.notEqual(node?.optional, true, `${entry} is declared optional, so it can answer by being absent`);
  }
});

test("the list stays narrow, because most parts are natively disabled instead", () => {
  // ADR 0171 records why: twenty-one parts declare `disabled` among their states and most are native
  // controls, so keying the exemption on that would give the whole contract away. A list that grew to
  // that size would have stopped meaning "these few are the exception".
  const declaringDisabled = Object.entries(MDY_WIDGET_CONTRACTS)
    .flatMap(([kind, contract]) => Object.entries(contract.parts)
      .filter(([, part]) => (part.states ?? []).includes("disabled"))
      .map(([name]) => `${kind}.${name}`));

  assert.ok(
    MDY_ARIA_DISABLED_PARTS.length < declaringDisabled.length,
    `the exemption list (${MDY_ARIA_DISABLED_PARTS.length}) is no longer narrower than the parts that `
    + `declare a disabled state (${declaringDisabled.length}), so it has stopped being an exception`,
  );
});
