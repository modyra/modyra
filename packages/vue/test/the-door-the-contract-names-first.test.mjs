/**
 * The door the contract names first is a door.
 *
 * `MDY_POPUP_OPENERS` declares the *control* as the opener for these kinds, with the toggle beside it
 * as `alsoOpensFrom` — a second way in, not the way in. Drawn without a handler, the declared one was
 * dead: a person pressing the field got nothing, and only the small button beside it worked.
 *
 * It hid well. Every bench that opens one of these presses `button[aria-expanded]`, because that is
 * what opens *some* kind everywhere — so the door that was working was the only one anyone tried. It
 * surfaced when a peer's probe pressed `button, input`, landed on the control, and read a panel that
 * had never opened as a state.
 *
 * **By key as well as by pointer**: a control that opens only under a pointer is one a keyboard
 * cannot reach the panel through at all. Which key is asked of the contract rather than named here.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { MDY_POPUP_OPENERS, MDY_WIDGET_KEYBOARD, partClasses } = await import("../../widgets/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

const CASES = [
  { kind: "datepicker", component: () => m.MdyDatepickerField, empty: null },
  { kind: "timepicker", component: () => m.MdyTimepickerField, empty: null },
];

const draw = async (testCase) => {
  const form = m.createVueForm({ value: field(testCase.empty) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(testCase.component(), { field: form.f.value, widgetId: `o-${testCase.kind}`, label: "When" }),
  });
  app.mount(host);
  await settle();
  return { host, dispose: () => { app.unmount(); host.remove(); document.body.innerHTML = ""; } };
};

for (const testCase of CASES) {
  test(`${testCase.kind}: a press on the part the contract names as opener opens it`, async () => {
    const declared = MDY_POPUP_OPENERS[testCase.kind]?.opener;
    assert.ok(declared, `${testCase.kind} declares no opener, so this test is about a rule that has moved`);

    const view = await draw(testCase);
    try {
      const opener = view.host.querySelector(`.${partClasses(testCase.kind, declared)[0]}`);
      assert.ok(opener, `${testCase.kind} drew no ${declared}`);
      assert.equal(opener.getAttribute("aria-expanded"), "false", "it was open before anything was pressed");

      opener.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await settle();
      assert.equal(
        opener.getAttribute("aria-expanded"), "true",
        `${testCase.kind}: the contract names ${declared} as the opener and pressing it does nothing`,
      );
    } finally {
      view.dispose();
    }
  });

  test(`${testCase.kind}: the key the contract declares opens it too`, async () => {
    const declared = MDY_POPUP_OPENERS[testCase.kind]?.opener;
    // Asked of the table, so the day the kind declares another key this follows without an edit.
    const opens = (MDY_WIDGET_KEYBOARD[testCase.kind] ?? [])
      .find((binding) => binding.intent === "open" && binding.when !== "open");
    assert.ok(opens, `${testCase.kind} declares no key that opens it, so there is nothing to press`);

    const view = await draw(testCase);
    try {
      const opener = view.host.querySelector(`.${partClasses(testCase.kind, declared)[0]}`);
      opener.dispatchEvent(new window.KeyboardEvent("keydown", { key: opens.key, bubbles: true, cancelable: true }));
      await settle();
      assert.equal(
        opener.getAttribute("aria-expanded"), "true",
        `${testCase.kind}: ${opens.key} is declared to open it and the keyboard cannot reach the panel`,
      );
    } finally {
      view.dispose();
    }
  });
}
