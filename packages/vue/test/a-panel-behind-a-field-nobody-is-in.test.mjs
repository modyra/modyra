/**
 * A panel closes when the keyboard settles outside the widget.
 *
 * Every kind with a popup declares `dismissOnFocusOutside`, and this package honoured it nowhere: a
 * panel left open behind a field somebody has tabbed away from covers the next question and answers
 * to a keyboard that has gone elsewhere.
 *
 * **Where focus landed, not where it left.** A departure names nowhere, and a panel that repaints —
 * a calendar swapping its grid for its months — destroys the element holding focus and fires one.
 * Bound that way, opening the month view closes the calendar it belongs to, which is why the rule is
 * written on arrival and why this bench moves focus somewhere real.
 *
 * **Inside the panel is inside the widget**, though the panel is drawn outside the field: the
 * contract follows what the opener names. A check written as `contains` on the field would shut the
 * panel the moment a person reached the thing they opened it for.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { createApp, h, nextTick } = await import("vue");
const m = await import("../dist/index.js");
const { field } = await import("../../core/dist/index.js");
const { MDY_WIDGET_CONTRACTS, partClasses } = await import("../../widgets/dist/index.js");

const settle = async () => { await nextTick(); await new Promise((resolve) => setTimeout(resolve, 20)); };

const CASES = [
  { kind: "select", component: () => m.MdySelectField, empty: null, extra: { options: [{ value: "a", label: "A" }], searchable: true } },
  { kind: "multiselect", component: () => m.MdyMultiselectField, empty: [], extra: { options: [{ value: "a", label: "A" }] } },
  { kind: "datepicker", component: () => m.MdyDatepickerField, empty: null, extra: {} },
  { kind: "daterange", component: () => m.MdyDaterangeField, empty: { start: null, end: null }, extra: {} },
  { kind: "timepicker", component: () => m.MdyTimepickerField, empty: null, extra: {} },
  { kind: "colors", component: () => m.MdyColorsField, empty: "", extra: {} },
];

const open = async (testCase) => {
  const form = m.createVueForm({ value: field(testCase.empty) });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h("div", [
      h(testCase.component(), { field: form.f.value, widgetId: `f-${testCase.kind}`, label: "P", ...testCase.extra }),
      h("input", { id: "elsewhere" }),
    ]),
  });
  app.mount(host);
  await settle();
  const opener = host.querySelector("button[aria-expanded]") ?? host.querySelector("[aria-expanded]");
  opener.click();
  await settle();
  assert.equal(opener.getAttribute("aria-expanded"), "true", `${testCase.kind} never opened, so nothing below is a measurement`);
  return { host, opener, dispose: () => { app.unmount(); host.remove(); document.body.innerHTML = ""; } };
};

for (const testCase of CASES) {
  test(`${testCase.kind}: the panel closes when the keyboard lands outside the widget`, async () => {
    // Asked of the catalogue: a kind that stopped declaring this must stop being closed this way,
    // and this test would then be about a rule nobody makes.
    assert.equal(
      MDY_WIDGET_CONTRACTS[testCase.kind].capabilities.dismissOnFocusOutside, true,
      `${testCase.kind} no longer declares this, so the claim has moved`,
    );

    const view = await open(testCase);
    try {
      view.host.querySelector("#elsewhere").focus();
      view.host.querySelector("#elsewhere").dispatchEvent(new window.Event("focusin", { bubbles: true }));
      await settle();
      assert.equal(
        view.opener.getAttribute("aria-expanded"), "false",
        `${testCase.kind}: the keyboard is in another field and the panel is still open behind it`,
      );
    } finally {
      view.dispose();
    }
  });

  test(`${testCase.kind}: reaching into the panel is not leaving the widget`, async () => {
    const view = await open(testCase);
    try {
      const panel = document.querySelector(`.${partClasses(testCase.kind, "popup")[0]}`);
      assert.ok(panel, `${testCase.kind} drew no panel`);
      panel.dispatchEvent(new window.Event("focusin", { bubbles: true }));
      await settle();
      assert.equal(
        view.opener.getAttribute("aria-expanded"), "true",
        `${testCase.kind}: reaching the panel it opened closed it — the panel is drawn outside the field, and "outside" is not where a node sits`,
      );
    } finally {
      view.dispose();
    }
  });
}
