/**
 * A widget that has not been opened does not look open.
 *
 * The select drew its panel with no way of being shut: the list was on the page from the moment the
 * field was mounted, while the trigger said `aria-expanded="false"`. What that costs is not tidiness
 * — a person looking sees an open list and a person listening is told it is closed, and the two
 * cannot both be acted on.
 *
 * **Visibility, not presence.** Every renderer here keeps its panel in the document while it is
 * shut, so that what names it keeps naming something; a check that counted the element would report
 * all of them as open. This asks whether the panel is *shown*, which is the question a person's eyes
 * ask, and it asks every kind that has one rather than the one that was reported.
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

/** Every kind this package draws a panel for, with what its field holds when it holds nothing. */
const CASES = [
  { kind: "select", component: () => m.MdySelectField, empty: null, extra: { options: [{ value: "a", label: "A" }], searchable: true } },
  { kind: "multiselect", component: () => m.MdyMultiselectField, empty: [], extra: { options: [{ value: "a", label: "A" }] } },
  { kind: "datepicker", component: () => m.MdyDatepickerField, empty: null, extra: {} },
  { kind: "daterange", component: () => m.MdyDaterangeField, empty: { start: null, end: null }, extra: {} },
  { kind: "timepicker", component: () => m.MdyTimepickerField, empty: null, extra: {} },
  { kind: "colors", component: () => m.MdyColorsField, empty: "", extra: {} },
];

const mount = async (testCase) => {
  const form = createVueFormFor(testCase.empty);
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(testCase.component(), {
      field: form.f.value, widgetId: `p-${testCase.kind}`, label: "P", ...testCase.extra,
    }),
  });
  app.mount(host);
  await settle();
  return { host, form, dispose: () => { app.unmount(); host.remove(); document.body.innerHTML = ""; } };
};
const createVueFormFor = (empty) => m.createVueForm({ value: field(empty) });

for (const testCase of CASES) {
  test(`${testCase.kind}: its panel is shut before anyone opens it`, async () => {
    // Asked of the catalogue, so a kind that stops declaring an overlay leaves this test rather
    // than passing it vacuously.
    assert.equal(
      MDY_WIDGET_CONTRACTS[testCase.kind].capabilities.overlay, true,
      `${testCase.kind} declares no overlay, so it has no panel this test can be about`,
    );
    const view = await mount(testCase);
    try {
      const panel = document.querySelector(`.${partClasses(testCase.kind, "popup")[0]}`);
      assert.ok(panel, `${testCase.kind} drew no panel at all`);
      assert.equal(
        panel.hidden, true,
        `${testCase.kind} is shown open before anyone opened it, while its opener says it is closed`,
      );
      const opener = view.host.querySelector("[aria-expanded]");
      assert.equal(opener?.getAttribute("aria-expanded"), "false", `${testCase.kind}: the opener disagrees`);
    } finally {
      view.dispose();
    }
  });
}
