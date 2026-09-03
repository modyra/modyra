/**
 * The radio group and the segmented control, drawn from the contract by one component.
 *
 * Both kinds declare the same anatomy — a repeating `option` holding the native control, the painted
 * check and the option's words — so the component names neither kind. What the two do not share is
 * the *name* of the part carrying the words, and the test that matters here is that the component
 * derived it rather than listing it: the assertion asks the contract for the name and then looks for
 * that class on the page.
 *
 * The count assertion is the one with a defect behind it. A group rendering two choices and one
 * radio button conformed for as long as `repeated` meant "any number" (ADR 0202), and it is exactly
 * the state a person cannot operate: a choice with nothing to press.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h } = await import("vue");
const { MdyOptionField, createVueForm } = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { MDY_WIDGET_CONTRACTS, partClasses, keyBindingFor } = await import("../../widgets/dist/index.js");

const OPTIONS = [{ value: "a", label: "First" }, { value: "b", label: "Second" }];
const KINDS = ["radio", "segmented"];

const draw = (kind) => {
  const form = createVueForm({ value: field(null) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(MdyOptionField, { field: form.f.value, widgetId: "g", kind, label: "Pick", options: OPTIONS }),
  });
  app.mount(host);
  return { host, form, dispose: () => { app.unmount(); host.remove(); } };
};

/** The part carrying an option's words, asked of the contract rather than named here. */
const wordsPart = (kind) => MDY_WIDGET_CONTRACTS[kind].structure.nodes
  .find((node) => node.parent === "option" && node.element === "text").part;

for (const kind of KINDS) {
  test(`${kind}: one control per choice, and it is the declared element`, () => {
    const { host, dispose } = draw(kind);

    const rows = host.querySelectorAll(`.${partClasses(kind, "option")[0]}`);
    const controls = host.querySelectorAll(`.${partClasses(kind, "optionControl")[0]}`);
    assert.equal(rows.length, OPTIONS.length, "a row per choice");
    assert.equal(
      controls.length, rows.length,
      `${controls.length} control(s) for ${rows.length} choice(s): a choice with nothing to press`,
    );
    for (const control of controls) {
      assert.equal(control.tagName, "INPUT", "the contract declares this part a radio");
      assert.equal(control.getAttribute("type"), "radio");
    }
    dispose();
  });

  test(`${kind}: the words are drawn under the name this kind declares for them`, () => {
    const { host, dispose } = draw(kind);

    const words = host.querySelectorAll(`.${partClasses(kind, wordsPart(kind))[0]}`);
    assert.deepEqual(
      [...words].map((element) => element.textContent),
      OPTIONS.map((option) => option.label),
      `the ${wordsPart(kind)} part does not carry the option labels`,
    );
    dispose();
  });

  test(`${kind}: the group is named by what a person reads, not by the field's own name`, () => {
    const { host, dispose } = draw(kind);

    const group = host.querySelector(`.${partClasses(kind, "group")[0]}`);
    const labelledBy = group.getAttribute("aria-labelledby");
    assert.ok(labelledBy, "the group carries no name relation");
    assert.equal(
      host.ownerDocument.getElementById(labelledBy)?.textContent, "Pick",
      "the name resolves to something other than the visible label",
    );
    // `aria-label` would outrank the relation above and win silently: the group announced the
    // schema's field name until the component passed the label the person reads.
    assert.equal(group.getAttribute("aria-label"), null, "a second name overrides the visible one");
    dispose();
  });

  test(`${kind}: the declared arrows are left to the platform, not swallowed`, () => {
    const { host, dispose } = draw(kind);

    // A group of native radios sharing a name is roved by the browser itself. The way a renderer
    // breaks that is by answering the key and cancelling it, which reads as "handled" while moving
    // nothing — and jsdom cannot show the loss, because it does not implement the native behaviour
    // being lost. What it can show is the cancelling, which is the act that would cause it.
    const declared = "ArrowDown";
    assert.equal(keyBindingFor(kind, { key: declared }, false)?.intent, "move",
      `${declared} is no longer declared as a move, so this test asserts nothing`);

    const control = host.querySelector(`.${partClasses(kind, "optionControl")[0]}`);
    const event = new KeyboardEvent("keydown", { key: declared, bubbles: true, cancelable: true });
    control.dispatchEvent(event);

    assert.equal(
      event.defaultPrevented, false,
      `${declared} was cancelled, so the platform's own roving of this radiogroup never happens`,
    );
    dispose();
  });
}
