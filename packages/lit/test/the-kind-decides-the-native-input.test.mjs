/**
 * A text-like control asks the platform for the input its kind declares.
 *
 * `text`, `email` and `password` share one anatomy and differ in exactly one thing: the native input
 * they want. The contract states it — `controlType` — and this element used to ignore it, taking the
 * answer from an attribute the host wrote by hand and defaulting to `"text"` when the host wrote
 * nothing.
 *
 * The cost was silent. An email field whose author forgot the attribute rendered as plain text: no
 * email keyboard on a phone, none of the platform's own handling, and nothing anywhere saying so.
 * That is the shape of defect this asserts against — not a crash, a quiet downgrade.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals, mount } from "./support/dom-env.mjs";

installDomGlobals();
const { createLitForm, field } = await import("../dist/adapter.js");
const { defineMdyElements } = await import("../dist/ui.js");
const { MDY_WIDGET_CONTRACTS } = await import("../../widgets/dist/index.js");

defineMdyElements();

const drawn = async (props) => {
  const form = createLitForm({ n: field("") });
  const element = await mount("mdy-text-field", (el) => {
    el.field = form.f.n;
    Object.assign(el, props);
  });
  return element.querySelector("input");
};

for (const kind of ["text", "email", "password"]) {
  test(`${kind}: the native input is the one the contract declares`, async () => {
    // Read from the catalogue rather than written here: a kind whose declaration changes moves this
    // expectation with it, instead of leaving a spelled-out copy behind to disagree.
    const declared = MDY_WIDGET_CONTRACTS[kind].controlType;
    assert.ok(declared, `${kind} declares no controlType, so this test asserts nothing`);

    const input = await drawn({ kind });

    assert.ok(input, "the element drew no input at all");
    assert.equal(
      input.getAttribute("type"), declared,
      `a ${kind} field asked the platform for "${input.getAttribute("type")}" instead of "${declared}"`,
    );
  });
}

test("a host that names no kind still gets a text input", async () => {
  // The default a host had before the kind could be named, kept: nothing that worked stops working.
  const input = await drawn({});
  assert.equal(input.getAttribute("type"), "text");
});

test("an explicit type is still the host's to give", async () => {
  // The catalogue answers when nobody said otherwise; it does not overrule a host that has a reason
  // the catalogue does not know.
  const input = await drawn({ kind: "email", type: "url" });
  assert.equal(input.getAttribute("type"), "url", "the explicit attribute stopped being an override");
});
