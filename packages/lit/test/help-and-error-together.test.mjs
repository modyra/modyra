/**
 * A field showing help *and* an error at once, which no fixture had.
 *
 * The conformance kit checks that parts appear in the order the contract declares. It cannot check
 * an order between two elements when a fixture never puts both on the page — so `checkbox` and
 * `toggle` rendered their error list above their supporting text, against the contract, and every
 * suite was green. Restoring the wrong order after the fix changed nothing anywhere, which is how
 * this file came to exist: a repair nothing guards is a repair that comes back.
 *
 * Order is read from the contract rather than written here. A fixture that restates the answer it is
 * checking passes when the contract moves and the renderer does not.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field, required } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
const { MDY_WIDGET_CONTRACTS } = await import("../../widgets/dist/index.js");

defineMdyElements();

const ELEMENTS = [
  ["mdy-text-field", "text", ""],
  ["mdy-textarea-field", "textarea", ""],
  ["mdy-number-field", "number", null],
  ["mdy-checkbox-field", "checkbox", false],
  ["mdy-toggle-field", "toggle", false],
  ["mdy-radio-group-field", "radio", null],
  ["mdy-segmented-field", "segmented", null],
  ["mdy-select-field", "select", null],
];

/** The kinds whose element needs options before it will render anything to order. */
const NEEDS_OPTIONS = new Set(["radio", "segmented", "select"]);

/** Where the contract puts each part among its siblings under the same parent. */
function declaredOrder(kind, part) {
  const node = MDY_WIDGET_CONTRACTS[kind].structure.nodes.find((one) => one.part === part);
  assert.ok(node, `${kind} declares no ${part}`);
  return node.order;
}

for (const [tag, kind, initial] of ELEMENTS) {
  test(`<${tag}> puts its help and its error in the order the ${kind} contract declares`, async () => {
    const form = createLitForm({ value: field(initial, [required()]) });
    const element = await mount(tag, (el) => {
      el.field = form.f.value;
      el.label = "Label";
      el.supportingText = "Massimo 200 caratteri";
      if (NEEDS_OPTIONS.has(kind)) el.options = [{ value: "x", label: "X" }];
    });
    // Touched, because an untouched field holds its verdict back — which is the rule this fixture
    // has to get past to put a message and a help line on the page at the same time.
    form.f.value.markAsTouched();
    element.requestUpdate();
    await element.updateComplete;

    const help = element.querySelector(".mdy-supporting-text");
    const errors = element.querySelector(".mdy-control__errors");
    assert.ok(help, `${kind}: the fixture asked for supporting text and none was rendered — this `
      + "check cannot see an order between one element and nothing");
    assert.ok(errors, `${kind}: the field is required, empty and touched, and rendered no error list`);

    const helpFirst = declaredOrder(kind, "supportingText") < declaredOrder(kind, "errors");
    // `compareDocumentPosition` rather than index arithmetic: the two may hang off different parents.
    const inThatOrder = Boolean(
      help.compareDocumentPosition(errors) & 0x04 /* DOCUMENT_POSITION_FOLLOWING */,
    );
    assert.equal(inThatOrder, helpFirst,
      `${kind} renders its error list ${inThatOrder ? "after" : "before"} its supporting text, and `
      + `the contract declares ${helpFirst ? "help first" : "errors first"}`);
  });
}
