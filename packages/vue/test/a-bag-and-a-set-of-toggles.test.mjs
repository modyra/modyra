/**
 * The multiselect in both of its shapes, and the two rules that only this kind can exercise.
 *
 * `single` is a set of toggles; `multi` is a bag, where a choice can be taken more than once and
 * every row owes a stepper and a count. Which parts a shape owes is the contract's answer, read here
 * rather than listed, so a variant that grows a part is asserted without editing this file.
 *
 * The mode is a closed set of two. A value outside it produces a variant name the catalogue does not
 * declare, and an undeclared variant means *no* requirements rather than a refusal — the checks for
 * the shape quietly stop applying. That is asserted too, because it is invisible from the page.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h } = await import("vue");
const { MdyMultiselectField, createVueForm } = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { MDY_WIDGET_CONTRACTS, partClasses, keyBindingFor, variantOf } =
  await import("../../widgets/dist/index.js");

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const cls = (part) => partClasses("multiselect", part)[0];

const draw = (mode) => {
  const form = createVueForm({ value: field([]) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(MdyMultiselectField, { field: form.f.value, widgetId: "m", label: "Pick", options: OPTIONS, mode }),
  });
  app.mount(host);
  return { host, form, trigger: host.querySelector(`.${cls("trigger")}`), dispose: () => { app.unmount(); host.remove(); } };
};

const open = async (fixture) => { fixture.trigger.click(); await settle(); };

for (const mode of ["single", "multi"]) {
  test(`${mode}: every part this shape owes is on the page`, async () => {
    const fixture = draw(mode);
    await open(fixture);

    // Read from the variant, not listed here: the shape that grows a part is checked for it without
    // this file being touched.
    const owed = MDY_WIDGET_CONTRACTS.multiselect.variants[mode].required;
    assert.ok(owed.length > 0, `the ${mode} shape declares nothing, so this test asserts nothing`);
    for (const part of owed) {
      assert.ok(
        fixture.host.querySelector(`.${cls(part)}`),
        `the ${mode} shape owes ${part} and the page has none`,
      );
    }
    fixture.dispose();
  });
}

test("the mode names a shape the catalogue declares", () => {
  // A mode outside the two produces a variant name with no entry in the catalogue, and an absent
  // entry reads downstream as "no requirements" — the shape's checks stop applying, silently.
  for (const mode of ["single", "multi"]) {
    assert.ok(
      MDY_WIDGET_CONTRACTS.multiselect.variants[variantOf("multiselect", { mode })],
      `mode "${mode}" resolves to a variant the catalogue does not declare`,
    );
  }
});

test("multi: a key on the active row changes its quantity", async () => {
  const fixture = draw("multi");
  await open(fixture);

  // The steppers sit on a row, so a tab stop cannot name which row it reaches — only a key pressed
  // on the active one can. That is why this key exists at all.
  // Declared *on the option*, which is what makes it a per-row key: asked at the control it does
  // not exist, so a renderer that only ever asks the control never sees it.
  assert.equal(keyBindingFor("multiselect", { key: "ArrowRight" }, true, "option")?.intent, "step",
    "ArrowRight on an option is no longer the declared per-row step");
  assert.equal(keyBindingFor("multiselect", { key: "ArrowRight" }, true), null,
    "ArrowRight now means something at the control too, so this key no longer tells the two apart");

  // A person reaches a row with the arrows, and the reading position is what the step acts on —
  // pressing the key with no active row is a press aimed at nothing, which is exactly why a tab
  // stop could not have carried this act.
  // Pressed from inside the widget, not on the box it was mounted into: the handler is on the
  // component's own root, and an event dispatched on an ancestor never travels down to it — a
  // press aimed at the container is a press this field never hears.
  const press = async (key) => {
    fixture.trigger.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    await settle();
  };
  await press("ArrowDown");
  const before = fixture.host.querySelector(`.${cls("optionCount")}`).textContent;

  await press("ArrowRight");

  assert.notEqual(
    fixture.host.querySelector(`.${cls("optionCount")}`).textContent, before,
    "the declared key did not change the quantity of the active row",
  );
  fixture.dispose();
});

test("the always-drawn actions say whether they can act, and stay on the page", async () => {
  const fixture = draw("single");

  // Drawn at all times, so they must say it with `aria-disabled` — which leaves them in the reading
  // order — rather than with `disabled`, which removes them the moment there is nothing to do. A
  // control that comes and goes moves the one beside it under the hands of somebody aiming at it.
  for (const part of ["wayBackAction", "clearAll"]) {
    const element = fixture.host.querySelector(`.${cls(part)}`);
    assert.ok(element, `${part} is not on the page`);
    assert.equal(element.getAttribute("aria-disabled"), "true", `${part} does not say it cannot act`);
    assert.equal(element.hasAttribute("hidden"), false, `${part} takes itself off the page`);
    assert.equal(element.hasAttribute("disabled"), false,
      `${part} uses disabled, so it leaves the reading order when there is nothing to do`);
  }
  fixture.dispose();
});
