/**
 * A part declared present when the field holds a value, held to it in the page.
 *
 * The contract says `presentWhen` and a renderer either honours it or does not; nothing was asking.
 * These two conditions are the ones a page can settle without ambiguity — mount with nothing, mount
 * with something, and the part has to appear on one side and not the other.
 *
 * The parts are read from the contract rather than listed here. A list would go stale the day a kind
 * gains one, and staleness in this direction is silent: the check keeps passing while covering less.
 *
 * Presence is read as **shown**, not as present in the DOM. This renderer builds a part once and
 * hides it, so `querySelector` finds an element that a person cannot see, and a probe counting nodes
 * reports every one of these as always-present. It lied that way twice before this file existed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { MDY_WIDGET_CONTRACTS } = await import("../../widgets/dist/index.js");

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

/** A kind this renderer can mount, and a value it accepts. */
const WITH_A_VALUE = {
  multiselect: { options: OPTIONS, initialValue: ["a"] },
  // The combobox, which is the shape that has a `value` part to follow: the chooser the platform
  // draws shows what it holds itself, with no element of its own for the text. ADR 0176.
  select: { options: OPTIONS, searchable: true, initialValue: "a" },
};

/**
 * The parts of a page whose class vocabulary reaches them and nothing else.
 *
 * `option` and `chip` both carry `mdy-chip` — one in the popup's grid, one in the value strip — and
 * `optionLabel` reaches a chip's label the same way. A lookup by class answers for whichever comes
 * first and calls it either.
 *
 * Measured on the page rather than derived from the class lists: the overlaps are structural, one
 * part's selector reaching elements that belong to another, and comparing the declarations misses
 * that shape. A reading that cannot tell two parts apart must not become an assertion about one of
 * them, and resolving it with a scoped selector would put a copy of the renderer's containment in
 * this file, to be kept in step by hand.
 */
function unambiguouslyShown(host, kind) {
  const reached = new Map();
  for (const [part, contract] of Object.entries(MDY_WIDGET_CONTRACTS[kind].parts)) {
    if (contract.classes.length === 0) continue;
    const found = [...host.querySelectorAll(contract.classes.map((one) => `.${one}`).join(""))];
    if (found.length > 0) reached.set(part, found);
  }
  const shown = new Set();
  for (const [part, found] of reached) {
    const alsoReached = [...reached].some(([other, theirs]) =>
      other !== part && theirs.some((element) => found.includes(element)));
    if (alsoReached) continue;
    if (found.some((element) => !element.hidden)) shown.add(part);
  }
  return shown;
}

function shownParts(kind, extra) {
  const host = document.createElement("div");
  document.body.append(host);
  const form = mountMdyForm(host, [{ name: "f", kind, label: "F", ...extra }], { submitLabel: null });
  const shown = unambiguouslyShown(host, kind);
  form.dispose();
  host.remove();
  return shown;
}

for (const [kind, withValue] of Object.entries(WITH_A_VALUE)) {
  const nodes = MDY_WIDGET_CONTRACTS[kind].structure.nodes;
  const follows = (condition) =>
    nodes.filter((node) => node.presentWhen === condition).map((node) => node.part);

  test(`${kind}: a part present when there is a value is absent when there is none`, () => {
    const wanted = follows("valueIsPresent");
    assert.ok(wanted.length > 0, `${kind} declares no part as valueIsPresent — this asserts nothing`);
    const { options, initialValue: _drop, ...empty } = withValue;
    const atRest = shownParts(kind, { ...empty, ...(options ? { options } : {}) });
    const holding = shownParts(kind, withValue);

    // Asserted for every declared part, not only the ones the page happens to show when holding a
    // value. Skipping the others reads like tolerance for a renderer that draws them another way,
    // and it is not: it also swallows a declaration written the wrong way round, which is the defect
    // this check exists to catch. A part claimed to follow the value must not be on screen without
    // one, whatever it does with one.
    for (const part of wanted) {
      assert.equal(atRest.has(part), false,
        `${kind}.${part} is declared present when the field holds a value, and is on screen with none`);
    }
    assert.ok(wanted.some((part) => holding.has(part)),
      `${kind}: none of ${wanted.join(", ")} was shown even with a value — the fixture never reached `
      + "the state this check is about, so the assertions above passed on an empty page");
  });

  test(`${kind}: a part present when there is no value is absent once there is one`, () => {
    const wanted = follows("valueIsAbsent");
    if (wanted.length === 0) return;
    const { options, initialValue: _drop, ...empty } = withValue;
    const atRest = shownParts(kind, { ...empty, ...(options ? { options } : {}) });
    const holding = shownParts(kind, withValue);

    for (const part of wanted) {
      assert.equal(atRest.has(part), true,
        `${kind}.${part} is declared present when the field holds no value, and is not on screen`);
      assert.equal(holding.has(part), false,
        `${kind}.${part} stayed on screen once the field held a value — a placeholder beside the `
        + "thing it stands in for");
    }
  });
}

/**
 * The other direction, and the one that cannot be escaped by weakening a declaration.
 *
 * The checks above hold the page to what the contract says. On their own they are half a guard: a
 * part declared `valueIsPresent` and then re-declared as something else leaves the set they look at
 * and passes, which is how a wrong declaration slips past a check written from the declaration's
 * side. So this reads the page first — a part that appears only once the field holds a value — and
 * asks the contract what it says about it.
 */
for (const [kind, withValue] of Object.entries(WITH_A_VALUE)) {
  test(`${kind}: a part the page shows only with a value is declared that way`, () => {
    const { options, initialValue: _drop, ...empty } = withValue;
    const atRest = shownParts(kind, { ...empty, ...(options ? { options } : {}) });
    const holding = shownParts(kind, withValue);
    const declared = new Map(
      MDY_WIDGET_CONTRACTS[kind].structure.nodes.map((node) => [node.part, node.presentWhen]),
    );

    // Only the optional ones. A required part carries no condition by design — the contract has six
    // kinds declaring a required part inside an optional popup, and `optionLabel` is one: it is
    // always there while its option is, and asking what state brings it about has no answer.
    const optional = new Set(MDY_WIDGET_CONTRACTS[kind].structure.nodes
      .filter((node) => node.optional === true).map((node) => node.part));
    const followsTheValue = [...holding].filter((part) => !atRest.has(part) && optional.has(part));
    assert.ok(followsTheValue.length > 0,
      `${kind}: no part appeared when the field took a value, so this check saw nothing`);
    for (const part of followsTheValue) {
      assert.equal(declared.get(part), "valueIsPresent",
        `${kind}.${part} appears only once the field holds a value and the contract says `
        + `"${declared.get(part) ?? "nothing"}". A renderer reading that builds it at the wrong moment`);
    }
  });
}
