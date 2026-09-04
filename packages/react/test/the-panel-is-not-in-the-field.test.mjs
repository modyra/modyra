/**
 * React's select, in both of the shapes the contract says it has.
 *
 * `variantOf` answers `native` for a select that does not filter and `custom` for one that does, and
 * they are not one control with an option on it: one is the platform's chooser, which owns its own
 * list and its own keyboard, and the other is a combobox this package draws. A component that drew
 * the combobox for both would put `aria-expanded` on a `<select>` and describe a popup that is not
 * there.
 *
 * The panel is drawn in the document body (ADR 0130), so the assertions that matter here are the
 * ones a reading gets wrong: the panel is *not* inside the field element, and it is still the thing
 * the trigger names. A test scoped to the field root would report the parts of an open panel as
 * missing, which is exactly how a portal is mistaken for a renderer that drew nothing.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { MdySelectField, createForm, field } = await import("../dist/index.js");
const { focusPartOnOpen, defaultWidgetIdFactory } = await import("@modyra/widgets");

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const OPTIONS = [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }];

/**
 * One mounted select, and it is always taken down.
 *
 * A widget left in the document by a failing assertion is not a tidiness problem: ids repeat, and
 * `getElementById` answers with the first match, so the *next* test drives the corpse of the last
 * one. That is how the first version of this file reported a panel that would not close.
 */
const withSelect = async (options, body) => {
  const view = await draw(options);
  try {
    await body(view);
  } finally {
    view.dispose();
  }
};

const draw = async ({ searchable = true, widgetId = "s" } = {}) => {
  const host = document.createElement("div");
  document.body.append(host);
  const form = createForm({ value: field(null) });
  const root = createRoot(host);
  root.render(React.createElement(MdySelectField, {
    field: form.f.value, options: OPTIONS, label: "Pick", widgetId, searchable,
  }));
  await settle();
  const fieldRoot = host.firstElementChild;
  return {
    host, form, fieldRoot,
    trigger: () => fieldRoot.querySelector("[aria-expanded], select"),
    // Found the way the contract finds it: the trigger says what it controls, and that name is what
    // light dismissal follows out of the field. A lookup by class would find the panel of whichever
    // select was drawn first.
    named: () => document.getElementById(fieldRoot.querySelector("[aria-controls]")?.getAttribute("aria-controls") ?? ""),
    dispose: () => { root.unmount(); host.remove(); },
  };
};

const press = (element, key) => {
  element.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
};

test("the panel is outside the field and still the thing the trigger names", async () => {
  await withSelect({}, (view) => {
    const named = view.named();
    assert.ok(named, "the trigger names something the document does not have");
    assert.equal(view.fieldRoot.contains(named), false, "the panel is inside the field it must escape");
    assert.equal(document.body.contains(named), true, "the panel left the document altogether");
  });
});

test("opening puts focus where the contract says", async () => {
  const part = focusPartOnOpen("select", { searchable: true });
  assert.ok(part, "the contract names no landing place, so this test has nothing to check");
  await withSelect({}, async (view) => {
    view.trigger().click();
    await settle();
    assert.equal(view.trigger().getAttribute("aria-expanded"), "true");
    assert.equal(document.activeElement.id, defaultWidgetIdFactory.part("s", part));
  });
});

/**
 * This one turns red slowly, and that is worth knowing before someone debugs the clock instead.
 *
 * Measured with the defect planted — the lookup made to answer `undefined` for the trigger, which is
 * what this component looked like before it had one: the panel still shuts, the assertions are never
 * reached, and the file fails after about ninety seconds with "test failed" and no reason. A
 * per-test `timeout` does not bound it, because the stall is in the run draining rather than in the
 * body. So the check does catch the defect, and it reports it badly; what it is not is a slow test
 * on a green tree, where it costs under a second.
 */
test("Escape stays on the control, Tab does not", async () => {
  await withSelect({}, async (view) => {
  view.trigger().click();
  await settle();

  press(document.activeElement, "Escape");
  await settle();
  assert.equal(view.trigger().getAttribute("aria-expanded"), "false", "Escape left the panel open");
  assert.equal(document.activeElement, view.trigger(), "Escape did not leave the person on the control");

  view.trigger().click();
  await settle();
  press(document.activeElement, "Tab");
  await settle();
  assert.equal(view.trigger().getAttribute("aria-expanded"), "false", "Tab left the panel open");
  // Focus is on its way somewhere; pulling it back would strand a person on the field they left.
  assert.notEqual(document.activeElement, view.trigger(), "Tab pulled focus back onto the control");
  });
});

test("a select that does not filter is the platform's chooser, and claims nothing else", async () => {
  await withSelect({ searchable: false, widgetId: "n" }, (view) => {
  const control = view.fieldRoot.querySelector("select");
  assert.ok(control, "a select that does not filter drew no native chooser");
  for (const claim of ["aria-expanded", "aria-controls", "aria-haspopup"]) {
    assert.equal(control.getAttribute(claim), null, `the chooser claims ${claim}, describing a popup that is not there`);
  }
  // Without an entry for "nothing chosen", index 0 is a real choice: the control reads the first
  // label while the form holds nothing, and the field looks answered when it is not.
  assert.equal(control.options[0].value, "");
  assert.equal(control.value, "");
  assert.equal(view.form.f.value.value(), null);
  });
});
