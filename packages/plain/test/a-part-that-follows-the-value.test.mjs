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
  select: { options: OPTIONS, initialValue: "a" },
};

function shownParts(kind, extra) {
  const host = document.createElement("div");
  document.body.append(host);
  const form = mountMdyForm(host, [{ name: "f", kind, label: "F", ...extra }], { submitLabel: null });
  const shown = new Set();
  for (const [part, contract] of Object.entries(MDY_WIDGET_CONTRACTS[kind].parts)) {
    const selector = contract.classes.map((one) => `.${one}`).join("");
    if (selector === "") continue;
    const element = host.querySelector(selector);
    if (element && !element.hidden) shown.add(part);
  }
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
