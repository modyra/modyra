/**
 * The multiselect's two modes are two shapes, and the catalogue says which parts each owes.
 *
 * `single` is a set of toggles: each choice is a button wearing a check. `multi` is a bag, where a
 * choice can be taken more than once, so each row owes a stepper and a count — and its option is a
 * container rather than a button, because a button inside a button is not a thing a browser will
 * render.
 *
 * The kit mounts one variant per kind, so the mode it does not mount is the one nothing would ever
 * ask about. What is asserted here is read from the catalogue's own variant declaration rather than
 * listed: a part added to a mode arrives in this test without it being edited, which is the
 * difference between checking the contract and checking a copy of it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { MdyMultiselectField, createForm, field } = await import("../dist/index.js");
const { MDY_WIDGET_CONTRACTS, defaultOptionKey } = await import("@modyra/widgets");

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const OPTIONS = [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }];
const VARIANTS = MDY_WIDGET_CONTRACTS.multiselect.variants;
const classOf = (part) => MDY_WIDGET_CONTRACTS.multiselect.parts[part].classes[0];

const draw = async ({ mode = "single", options = OPTIONS, widgetId = `m-${mode}` } = {}) => {
  const host = document.createElement("div");
  document.body.append(host);
  const form = createForm({ value: field([]) });
  const root = createRoot(host);
  root.render(React.createElement(MdyMultiselectField, {
    field: form.f.value, options, label: "Pick", widgetId, mode, searchable: true,
  }));
  await settle();
  return {
    host, form,
    panel: () => document.getElementById(`${widgetId}__popup`) ?? document.body.querySelector(`.${classOf("popup")}`),
    trigger: () => host.querySelector(`.${classOf("trigger")}`),
    dispose: () => { root.unmount(); host.remove(); },
  };
};

const withField = async (options, body) => {
  const view = await draw(options);
  try { await body(view); } finally { view.dispose(); }
};

for (const mode of Object.keys(VARIANTS)) {
  test(`${mode}: every part the variant requires is on a row`, async () => {
    await withField({ mode }, async (view) => {
      view.trigger().click();
      await settle();
      const panel = view.panel();
      assert.ok(panel, `${mode} drew no panel`);
      for (const part of VARIANTS[mode].required) {
        assert.ok(
          panel.querySelector(`.${classOf(part)}`),
          `${mode} declares ${part} and no row has one`,
        );
      }
      // And not the other mode's: a component drawing both would satisfy the check above while
      // putting parts on the page that this mode does not declare.
      const other = mode === "single" ? "multi" : "single";
      for (const part of VARIANTS[other].required) {
        assert.equal(panel.querySelector(`.${classOf(part)}`), null, `${mode} drew ${other}'s ${part}`);
      }
    });
  });
}

test("a bag's option is a container, a set's is a button", async () => {
  for (const [mode, expected] of [["single", "BUTTON"], ["multi", "DIV"]]) {
    await withField({ mode }, async (view) => {
      view.trigger().click();
      await settle();
      const row = view.panel().querySelector(`.${classOf("optionWrapper")}`);
      const option = row.firstElementChild;
      assert.equal(option.tagName, expected, `${mode} drew its option as a ${option.tagName}`);
    });
  }
});

test("stepping a row's quantity does not also toggle the row", async () => {
  await withField({ mode: "multi" }, async (view) => {
    view.trigger().click();
    await settle();
    const [less, more] = view.panel().querySelectorAll(`.${classOf("optionStep")}`);
    assert.ok(more, "no stepper to press");

    more.click();
    await settle();
    // One press, one increment. A press that also reached the row would toggle the choice off and
    // leave the count where it was — the count is what says which of the two happened.
    assert.equal(view.panel().querySelector(`.${classOf("optionCount")}`).textContent, "1");
    more.click();
    await settle();
    assert.equal(view.panel().querySelector(`.${classOf("optionCount")}`).textContent, "2");
    less.click();
    await settle();
    assert.equal(view.panel().querySelector(`.${classOf("optionCount")}`).textContent, "1");
  });
});

test("the way back and the way to clear are there before there is anything to undo", async () => {
  await withField({}, async (view) => {
    const undo = view.host.querySelector(`.${classOf("wayBackAction")}`);
    const clear = view.host.querySelector(`.${classOf("clearAll")}`);
    assert.ok(undo && clear, "a control that appears only once something is lost is one nobody knows is there");
    // Said with `aria-disabled`, which leaves them in the reading order: a control that comes and
    // goes moves the one beside it under the hands of somebody aiming at it.
    assert.equal(undo.getAttribute("aria-disabled"), "true");
    assert.equal(clear.getAttribute("aria-disabled"), "true");
    assert.equal(undo.hasAttribute("disabled"), false);
    assert.equal(clear.hasAttribute("disabled"), false);
  });
});

test("object-valued choices are chips of their own", async () => {
  const options = [{ value: { id: 1 }, label: "One" }, { value: { id: 2 }, label: "Two" }];
  await withField({ options, widgetId: "m-obj" }, async (view) => {
    view.trigger().click();
    await settle();
    const rows = view.panel().querySelectorAll(`.${classOf("optionWrapper")}`);
    assert.equal(rows.length, 2);
    rows[1].firstElementChild.click();
    await settle();
    assert.deepEqual(view.form.f.value.value(), [options[1].value]);
    const chips = view.host.querySelectorAll(`.${classOf("chip")}`);
    assert.equal(chips.length, 1, "one choice held, and the chips do not agree");
    assert.equal(defaultOptionKey(options[1].value) !== defaultOptionKey(options[0].value), true);
  });
});
