/**
 * A part no relation names is machinery, and machinery does not stand in the accessibility tree.
 *
 * The colour field draws three things a browser would call a control: a swatch that opens a palette,
 * a box you type a hex value into, and the platform's own colour input behind the swatch. The
 * contract says which of them a person operates — the caption points `for` at the hex input, the
 * swatch points `aria-controls` at the popup — and it says nothing about the third, because there is
 * nothing to say: it is opened by the swatch and never reached directly.
 *
 * Three renderers answered that silence three ways. One hid it, one gave it an English name written
 * beside the resolver, one gave it a different English name — and an auditor was green on the first
 * and critical on the others, which is the whole argument compressed: a control in the tree that
 * nothing describes is a control a reader meets and cannot place.
 *
 * Derived from the relations rather than named here, so a part that gains one stops being covered by
 * this rule without an edit, and a kind that grows an unnamed control is covered without one either.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, MDY_WIDGET_RELATIONS } from "../dist/index.js";

/** Every part some relation names, either as its source or as somewhere a reference lands. */
function partsInARelation(kind) {
  const named = new Set();
  for (const relation of MDY_WIDGET_RELATIONS[kind] ?? []) {
    named.add(relation.from);
    for (const target of relation.to) named.add(target);
  }
  return named;
}

test("the colour field's native input is in no naming relation", () => {
  // The premise, stated so that this file fails rather than silently covers nothing if the contract
  // starts pointing at that part — at which point it is a control and the rule below is wrong for it.
  const named = partsInARelation("colors");
  assert.ok(named.size >= 3, `only ${named.size} parts are in a relation — the derivation has stopped reaching them`);
  assert.ok(!named.has("control"),
    "the contract now points at the colour field's native input, so it is something a person is "
    + "meant to reach and hiding it from a reader is wrong");
  assert.ok(named.has("hexInput"),
    "nothing points at the hex input either, so this kind names no control at all and the comparison "
    + "above says nothing");
});

/**
 * Every part that renders a control, and what names it.
 *
 * A part that renders an `input`, a `select` or a `textarea` is a control a browser puts in the
 * accessibility tree, and a control nothing describes is one a reader meets and cannot place. The
 * contract declares the relations; where it declares none, each renderer decides — which is what
 * produced three answers to one question for the colour field's native input, two of them written in
 * English beside the resolver and one of them the answer an auditor agreed with.
 *
 * Six parts are in that state. One is machinery and is hidden by every renderer; the other five are
 * controls a person types into. The list is recorded rather than asserted away, so it can only get
 * shorter — and each entry says which of the two it is, because they need different answers.
 */
const NAMED_BY_NOBODY = {
  // Machinery. The swatch opens it, a person never reaches it, and all three renderers now keep it
  // out of the tree — which is what the contract's silence about it means.
  "colors.control": "machinery: opened by the swatch, hidden from the tree by every renderer",

  // Controls a person operates, whose naming the contract does not declare. Each renderer decides,
  // and the three have not been compared. This is a gap in the contract rather than in a renderer.
  "select.search": "a box a person types into inside a panel; nothing declares what names it",
  "multiselect.search": "a box a person types into inside a panel; nothing declares what names it",
  "daterange.endControl": "the second of two date boxes; the caption points at the first only",
  "timepicker.hourControl": "one of two spinners; nothing declares what names either",
  "timepicker.minuteControl": "one of two spinners; nothing declares what names either",
};

test("no part renders a control the contract names nobody for, beyond the six recorded", () => {
  const unnamed = [];
  for (const kind of MDY_WIDGET_KINDS) {
    const named = partsInARelation(kind);
    for (const node of MDY_WIDGET_CONTRACTS[kind].structure.nodes) {
      if (!["input", "select", "textarea"].includes(node.element)) continue;
      if (named.has(node.part)) continue;
      unnamed.push(`${kind}.${node.part}`);
    }
  }
  assert.ok(unnamed.length > 0, "every control is in a relation, so this ratchet is measuring nothing");

  assert.deepEqual(unnamed.filter((part) => !(part in NAMED_BY_NOBODY)), [],
    "a part renders a control and no relation names it. Either the contract says what points at it, "
    + "or every renderer decides for itself whether a reader meets it and what they hear");
  // The other direction: an entry that stops being true is a claim about the past, and the only way
  // to know is to run this.
  assert.deepEqual(Object.keys(NAMED_BY_NOBODY).filter((part) => !unnamed.includes(part)), [],
    "a recorded part is now in a relation, so the record is stale — take it out and the rule covers it");
});

/**
 * A part recorded as machinery is a claim that nobody types there.
 *
 * Without this the ratchet can shorten by *reclassification* rather than by repair: a gap moved into
 * the machinery column stops being counted, and the entry that excuses it is a sentence nothing
 * checks. So the claim is held to the contract — machinery is a part no relation names *and* a part
 * no renderer offers as a stop for the keyboard.
 *
 * Read from the three renderers' own output rather than from their source, because "is this
 * focusable" is a question about a page. A part drawn with a positive tab index somewhere is a part a
 * person reaches, whatever this file calls it.
 */
test("what is recorded as machinery is reachable by nobody", async () => {
  const machinery = Object.entries(NAMED_BY_NOBODY)
    .filter(([, why]) => why.startsWith("machinery"))
    .map(([part]) => part);
  assert.ok(machinery.length > 0, "nothing is recorded as machinery, so this asserts nothing");

  const { installDomGlobals } = await import("../../plain/test/support/dom-env.mjs");
  installDomGlobals();
  const { mountMdyForm } = await import("../../plain/dist/index.js");

  for (const entry of machinery) {
    const [kind, part] = entry.split(".");
    const host = document.createElement("div");
    document.body.append(host);
    const { reactivity, dispose } = mountMdyForm(
      host,
      [{ name: "f", kind, label: "F", options: [{ value: "a", label: "A" }] }],
      { submitLabel: null },
    );
    await reactivity.flush();

    const classes = MDY_WIDGET_CONTRACTS[kind].parts[part]?.classes ?? [];
    assert.ok(classes.length > 0, `${entry}: the contract gives this part no class, so it cannot be found`);
    const drawn = host.querySelector(`.${classes[0]}`);
    assert.ok(drawn !== null, `${entry}: recorded as machinery and not on the page, so the claim is untested`);
    assert.notEqual(drawn.getAttribute("tabindex"), "0",
      `${entry} is recorded as machinery and the keyboard stops on it. Either it is a control and the `
      + "contract owes a relation saying what names it, or the tab index is wrong");

    dispose?.();
    host.remove();
  }
});
